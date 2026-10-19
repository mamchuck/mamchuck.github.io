import { CONFIG, TUTOR } from './config.js?v=202610192259';
import { h, mount, $, $$, I, toast, modal, spinner, authorBar, pageHero, getTheme, setTheme, isDark } from './ui.js?v=202610192259';
import { tutorRoutes, tutorNav } from './tutor.js?v=202610192259';
import { backupCard, bindBackup } from './backup.js?v=202610192259';
import { renderTelegramCard, renderReminderCard } from './telegram.js?v=202610192259';
import { familyRoutes, familyNav } from './family.js?v=202610192259';

const api = CONFIG.supabaseUrl
  ? (await import('./api.js?v=202610192259')).createApi(CONFIG)
  : (await import('./demo.js?v=202610192259')).createDemoApi();

const root = $('#app');
const ctx = { api, me: null, students: [], studentId: null };
const CODE_KEY = 'tutoros-invite';
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch {} },
};

// ---------- Запуск ----------
async function start() {
  // Ссылка-приглашение: #/join/КОД
  const m = location.hash.match(/^#\/join\/([A-Za-z0-9]+)/);
  if (m) { store.set(CODE_KEY, m[1].toUpperCase()); history.replaceState(null, '', location.pathname); }

  mount(root, spinner());
  try {
    ctx.me = await api.me();
  } catch (e) {
    return mount(root, h`<div class="center-screen"><div class="card auth-card"><h1>Ошибка подключения</h1><p class="muted">${e.message}</p>
      <button class="btn btn-primary" onclick="location.reload()">Повторить</button></div></div>`);
  }
  if (!ctx.me) return renderAuth();

  const code = store.get(CODE_KEY);
  if (code && ctx.me.role !== 'tutor') {
    try { await api.rpc('redeem_invitation', { p_code: code }); toast('Доступ открыт'); ctx.me = await api.me(); }
    catch (e) { toast(e.message, 'error'); }
    store.set(CODE_KEY, null);
  }
  if (ctx.me.role === 'pending') return renderJoin();

  if (ctx.me.role !== 'tutor') {
    const ms = await api.select('student_memberships');
    ctx.students = ms.length ? await api.select('students', { eq: { id: ms.map((x) => x.student_id) }, order: 'name' }) : [];
    const saved = store.get('tutoros-child');
    ctx.studentId = ctx.students.find((s) => s.id === saved)?.id || ctx.students[0]?.id || null;
  }
  renderShell();
  route();
}

api.onAuth((ev) => {
  if (ev === 'PASSWORD_RECOVERY') renderNewPassword();
  if (ev === 'SIGNED_OUT') { ctx.me = null; renderAuth(); }
});

// ---------- Вход / регистрация ----------
function renderAuth(tab = store.get(CODE_KEY) ? 'signup' : 'login') {
  const hasCode = !!store.get(CODE_KEY);
  mount(root, h`
  <div class="center-screen">
    <div class="auth-card card">
      <div class="brand brand-lg"><span class="logo logo-outline" aria-hidden="true"><span>M<sup>2</sup></span></span><span class="brand-name">mamchuck</span></div>
      <div><span class="capsule">Физика · Математика</span>
      <h1 class="hero-h1">Личный <span class="grad">кабинет</span></h1>
      <p class="muted">Расписание, домашние задания, материалы и прогресс — в одном месте.</p></div>
      ${hasCode ? h`<p class="notice">Вас пригласили в личный кабинет. Зарегистрируйтесь или войдите — доступ откроется автоматически.</p>` : ''}
      ${api.demo ? h`
        <p class="notice">Демо-режим: данные вымышленные. Выберите, чей кабинет открыть.</p>
        <div class="demo-roles">
          ${api.profiles.map((p) => h`<button class="btn btn-soft" data-demo="${p.id}">${{ tutor: 'Преподаватель', student: 'Ученик', parent: 'Родитель' }[p.role]}<small>${p.full_name}</small></button>`)}
        </div>` : h`
        <div class="seg" role="tablist">
          <button role="tab" class="${tab === 'login' ? 'on' : ''}" data-tab="login">Вход</button>
          <button role="tab" class="${tab === 'signup' ? 'on' : ''}" data-tab="signup">Регистрация</button>
        </div>
        <form id="auth-form" class="stack">
          ${tab === 'signup' ? h`<label class="field"><span>Имя</span><input name="name" required autocomplete="name" placeholder="Как к вам обращаться"></label>` : ''}
          <label class="field"><span>Email</span><input name="email" type="email" required autocomplete="email"></label>
          <label class="field"><span>Пароль</span><input name="password" type="password" required minlength="6"
            autocomplete="${tab === 'login' ? 'current-password' : 'new-password'}"></label>
          <button class="btn btn-primary btn-block" type="submit">${tab === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
          ${tab === 'login' ? h`<button type="button" class="link-btn" id="forgot">Забыли пароль?</button>` : ''}
        </form>`}
      ${authorBar(TUTOR)}
    </div>
  </div>`);

  $$('[data-demo]').forEach((b) => b.addEventListener('click', async () => { await api.demoLogin(b.dataset.demo); location.hash = ''; start(); }));
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => renderAuth(b.dataset.tab)));
  $('#forgot')?.addEventListener('click', () => modal({
    title: 'Восстановление пароля', submit: 'Отправить ссылку',
    body: h`<p class="muted">Пришлём письмо со ссылкой для смены пароля.</p>
      <label class="field"><span>Email</span><input name="email" type="email" required></label>`,
    onSubmit: async (d) => { await api.resetPassword(d.email); toast('Письмо отправлено — проверьте почту'); },
  }));
  $('#auth-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, d = Object.fromEntries(new FormData(f));
    const btn = $('button[type=submit]', f); btn.disabled = true; btn.classList.add('loading');
    try {
      if (tab === 'login') await api.signIn(d.email.trim(), d.password);
      else if (!(await api.signUp(d.email.trim(), d.password, d.name.trim()))) {
        toast('Подтвердите email по ссылке из письма, затем войдите'); renderAuth('login'); return;
      }
      start();
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; btn.classList.remove('loading'); }
  });
}

