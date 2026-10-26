// Telegram: подключение бота, карточки в настройках, баннер-напоминание.
// Всё «мягкое»: если в базе ещё нет таблиц бота, блоки просто не показываются.
import { h, raw, mount, $, I, toast, modal } from './ui.js?v=202610262002';

const TG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.62 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.89.03-.25.38-.51 1.06-.78 4.15-1.81 6.92-3.01 8.31-3.6 3.95-1.66 4.77-1.95 5.3-1.96.12 0 .39.03.56.17.15.12.19.28.21.4-.02.07-.02.2-.04.33z"/></svg>';
export const tgIcon = () => raw(TG);

const SNOOZE = 'mamchuck-tg-snooze';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

export async function getSettings(api) {
  try { return (await api.select('app_settings'))[0] || null; } catch { return null; }
}
export const botReady = (s) => !!(s && s.bot_ready && s.bot_username);

export async function myLink(api, userId) {
  try { return (await api.select('telegram_links', { eq: { user_id: userId } }))[0] || null; } catch { return null; }
}

function loadQR() {
  if (window.QRCode) return Promise.resolve(window.QRCode);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = () => resolve(window.QRCode);
    s.onerror = reject;
    document.head.append(s);
  });
}

// Окно подключения: кнопка «Открыть Telegram» + QR для компьютера + ожидание привязки
export async function connectTelegram(ctx, onDone) {
  const s = await getSettings(ctx.api);
  if (!botReady(s)) { toast('Бот ещё не настроен', 'error'); return; }
  let code;
  try { code = await ctx.api.rpc('tg_create_link'); } catch (e) { toast(e.message, 'error'); return; }
  const url = `https://t.me/${s.bot_username}?start=${code}`;
  const started = Date.now();
  const m = modal({
    title: 'Подключить Telegram',
    body: h`
      <ol class="tg-steps">
        <li>Нажмите <b>«Открыть Telegram»</b> — откроется бот <b>@${s.bot_username}</b>.</li>
        <li>В боте нажмите <b>«Запустить»</b> (Start).</li>
        <li>Вернитесь сюда — всё подключится само.</li>
      </ol>
      <a class="btn btn-primary btn-block tg-open" href="${url}" target="_blank" rel="noopener noreferrer">${tgIcon()} Открыть Telegram</a>
      <div class="qr-wrap"><div class="qr" aria-label="QR-код ссылки на бота"></div>
        <span class="hint">С компьютера: наведите камеру телефона на код</span></div>
      <p class="tg-wait"><span class="spin spin-sm"></span> Жду, когда вы нажмёте «Запустить» в боте…</p>
      <p class="hint">Ссылка одноразовая и действует 30 минут.</p>`,
  });
  loadQR().then((QR) => {
    const box = $('.qr', m.el);
    if (box) new QR(box, { text: url, width: 168, height: 168, colorDark: '#0f172a', colorLight: '#ffffff', correctLevel: QR.CorrectLevel.M });
  }).catch(() => $('.qr-wrap', m.el)?.remove());

  const poll = async () => {
    if (!m.el.isConnected) return;
    const link = await myLink(ctx.api, ctx.me.id);
    if (link && new Date(link.linked_at).getTime() >= started - 5000) {
      mount($('.modal-body', m.el), h`<div class="tg-done">${I.check}<h3>Telegram подключён!</h3>
        <p class="muted">Бот уже прислал приветствие. Теперь напоминания будут приходить туда.</p></div>`);
      toast('Telegram подключён');
      onDone?.();
      setTimeout(() => m.el.isConnected && m.close(), 2200);
      return;
    }
    if (Date.now() - started < 30 * 60 * 1000) setTimeout(poll, 2500);
  };
  setTimeout(poll, 2500);
}

// ---------- Карточка «Telegram-уведомления» в настройках (для всех ролей) ----------
export async function renderTelegramCard(el, ctx) {
  const [s, link] = await Promise.all([getSettings(ctx.api), myLink(ctx.api, ctx.me.id)]);
  const tutor = ctx.me.role === 'tutor';
  if (!s) { el.remove(); return; }                         // миграция бота ещё не применена
  if (!botReady(s)) {
    if (!tutor) { el.remove(); return; }
    mount(el, h`<div class="card-head"><h2>Telegram-бот</h2><span class="badge warn">не настроен</span></div>
      <p class="muted">Бот ещё не подключён к базе. Инструкция — в файле <b>TELEGRAM.md</b> в папке проекта.</p>`);
    return;
  }
  const what = tutor
    ? 'сданные работы, просьбы о переносе, напоминания о занятиях и план на завтра'
    : ctx.me.role === 'parent'
      ? 'напоминания о занятиях, новые ДЗ и оценки и отчёты после занятий'
      : 'напоминания о занятиях, новые домашние задания и оценки';
  if (!link) {
    mount(el, h`<div class="card-head"><h2>Telegram-уведомления</h2><span class="badge muted">не подключено</span></div>
      <p class="muted">Бот <b>@${s.bot_username}</b> будет присылать ${what}.</p>
      <button type="button" class="btn btn-primary tg-btn" data-tg-connect>${tgIcon()} Подключить Telegram</button>`);
  } else {
    mount(el, h`<div class="card-head"><h2>Telegram-уведомления</h2><span class="badge ok">подключено</span></div>
      <p class="muted">Чат: <b>${link.tg_username ? '@' + link.tg_username : link.tg_name || 'Telegram'}</b>. Бот присылает ${what}.</p>
      <label class="switch"><input type="checkbox" data-tg-notify ${link.notify ? 'checked' : ''}><span>Присылать уведомления</span></label>
      <div class="actions actions-left">
        <button type="button" class="btn btn-soft btn-sm" data-tg-test>Отправить тестовое</button>
        <a class="btn btn-ghost btn-sm" href="https://t.me/${s.bot_username}" target="_blank" rel="noopener noreferrer">Открыть бота</a>
        <button type="button" class="btn btn-ghost btn-sm btn-danger-ghost" data-tg-unlink>Отключить</button>
      </div>`);
  }
  const again = () => renderTelegramCard(el, ctx);
  $('[data-tg-connect]', el)?.addEventListener('click', () => connectTelegram(ctx, again));
  $('[data-tg-notify]', el)?.addEventListener('change', async (e) => {
    try { await ctx.api.rpc('tg_set_notify', { p_on: e.target.checked }); toast(e.target.checked ? 'Уведомления включены' : 'Уведомления на паузе'); }
    catch (err) { toast(err.message, 'error'); e.target.checked = !e.target.checked; }
  });
  $('[data-tg-test]', el)?.addEventListener('click', async () => {
    try { await ctx.api.rpc('tg_test'); toast('Отправлено — придёт в течение минуты'); } catch (err) { toast(err.message, 'error'); }
  });
  $('[data-tg-unlink]', el)?.addEventListener('click', async () => {
    try { await ctx.api.rpc('tg_unlink'); toast('Telegram отключён'); again(); } catch (err) { toast(err.message, 'error'); }
  });
}

