// «Рентген ОГЭ»: 10 задач без регистрации → прогноз оценки → полный разбор в Telegram.
// Проверка ответов — только в базе (xray_submit), ответы на страницу не приходят.
import { CONFIG } from '../app/js/config.js';

const BOT = 'mamchuck_bot';
const KEY = 'xray';
const DEMO = new URLSearchParams(location.search).has('demo');
const root = document.getElementById('x');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } },
  set(v) { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {} },
};
const render = (html) => { root.innerHTML = html; window.scrollTo({ top: 0 }); };
const imgSrc = (p) => (/^https?:/.test(p) ? p : `../app/${p}`);

async function rpc(fn, args) {
  if (DEMO) return demo(fn, args);
  const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: CONFIG.supabaseAnonKey, Authorization: `Bearer ${CONFIG.supabaseAnonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(r.status === 404 ? 'Рентген ещё не запущен — загляните чуть позже.' : data?.message || 'Ошибка сети');
  return data;
}

// ---------- 1. Выбор предмета ----------
function pickView() {
  render(`
    <p class="l-kicker">Бесплатно · без регистрации · 12 минут</p>
    <h1 class="x-title">Рентген ОГЭ</h1>
    <p class="x-sub">10 задач от простых к сложным. В конце — прогноз оценки и номера, на которых ты теряешь баллы.</p>
    <div class="x-pick">
      <button class="x-card" data-s="Математика"><span class="x-ico">📐</span><span><b>Математика</b><span class="muted">Алгебра и геометрия, № 6–18</span></span><span class="x-arrow">→</span></button>
      <button class="x-card" data-s="Физика"><span class="x-ico">⚡</span><span><b>Физика</b><span class="muted">Механика, тепло, электричество, оптика</span></span><span class="x-arrow">→</span></button>
    </div>
    <div class="x-perks"><span>✓ Не знаешь — жми «Не знаю»</span><span>✓ Калькулятор не нужен</span><span>✓ Можно с телефона</span></div>`);
  root.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => start(b.dataset.s)));
}

async function start(subject) {
  render('<div class="x-spin"></div>');
  try {
    const s = await rpc('xray_start', { p_subject: subject });
    const st = { id: s.id, subject, tasks: s.tasks, answers: {}, i: 0 };
    store.set(st);
    taskView(st);
  } catch (e) { errorView(e.message); }
}

// ---------- 2. Задачи по одной ----------
function taskView(st) {
  const t = st.tasks[st.i], n = st.tasks.length, last = st.i === n - 1;
  render(`
    <div class="x-top"><span>${st.i + 1} из ${n}</span><div class="x-bar"><i style="width:${(100 * st.i) / n}%"></i></div><span>${esc(st.subject)}</span></div>
    <form class="card x-q" autocomplete="off">
      <span class="x-num">Задание № ${t.num} · ${esc(t.topic)}</span>
      <div class="x-body">${esc(t.body)}</div>
      ${t.image_path ? `<img class="x-img" src="${esc(imgSrc(t.image_path))}" alt="Рисунок к задаче">` : ''}
      <input class="x-input" name="a" inputmode="decimal" placeholder="Ответ" value="${esc(st.answers[t.id] ?? '')}" aria-label="Ответ">
      <div class="x-actions">
        <button type="button" class="btn btn-ghost" data-skip>Не знаю</button>
        <button class="btn btn-primary">${last ? 'Узнать результат' : 'Дальше'}</button>
      </div>
      <div class="x-nav">${st.i ? '<button type="button" class="link-btn small" data-back>← Назад</button>' : '<span></span>'}
        <span class="hint">Дробь пиши через запятую: 0,5</span></div>
    </form>`);
  const form = root.querySelector('form'), input = form.a;
  if (matchMedia('(pointer: fine)').matches) input.focus();
  const go = (val) => {
    st.answers[t.id] = val;
    if (last) return finish(st);
    st.i += 1; store.set(st); taskView(st);
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); go(input.value.trim() || null); });
  form.querySelector('[data-skip]').addEventListener('click', () => go(null));
  form.querySelector('[data-back]')?.addEventListener('click', () => { st.answers[t.id] = input.value.trim() || null; st.i -= 1; store.set(st); taskView(st); });
}

async function finish(st) {
  render('<div class="x-spin"></div><p class="muted" style="text-align:center">Считаю результат…</p>');
  try {
    const r = await rpc('xray_submit', { p_id: st.id, p_answers: st.answers });
    store.set(null);
    history.replaceState(null, '', `#r=${r.id}`);
    resultView(r);
  } catch (e) { store.set(st); errorView(e.message, () => finish(st)); }
}

// ---------- 3. Результат ----------
const GRADE_COLOR = { 2: 'var(--bad)', 3: 'var(--warn)', 4: 'var(--accent)', 5: 'var(--ok)' };
const GRADE_TEXT = {
  2: 'Сейчас ОГЭ не сдаётся. Хорошая новость: обычно мешают 2–3 конкретные дыры, и они закрываются за 4–6 недель.',
  3: 'Тройка есть, но с запасом в пару баллов. Основные потери — на ошибках, а не на незнании.',
  4: 'Уверенная четвёрка. До пятёрки не хватает нескольких номеров и внимательности.',
  5: 'Сильный результат. Для пятёрки с запасом осталось отточить вторую часть.',
};