function renderNewPassword() {
  mount(root, h`<div class="center-screen"><div class="auth-card card">
    <h1>Новый пароль</h1>
    <form id="np" class="stack"><label class="field"><span>Пароль</span><input name="p" type="password" minlength="6" required autocomplete="new-password"></label>
    <button class="btn btn-primary btn-block">Сохранить</button></form></div></div>`);
  $('#np').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.updatePassword(e.target.p.value); toast('Пароль изменён'); history.replaceState(null, '', location.pathname); start(); }
    catch (err) { toast(err.message, 'error'); }
  });
}

// Аккаунт создан, но ещё не привязан к ученику
function renderJoin() {
  mount(root, h`<div class="center-screen"><div class="auth-card card">
    <div class="brand brand-lg"><span class="logo logo-outline" aria-hidden="true"><span>M<sup>2</sup></span></span><span class="brand-name">mamchuck</span></div>
    <h1>Введите код приглашения</h1>
    <p class="muted">Код выдаёт преподаватель. Он одноразовый и действует ограниченное время.</p>
    <form id="join" class="stack">
      <label class="field"><span>Код</span><input name="code" required autocomplete="off" class="code-input" placeholder="A1B2C3D4E5F6" maxlength="12"></label>
      <button class="btn btn-primary btn-block">Подключиться</button>
      <button type="button" class="link-btn" id="lo">Выйти</button>
    </form></div></div>`);
  $('#lo').addEventListener('click', logout);
  $('#join').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.rpc('redeem_invitation', { p_code: e.target.code.value.trim() }); toast('Готово!'); start(); }
    catch (err) { toast(err.message, 'error'); }
  });
}

async function logout() { await api.signOut(); ctx.me = null; location.hash = ''; renderAuth('login'); }

// ---------- Каркас ----------
const isTutor = () => ctx.me.role === 'tutor';

function renderShell() {
  const nav = isTutor() ? tutorNav : familyNav(ctx.me.role);
  const roleName = { tutor: 'Преподаватель', student: 'Ученик', parent: 'Родитель' }[ctx.me.role];
  const childPicker = !isTutor() && ctx.students.length > 1 ? h`
    <label class="child-pick"><span class="sr">Ребёнок</span><select class="child-select">
      ${ctx.students.map((s) => h`<option value="${s.id}" ${s.id === ctx.studentId ? 'selected' : ''}>${s.name}</option>`)}
    </select></label>` : '';
  mount(root, h`
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><span class="logo logo-outline" aria-hidden="true"><span>M<sup>2</sup></span></span><span class="brand-name">mamchuck</span></div>
      ${childPicker}
      <nav class="nav">${nav.map((n) => h`<a href="#/${n.path}" data-nav="${n.path}">${n.icon}<span>${n.label}</span></a>`)}</nav>
      <div class="side-foot">
        <a href="#/settings" class="me" data-nav="settings">
          <span class="avatar">${(ctx.me.full_name || ctx.me.email || '?')[0].toUpperCase()}</span>
          <span class="me-text"><b>${ctx.me.full_name || 'Без имени'}</b><small>${roleName}</small></span>
          <button class="icon-btn theme-btn" data-theme-toggle aria-label="Сменить тему">${isDark() ? I.sun : I.moon}</button></a>
      </div>
    </aside>
    <header class="topbar">
      <div class="brand"><span class="logo logo-outline" aria-hidden="true"><span>M<sup>2</sup></span></span><span class="brand-name">mamchuck</span></div>
      ${childPicker}
      <button class="icon-btn" data-theme-toggle aria-label="Сменить тему">${isDark() ? I.sun : I.moon}</button>
      <a href="#/settings" class="icon-btn" aria-label="Настройки">${I.settings}</a>
    </header>
    <main id="view" class="view" tabindex="-1"></main>
    <nav class="tabbar">${(nav.length > 5 ? nav.slice(0, 4) : nav).map((n) => h`<a href="#/${n.path}" data-nav="${n.path}">${n.icon}<span>${n.short || n.label}</span></a>`)}
      ${nav.length > 5 ? h`<button type="button" class="tab-more" data-more>${I.more}<span>Ещё</span></button>` : ''}</nav>
    ${api.demo ? h`<div class="demo-badge">Демо · <button class="link-btn" id="demo-exit">сменить роль</button></div>` : ''}
  </div>`);
  $$('.child-select').forEach((sel) => sel.addEventListener('change', () => {
    ctx.studentId = sel.value; store.set('tutoros-child', sel.value);
    $$('.child-select').forEach((s) => { s.value = sel.value; });
    route();
  }));
  $('#demo-exit')?.addEventListener('click', logout);
  $('[data-more]')?.addEventListener('click', () => {
    const m = modal({ title: 'Разделы', body: h`<nav class="more-nav">${nav.slice(4).map((n) => h`<a href="#/${n.path}">${n.icon}<span>${n.label}</span></a>`)}
      <a href="#/settings">${I.settings}<span>Настройки</span></a></nav>` });
    $$('.more-nav a', m.el).forEach((a) => a.addEventListener('click', () => m.close()));
  });
  $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    setTheme(isDark() ? 'light' : 'dark');
    $$('[data-theme-toggle]').forEach((x) => mount(x, h`${isDark() ? I.sun : I.moon}`));
    if (location.hash.startsWith('#/settings')) route();
  }));
}

