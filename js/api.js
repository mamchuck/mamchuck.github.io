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
    async select(table, { eq = {}, order, asc = true, limit } = {}) {
      let q = sb.from(table).select('*');
      for (const [k, v] of Object.entries(eq)) q = Array.isArray(v) ? q.in(k, v) : q.eq(k, v);
      if (order) q = q.order(order, { ascending: asc });
      if (limit) q = q.limit(limit);
      return ok(await q);
    },
    async insert(table, row) { return ok(await sb.from(table).insert(row).select().single()); },
    async update(table, id, patch) { return ok(await sb.from(table).update(patch).eq('id', id).select().single()); },
    async remove(table, id) { ok(await sb.from(table).delete().eq('id', id)); },
    async rpc(fn, args) { return ok(await sb.rpc(fn, args)); },

    async upload(path, file) { ok(await sb.storage.from('files').upload(path, file)); return path; },
    async fileUrl(path) { return ok(await sb.storage.from('files').createSignedUrl(path, 3600)).signedUrl; },
    async removeFile(path) { ok(await sb.storage.from('files').remove([path])); },
  };
}