function resultView(r) {
  const pct = Math.round((100 * r.correct) / r.total);
  const startLink = `https://t.me/${BOT}?start=xray_${r.id.replace(/-/g, '')}`;
  const bad = r.items.filter((i) => !i.ok);
  render(`
    <div class="card x-result">
      <p class="l-kicker">Рентген ОГЭ · ${esc(r.subject)}</p>
      <div class="x-ring" style="--p:${pct};--c:${GRADE_COLOR[r.grade]}"><div><span class="x-grade">${r.grade}</span><small>прогноз оценки</small></div></div>
      <p class="x-score">Верно <b>${r.correct} из ${r.total}</b> · ориентировочно <b>${r.primary} из ${r.max}</b> первичных баллов</p>
      <p class="muted" style="margin-top:10px">${GRADE_TEXT[r.grade]}</p>
      ${r.geometry_fail ? '<div class="x-note">⚠️ Не решена ни одна задача по геометрии. На ОГЭ без 2 баллов за геометрию ставят «2», даже если остальное решено.</div>' : ''}
      <div class="x-grid">${r.items.map((i) => `<div class="x-cell ${i.ok ? 'ok' : 'bad'}">${i.num}<small>${i.ok ? 'верно' : 'мимо'}</small></div>`).join('')}</div>
      <p class="hint">Номера заданий ОГЭ</p>
      ${r.strong ? `<p class="x-strong">💪 Сильная сторона: <b>${esc(r.strong)}</b></p>` : ''}
    </div>
    ${bad.length ? `
    <div class="card x-lock">
      <b>Найдено ошибок: ${bad.length}. Полный разбор:</b>
      <ul>${bad.slice(0, 3).map((i) => `<li>№ ${i.num}: тема, где ошибка, и сколько баллов она стоит</li>`).join('')}${bad.length > 3 ? `<li>…и ещё ${bad.length - 3}</li>` : ''}
        <li>План подготовки по неделям до экзамена</li><li>3 задачи для тренировки слабой темы</li></ul>
      <div class="x-lock-cta">
        <a class="btn btn-primary" href="${startLink}">Получить разбор в Telegram</a>
        <span class="hint">Бесплатно. Пришлёт бот @${BOT}</span>
      </div>
    </div>` : `
    <div class="card x-lock" style="text-align:center"><b>Ни одной ошибки 🔥</b><p class="muted" style="margin:8px 0 14px">Пора на вторую часть. Забери план в Telegram.</p>
      <a class="btn btn-primary" href="${startLink}">Получить план в Telegram</a></div>`}
    <div class="x-nav" style="margin-top:18px">
      <button class="link-btn small" data-again>Пройти ещё раз</button>
      <button class="link-btn small" data-share>Поделиться результатом</button>
    </div>`);
  root.querySelector('[data-again]').addEventListener('click', () => { history.replaceState(null, '', location.pathname + location.search); pickView(); });
  root.querySelector('[data-share]').addEventListener('click', async () => {
    const text = `Мой прогноз на ОГЭ по предмету «${r.subject}» — ${r.grade}. Проверь себя за 12 минут:`;
    const url = location.origin + location.pathname;
    try { if (navigator.share) await navigator.share({ text, url }); else { await navigator.clipboard.writeText(`${text} ${url}`); alert('Ссылка скопирована'); } } catch {}
  });
}

function errorView(msg, retry) {
  render(`<div class="card x-err"><p>😕 ${esc(msg)}</p><div class="x-actions" style="max-width:360px;margin:16px auto 0">
    ${retry ? '<button class="btn btn-primary" data-retry>Повторить</button>' : ''}<a class="btn btn-ghost" href="https://t.me/${BOT}">Написать в Telegram</a></div></div>`);
  root.querySelector('[data-retry]')?.addEventListener('click', retry);
}

// ---------- Запуск ----------
(async () => {
  const rid = location.hash.match(/^#r=([0-9a-f-]{36})$/)?.[1];
  if (rid) {
    render('<div class="x-spin"></div>');
    try { const r = await rpc('xray_result', { p_id: rid }); if (r?.finished) return resultView(r); } catch {}
  }
  const st = store.get();
  if (st?.tasks?.length && st.i < st.tasks.length) return taskView(st);
  pickView();
})();

// ---------- Демо (?demo) — для проверки вёрстки без базы ----------
function demo(fn, args) {
  const nums = [6, 8, 9, 10, 12, 13, 15, 16, 17, 18];
  if (fn === 'xray_start') return { id: '00000000-0000-4000-8000-000000000000', subject: args.p_subject,
    tasks: nums.map((n) => ({ id: `t${n}`, num: n, topic: 'Демо-тема', body: `Найдите значение выражения ${n} · 2 + 1.`, image_path: n === 18 ? 'img/tasks/m7-1.svg' : null })) };
  const ans = args.p_answers || {};
  const items = nums.map((n) => ({ num: n, ok: String(n * 2 + 1) === ans[`t${n}`] }));
  const correct = items.filter((i) => i.ok).length;
  return { id: '00000000-0000-4000-8000-000000000000', subject: 'Математика', finished: true, correct, total: 10,
    primary: Math.round(correct * 1.9), max: 31, grade: correct >= 9 ? 5 : correct >= 7 ? 4 : correct >= 4 ? 3 : 2,
    geometry_fail: !items.slice(6).some((i) => i.ok) && correct >= 4, strong: correct ? 'Демо-тема' : null, weak_count: 10 - correct, items };
}
