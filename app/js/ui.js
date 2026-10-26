// Мини-набор утилит интерфейса: безопасные шаблоны, модальные окна, уведомления, форматирование.

export class Raw { constructor(s) { this.s = s; } }
export const raw = (s) => new Raw(s);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
const val = (v) =>
  v == null || v === false ? '' : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join('') : esc(v);

// Шаблон с автоматическим экранированием: h`<p>${userText}</p>`
export function h(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += val(v) + strings[i + 1]; });
  return new Raw(out);
}
export const mount = (el, tpl) => { el.innerHTML = tpl.s; };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- Иконки ----------
const icon = (d) => raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`);
export const I = {
  home: icon('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  users: icon('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>'),
  calendar: icon('<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>'),
  check: icon('<path d="M4 12.5 9.5 18 20 6.5"/>'),
  inbox: icon('<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>'),
  book: icon('<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/>'),
  folder: icon('<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>'),
  chart: icon('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  wallet: icon('<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18M16.5 15h1"/>'),
  settings: icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  plus: icon('<path d="M12 5v14M5 12h14"/>'),
  logout: icon('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"/>'),
  file: icon('<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5"/>'),
  link: icon('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  trash: icon('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  back: icon('<path d="M15 5l-7 7 7 7"/>'),
  key: icon('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>'),
  note: icon('<path d="M5 3h14v18l-7-4-7 4z"/>'),
  clock: icon('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/>'),
  bolt: icon('<path d="M13 2 4.5 13.5H12L11 22l8.5-11.5H12L13 2z"/>'),
  target: icon('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>'),
  more: icon('<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>'),
  upload: icon('<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>'),
  sun: icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: icon('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
};

// ---------- Тема: 'auto' | 'light' | 'dark' ----------
export function getTheme() { try { return localStorage.getItem('theme') || 'auto'; } catch { return 'auto'; } }
export function setTheme(t) {
  try { t === 'auto' ? localStorage.removeItem('theme') : localStorage.setItem('theme', t); } catch {}
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}
export const isDark = () => {
  const t = getTheme();
  return t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
};

// ---------- Уведомления ----------
export function toast(msg, type = 'ok') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.append(box); }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.setAttribute('role', type === 'error' ? 'alert' : 'status');
  t.textContent = msg;
  box.append(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3600);
}

// ---------- Модальное окно с формой ----------
// onSubmit(data, form) — если бросает ошибку, окно остаётся открытым.
export function modal({ title, body, submit = 'Сохранить', danger = false, onSubmit, wide = false }) {
  const d = document.createElement('dialog');
  d.className = 'modal' + (wide ? ' modal-wide' : '');
  mount(d, h`
    <form class="modal-form" novalidate>
      <header class="modal-head"><h2>${title}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Закрыть">✕</button></header>
      <div class="modal-body">${body}</div>
      ${onSubmit ? h`<footer class="modal-foot">
        <button type="button" class="btn btn-ghost" data-close>Отмена</button>
        <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${submit}</button>
      </footer>` : ''}
    </form>`);
  document.body.append(d);
  const form = $('form', d);
  const close = () => { d.close(); d.remove(); };
  $$('[data-close]', d).forEach((b) => b.addEventListener('click', close));
  d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const btn = $('button[type=submit]', form);
    btn.disabled = true; btn.classList.add('loading');
    try {
      const data = {};
      for (const [k, v] of new FormData(form)) {
        if (v instanceof File && !v.size) continue;
        const x = typeof v === 'string' ? v.trim() : v;
        data[k] = k in data ? [].concat(data[k], x) : x;
      }
      await onSubmit?.(data, form);
      close();
    } catch (err) {
      toast(err.message || 'Ошибка', 'error');
      btn.disabled = false; btn.classList.remove('loading');
    }
  });
  d.showModal();
  $('input,textarea,select', d)?.focus();
  return { el: d, close };
}

export const confirmDialog = (text, onYes, yes = 'Удалить') =>
  modal({ title: 'Подтверждение', body: h`<p>${text}</p>`, submit: yes, danger: true, onSubmit: onYes });

// ---------- Форматирование ----------
const dtf = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const df = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const dayf = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
export const fmtDT = (s) => (s ? dtf.format(new Date(s)) : '—');
export const fmtD = (s) => (s ? df.format(new Date(s)) : '—');
export const fmtDay = (s) => dayf.format(new Date(s));
export const fmtMoney = (k, cur = 'RUB') =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(k / 100);
export const dayKey = (s) => { const d = new Date(s); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

// Для <input type="datetime-local">
export function toLocalInput(d) {
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
}

export const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return `${n} ${a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many}`;
};

export const empty = (text, ic = I.inbox) => h`<div class="empty">${ic}<p>${text}</p></div>`;
export const spinner = () => h`<div class="loading-block"><span class="spin"></span></div>`;

// Статус ДЗ по ответу ученика
export function hwStatus(hw, sub) {
  if (sub?.reviewed_at) return { key: 'reviewed', label: 'Проверено', cls: 'ok' };
  if (sub) return { key: 'submitted', label: 'На проверке', cls: 'info' };
  if (hw.due_at && new Date(hw.due_at) < new Date()) return { key: 'overdue', label: 'Просрочено', cls: 'bad' };
  return { key: 'todo', label: 'Не сдано', cls: 'warn' };
}

export const LEVELS = [
  [0, 'Не начато'], [25, 'Знакомство'], [50, 'В процессе'], [75, 'Почти освоено'], [100, 'Освоено'],
];
export const levelLabel = (v) => [...LEVELS].reverse().find(([n]) => v >= n)[1];

export const SUBJECTS = ['Математика', 'Физика', 'Профильная математика'];
// Экзамен по предмету: ОГЭ — математика и физика, ЕГЭ — профильная математика
export const EXAM = { 'Математика': 'ОГЭ', 'Физика': 'ОГЭ', 'Профильная математика': 'ЕГЭ' };
export const subjLabel = (s) => ({ 'Математика': 'ОГЭ · Математика', 'Физика': 'ОГЭ · Физика', 'Профильная математика': 'ЕГЭ · Профиль' }[s] || s);

export function safeFileName(file) {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  return `${crypto.randomUUID()}.${ext || 'bin'}`;
}

const TG = raw('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.62 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.89.03-.25.38-.51 1.06-.78 4.15-1.81 6.92-3.01 8.31-3.6 3.95-1.66 4.77-1.95 5.3-1.96.12 0 .39.03.56.17.15.12.19.28.21.4-.02.07-.02.2-.04.33z"/></svg>');

// Плашка преподавателя с кнопкой Telegram
export const authorBar = (t) => h`
  <div class="author-bar">
    <div class="author-info"><span class="author-avatar">${t.initials}</span>
      <div><b>${t.name}</b><small>${t.title}</small></div></div>
    ${t.telegram ? h`<a class="pill-btn pill-btn-primary" href="https://t.me/${t.telegram}" target="_blank" rel="noopener noreferrer">${TG}<span>@${t.telegram}</span></a>` : ''}
  </div>`;

// Шапка страницы: капсула, заголовок с градиентным словом, подзаголовок, действия
export const pageHero = ({ eyebrow, title, accent = '', after = '', sub = '', actions = '' }) => h`
  <header class="page-hero">
    <div class="page-hero-text">
      ${eyebrow ? h`<span class="capsule">${eyebrow}</span>` : ''}
      <h1>${title}${accent ? h`<span class="grad">${accent}</span>` : ''}${after}</h1>
      ${sub ? h`<p class="muted">${sub}</p>` : ''}
    </div>
    ${actions ? h`<div class="page-hero-actions">${actions}</div>` : ''}
  </header>`;