// ---------- Маршрутизация ----------
const settingsView = async (view) => {
  mount(view, h`
    ${pageHero({ eyebrow: 'Настройки', title: 'Профиль и ', accent: 'оформление' })}
    <div class="grid-2">
      <form class="card stack" id="f-name"><h2>Профиль</h2>
        <label class="field"><span>Имя</span><input name="full_name" value="${ctx.me.full_name}" required></label>
        <p class="muted small">${ctx.me.email}</p>
        <button class="btn btn-primary">Сохранить</button></form>
      <form class="card stack" id="f-pass"><h2>Пароль</h2>
        <label class="field"><span>Новый пароль</span><input name="p" type="password" minlength="6" required autocomplete="new-password"></label>
        <button class="btn btn-primary">Изменить пароль</button></form>
    </div>
    <section class="card stack theme-card"><h2>Оформление</h2>
      <div class="seg" role="radiogroup" aria-label="Тема">
        ${[['auto', 'Как на устройстве'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([v, l]) => h`<button type="button" role="radio" aria-checked="${getTheme() === v}" class="${getTheme() === v ? 'on' : ''}" data-set-theme="${v}">${l}</button>`)}
      </div></section>
    <section class="card stack" id="tg-card"></section>
    ${isTutor() ? h`<section class="card stack" id="rem-card"></section>` : ''}
    ${isTutor() ? backupCard() : ''}
    <button class="btn btn-ghost logout-btn" id="logout">${I.logout} Выйти из аккаунта</button>`);
  $('#f-name').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.update('profiles', ctx.me.id, { full_name: e.target.full_name.value.trim() }); ctx.me.full_name = e.target.full_name.value.trim(); renderShell(); route(); toast('Сохранено'); }
    catch (err) { toast(err.message, 'error'); }
  });
  $('#f-pass').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.updatePassword(e.target.p.value); e.target.reset(); toast('Пароль изменён'); }
    catch (err) { toast(err.message, 'error'); }
  });
  $('#logout').addEventListener('click', logout);
  bindBackup(view, api, () => settingsView(view));
  renderTelegramCard($('#tg-card', view), ctx);
  if (isTutor()) renderReminderCard($('#rem-card', view), ctx);
  $$('[data-set-theme]', view).forEach((b) => b.addEventListener('click', () => {
    setTheme(b.dataset.setTheme);
    $$('[data-theme-toggle]').forEach((x) => mount(x, h`${isDark() ? I.sun : I.moon}`));
    settingsView(view);
  }));
};

export async function route() {
  if (!ctx.me || ctx.me.role === 'pending') return;
  const view = $('#view');
  if (!view) return;
  const [name = '', ...params] = location.hash.replace(/^#\/?/, '').split('/');
  const routes = { ...(isTutor() ? tutorRoutes : familyRoutes), settings: settingsView };
  const fn = routes[name] || routes[''];
  const navName = routes[name] ? ({ student: 'students', hw: 'homework' }[name] ?? name) : '';
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === navName));
  mount(view, spinner());
  try {
    await fn(view, params, ctx);
  } catch (e) {
    console.error(e);
    mount(view, h`<div class="card error-card"><h2>Не удалось загрузить</h2><p class="muted">${e.message}</p>
      <button class="btn btn-soft" id="retry">Повторить</button></div>`);
    $('#retry').addEventListener('click', route);
  }
  view.scrollTop = 0; window.scrollTo(0, 0);
}
ctx.refresh = route;

window.addEventListener('hashchange', route);
start();
