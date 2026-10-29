// Работа с Supabase. Все права доступа проверяет база (Row Level Security).
// Библиотека Supabase — своя копия (официальный npm-пакет 2.57.4, сверен по sha512): без внешнего CDN и 8 лишних запросов
import '../vendor/supabase-2.57.4.js';
const { createClient } = self.supabase;

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
  const PAGE = 1000, CACHE_TTL = 5 * 60e3, IN_CHUNK = 150, cache = new Map();
  // Кэш на 5 минут — только для общих справочников банка задач (не для персональных данных)
  const CACHED = new Set(['oge_tasks', 'oge_task_counts']);
  const DEPENDS = { oge_tasks: ['oge_tasks', 'oge_task_counts'] };   // запись в таблицу сбрасывает и производные
  const invalidate = (table) => {
    for (const t of DEPENDS[table] || [table]) for (const k of cache.keys()) if (k.startsWith(`${t}|`)) cache.delete(k);
  };
  const cached = (table, key, run) => {
    if (!CACHED.has(table)) return run();
    const k = `${table}|${key}`;
    let hit = cache.get(k);
    if (!hit || Date.now() - hit.t > CACHE_TTL) {
      hit = { t: Date.now(), p: run() };
      hit.p.catch(() => cache.delete(k));
      cache.set(k, hit);
    }
    return hit.p.then((rows) => structuredClone(rows));
  };

  // Поиск по нескольким полям (ilike): значение в кавычках — запятые и скобки во вводе безопасны
  const searchExpr = ({ q, fields }) => {
    const v = String(q).trim().replace(/[\\"]/g, '\\$&');
    return fields.map((f) => `${f}.ilike."*${v}*"`).join(',');
  };
  // opts: cols, eq {col: value | [values]}, isNull [cols], notNull [cols], gte/gt/lt/lte {col: value}, search {q, fields}, order 'col' | [[col, asc]], asc, limit
  const build = (table, opts, count) => {
    let q = sb.from(table).select(opts.cols || '*', count ? { count: 'exact' } : undefined);
    for (const [k, v] of Object.entries(opts.eq || {})) q = Array.isArray(v) ? q.in(k, v) : q.eq(k, v);
    for (const c of opts.isNull || []) q = q.is(c, null);
    for (const c of opts.notNull || []) q = q.not(c, 'is', null);
    for (const [op, m] of [['gte', opts.gte], ['gt', opts.gt], ['lt', opts.lt], ['lte', opts.lte]]) for (const [c, v] of Object.entries(m || {})) q = q[op](c, v);
    if (opts.search?.q?.trim()) q = q.or(searchExpr(opts.search));
    const ord = Array.isArray(opts.order) ? opts.order : opts.order ? [[opts.order, opts.asc ?? true]] : [];
    for (const [c, asc] of ord) q = q.order(c, { ascending: asc });
    return q;
  };

  async function fetchRows(table, opts = {}) {
    const eq = opts.eq || {};
    if (Object.values(eq).some((v) => Array.isArray(v) && !v.length)) return [];
    // Длинный список значений (in.(...)) → несколько запросов параллельно: иначе адрес запроса превысит лимит
    const big = Object.entries(eq).find(([, v]) => Array.isArray(v) && v.length > IN_CHUNK);
    if (big) {
      const [k, v] = big; const parts = [];
      for (let i = 0; i < v.length; i += IN_CHUNK) parts.push(v.slice(i, i + IN_CHUNK));
      let rows = (await Promise.all(parts.map((part) => fetchRows(table, { ...opts, eq: { ...eq, [k]: part }, limit: undefined })))).flat();
      if (opts.order && !Array.isArray(opts.order)) {
        const dir = (opts.asc ?? true) ? 1 : -1;
        rows.sort((a, b) => ((a[opts.order] ?? '') > (b[opts.order] ?? '') ? 1 : (a[opts.order] ?? '') < (b[opts.order] ?? '') ? -1 : 0) * dir);
      }
      return opts.limit ? rows.slice(0, opts.limit) : rows;
    }
    if (opts.limit) return ok(await build(table, opts).limit(opts.limit));
    const { data, count, error } = await build(table, opts, true).range(0, PAGE - 1);
    if (error) throw new Error(tr(error.message));
    if (data.length < PAGE || !count || count <= PAGE) return data;
    // Больше 1000 строк: все порции параллельно, со стабильным порядком (иначе страницы могут пересекаться)
    const pages = await Promise.all(Array.from({ length: Math.ceil(count / PAGE) }, (_, i) =>
      build(table, opts).order('id').range(i * PAGE, i * PAGE + PAGE - 1).then(ok)));
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
      return cached(table, JSON.stringify(opts), () => fetchRows(table, opts));
    },
    // Одна страница + общее число строк по тем же фильтрам: { rows, count }. from/to — номера строк (с нуля, включительно)
    page(table, { from = 0, to = 24, ...opts } = {}) {
      return cached(table, `page|${from}|${to}|${JSON.stringify(opts)}`, async () => {
        const { data, count, error } = await build(table, opts, true).range(from, to);
        if (error) throw new Error(tr(error.message));
        return { rows: data, count: count ?? data.length };
      });
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
    // Живой штрих «пока пишется»: короткие сообщения между участниками доски, в базу не попадают
    live(name, cb) {
      const ch = sb.channel(name, { config: { broadcast: { self: false } } }).on('broadcast', { event: 's' }, ({ payload }) => cb(payload)).subscribe();
      return { send: (payload) => { ch.send({ type: 'broadcast', event: 's', payload }); }, close: () => { sb.removeChannel(ch); } };
    },
    async removeWhere(table, eq) { invalidate(table); ok(await sb.from(table).delete().match(eq)); },
    async remove(table, id) { invalidate(table); ok(await sb.from(table).delete().eq('id', id)); },
    async rpc(fn, args) { return ok(await sb.rpc(fn, args)); },
    // Живые изменения таблицы (Realtime, с учётом прав RLS). filter: 'student_id=eq.<uuid>'. Возвращает функцию отписки.
    subscribe(table, filter, cb, onStatus) {
      const ch = sb.channel(`${table}:${filter}:${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table, filter }, cb).subscribe(onStatus);
      return () => { sb.removeChannel(ch); };
    },

    async upload(path, file) { ok(await sb.storage.from('files').upload(path, file)); return path; },
    async fileUrl(path) { return ok(await sb.storage.from('files').createSignedUrl(path, 3600)).signedUrl; },
    async removeFile(path) { ok(await sb.storage.from('files').remove([path])); },
  };
}