// ---------- Настройки напоминаний (только преподаватель) ----------
export async function renderReminderCard(el, ctx) {
  const s = await getSettings(ctx.api);
  if (!s) { el.remove(); return; }
  const mins = [[30, 'за 30 минут'], [60, 'за 1 час'], [120, 'за 2 часа'], [180, 'за 3 часа'], [1440, 'за сутки']];
  mount(el, h`<div class="card-head"><h2>Напоминания о занятиях</h2>
      ${botReady(s) ? h`<span class="badge ok">бот @${s.bot_username}</span>` : ''}</div>
    <form class="stack" data-rem>
      <label class="field"><span>Напоминать ученикам, родителям и вам</span><select name="reminder_minutes">
        ${mins.map(([v, l]) => h`<option value="${v}" ${s.reminder_minutes === v ? 'selected' : ''}>${l}</option>`)}</select></label>
      <label class="switch"><input type="checkbox" name="evening_reminder" ${s.evening_reminder ? 'checked' : ''}><span>Ещё и накануне вечером</span></label>
      <label class="field"><span>Во сколько вечером (вам — план на завтра)</span><select name="evening_hour">
        ${[18, 19, 20, 21, 22].map((v) => h`<option value="${v}" ${s.evening_hour === v ? 'selected' : ''}>${v}:00</option>`)}</select></label>
      <p class="hint">Время в сообщениях — по Москве.</p>
      <button class="btn btn-primary">Сохранить</button>
    </form>`);
  $('[data-rem]', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await ctx.api.update('app_settings', 1, {
        reminder_minutes: +f.reminder_minutes.value, evening_reminder: f.evening_reminder.checked,
        evening_hour: +f.evening_hour.value, updated_at: new Date().toISOString(),
      });
      toast('Сохранено');
    } catch (err) { toast(err.message, 'error'); }
  });
}

// ---------- Баннер «Подключите Telegram» на главной ----------
export async function mountTelegramBanner(view, ctx) {
  const snooze = +(store.get(SNOOZE) || 0);
  if (Date.now() < snooze) return;
  const [s, link] = await Promise.all([getSettings(ctx.api), myLink(ctx.api, ctx.me.id)]);
  if (!botReady(s) || link || !view.isConnected) return;
  const text = ctx.me.role === 'tutor'
    ? 'Подключите Telegram — будут приходить сданные работы, просьбы о переносе и план на завтра.'
    : ctx.me.role === 'parent'
      ? 'Подключите Telegram — пришлём напоминание перед занятием, оценки и отчёты преподавателя.'
      : 'Подключите Telegram — бот напомнит о занятии и пришлёт новое домашнее задание.';
  const b = document.createElement('section');
  b.className = 'card tg-banner';
  mount(b, h`<span class="tg-banner-icon">${tgIcon()}</span>
    <div class="item-main"><b>Уведомления в Telegram</b><p class="muted small">${text}</p></div>
    <div class="actions"><button class="btn btn-primary btn-sm" data-tg-connect>Подключить</button>
      <button class="btn btn-ghost btn-sm" data-tg-later>Позже</button></div>`);
  const hero = $('.page-hero', view);
  hero ? hero.after(b) : view.prepend(b);
  $('[data-tg-connect]', b).addEventListener('click', () => connectTelegram(ctx, () => b.remove()));
  $('[data-tg-later]', b).addEventListener('click', () => { store.set(SNOOZE, String(Date.now() + 3 * 864e5)); b.remove(); });
}

// Статусы Telegram для списка пользователей (вкладка «Доступ» у преподавателя)
export async function linksFor(api, userIds) {
  if (!userIds.length) return {};
  try { return Object.fromEntries((await api.select('telegram_links', { eq: { user_id: userIds } })).map((l) => [l.user_id, l])); }
  catch { return {}; }
}
