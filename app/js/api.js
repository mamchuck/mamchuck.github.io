// Работа с Supabase. Все права доступа проверяет база (Row Level Security).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';

const MESSAGES = {
  'Invalid login credentials': 'Неверный email или пароль',
  'User already registered': 'Пользователь с таким email уже зарегистрирован',
  'Email not confirmed': 'Email не подтверждён — проверьте почту',
  'Password should be at least 6 characters.': 'Пароль должен быть не короче 6 символов',
};
const tr = (m) => MESSAGES[m] || m;

export function createApi(cfg) {
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const ok = ({ data, error }) => { if (error) throw new Error(tr(error.message)); return data; };
  const PAGE = 1000, CACHE_TTL = 5 * 60e3, CACHED = new Set(['oge_tasks']), cache = new Map();
  const invalidate = (table) => { for (const k of cache.keys()) if (k.startsWith(`${table}|`)) cache.delete(k); };

  async function fetchRows(table, { eq = {}, order, asc = true, limit } = {}) {
    if (Object.values(eq).some((v) => Array.isArray(v) && !v.length)) return [];
    const build = (count) => {
      let q = sb.from(table).select('*', count ? { count: 'exact' } : undefined);
      for (const [k, v] of Object.entries(eq)) q = Array.isArray(v) ? q.in(k, v) : q.eq(k, v);
      if (order) q = q.order(order, { ascending: asc });
      return q;
    };
    if (limit) return ok(await build().limit(limit));
    const { data, count, error } = await build(true).range(0, PAGE - 1);
    if (error) throw new Error(tr(error.message));
    if (data.length < PAGE || !count || count <= PAGE) return data;
    // Больше 1000 строк: все порции параллельно, со стабильным порядком (иначе страницы могут пересекаться)
    const pages = await Promise.all(Array.from({ length: Math.ceil(count / PAGE) }, (_, i) =>
      build().order('id').range(i * PAGE, i * PAGE + PAGE - 1).then(ok)));
    return pages.flat();
  }

  return {
    demo: false,
    onAuth: (cb) => sb.auth.onAuthStateChange((ev) => cb(ev)),
    async signIn(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); },
    async signUp(email, password, full_name) {
      const d = ok(await sb.auth.signUp({ email, password, options: { data: { full_name } } }));
      return !!d.session;
    },
    async signOut() { await sb.auth.signOut(); },
    async resetPassword(email) {
      ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }));
    },
    async updatePassword(password) { ok(await sb.auth.updateUser({ password })); },
    async me() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return null;
      const p = ok(await sb.from('profiles').select('*').eq('id', session.user.id).single());
      return { ...p, email: session.user.email };
    },

    // eq: { column: value | [values] }
    // Сервер отдаёт максимум 1000 строк за раз: первая порция + число строк, остальные порции — параллельно.
    // Банк задач кэшируется на 5 минут (сбрасывается при любом изменении таблицы).
    select(table, opts = {}) {
      if (!CACHED.has(table)) return fetchRows(table, opts);
      const key = `${table}|${JSON.stringify(opts)}`;
      let hit = cache.get(key);
      if (!hit || Date.now() - hit.t > CACHE_TTL) {
        hit = { t: Date.now(), p: fetchRows(table, opts) };
        hit.p.catch(() => cache.delete(key));
        cache.set(key, hit);
      }
      return hit.p.then((rows) => structuredClone(rows));
    },
    // Все строки таблицы, порциями по 1000 (для резервной копии)
    async dumpAll(table) {
      const out = [];
      for (let from = 0; ; from += 1000) {
        const d = ok(await sb.from(table).select('*').range(from, from + 999));
        out.push(...d);
        if (d.length < 1000) return out;
      }
    },
    async insertMany(table, rows) { invalidate(table); return ok(await sb.from(table).insert(rows).select()); },
    async insert(table, row) { invalidate(table); return ok(await sb.from(table).insert(row).select().single()); },
    async update(table, id, patch) { invalidate(table); return ok(await sb.from(table).update(patch).eq('id', id).select().single()); },
    async remove(table, id) { invalidate(table); ok(await sb.from(table).delete().eq('id', id)); },
    async rpc(fn, args) { return ok(await sb.rpc(fn, args)); },

    async upload(path, file) { ok(await sb.storage.from('files').upload(path, file)); return path; },
    async fileUrl(path) { return ok(await sb.storage.from('files').createSignedUrl(path, 3600)).signedUrl; },
    async removeFile(path) { ok(await sb.storage.from('files').remove([path])); },
  };
}
