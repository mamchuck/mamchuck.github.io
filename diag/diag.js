// «Диагностика ОГЭ и ЕГЭ»: 10 задач без регистрации → прогноз (оценка ОГЭ / тестовые баллы ЕГЭ) → разбор в Telegram.
// Проверка ответов — только в базе (xray_submit), ответы на страницу не приходят.
import { CONFIG } from '../app/js/config.js?v=202610311516';
import { startFx } from './fx.js?v=202610311516';

const fx = startFx();                         // шейдерный фон (без WebGL — просто пропускается)
const EGE = 'Профильная математика';
const examOf = (subject) => (subject === EGE ? 'ЕГЭ' : 'ОГЭ');

const BOT = 'mamchuck_bot';
const KEY = 'diag';
const DEMO = new URLSearchParams(location.search).has('demo');
const EGE_FIRST = new URLSearchParams(location.search).has('ege');   // пришли из тренажёра ЕГЭ — ЕГЭ первым
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
  if (!r.ok) throw new Error(r.status === 404 ? 'Диагностика ещё не запущена — загляните чуть позже.' : data?.message || 'Ошибка сети');
  return data;
}

// ---------- 1. Выбор предмета ----------
function pickView() {
  const ogeGroup = `
    <p class="x-group">ОГЭ · 9 класс</p>
    <div class="x-pick">
      <button class="x-card" data-s="Математика"><span class="x-ico">📐</span><span><b>Математика</b><span class="muted">Алгебра и геометрия, № 6–18</span></span><span class="x-arrow">→</span></button>
      <button class="x-card" data-s="Физика"><span class="x-ico">⚡</span><span><b>Физика</b><span class="muted">Механика, тепло, электричество, оптика</span></span><span class="x-arrow">→</span></button>
    </div>`;
  const egeGroup = `
    <p class="x-group">ЕГЭ · 11 класс</p>
    <div class="x-pick">
      <button class="x-card x-card-ege" data-s="${EGE}"><span class="x-ico">📈</span><span><b>Профильная математика</b><span class="muted">Планиметрия, вероятность, производная · № 1–12 · прогноз в баллах</span></span><span class="x-arrow">→</span></button>
    </div>`;
  render(`
    <span class="l-chip">● Бесплатно · без регистрации · 12 минут</span>
    <h1 class="x-title">Диагностика <span class="x-grad">ОГЭ и ЕГЭ</span></h1>
    <p class="x-sub">10 задач от простых к сложным. В конце — прогноз результата и номера, на которых ты теряешь баллы.</p>
    ${EGE_FIRST ? egeGroup + ogeGroup : ogeGroup + egeGroup}
    <div class="x-perks"><span>✓ Не знаешь — жми «Не знаю»</span><span>✓ Калькулятор не нужен</span><span>✓ Можно с телефона</span></div>`);
  root.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => start(b.dataset.s)));
  spotlight(root.querySelectorAll('.x-card'));
}

// Подсветка карточки за курсором (координаты — в CSS-переменные)
function spotlight(els) {
  els.forEach((el) => el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`); el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));
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
    <div class="x-top"><span>${st.i + 1} из ${n}</span><div class="x-bar"><i style="width:${(100 * st.i) / n}%"></i></div><span>${examOf(st.subject)} · ${esc(st.subject)}</span></div>
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
const BAND_HEX = { 2: '#dc2626', 3: '#d97706', 4: '#2b8ad8', 5: '#16a34a' };
const EGE_TEXT = {
  2: 'Пока ниже порога ЕГЭ (27 баллов). Порог закрывают первые 5–6 номеров первой части — это реально за 4–6 недель.',
  3: 'Порог пройден. Следующая цель — 50+: доводим первую часть до автоматизма и берём № 13 и № 16.',
  4: 'Хороший задел: 50–69 баллов. Для 70+ нужна стабильная первая часть и 2–3 задачи второй.',
  5: 'Сильный результат: 70+. Для 80–90 добираем вторую часть — экономику, неравенства, планиметрию.',
};
const GRADE_TEXT = {
  2: 'Сейчас ОГЭ не сдаётся. Хорошая новость: обычно мешают 2–3 конкретные дыры, и они закрываются за 4–6 недель.',
  3: 'Тройка есть, но с запасом в пару баллов. Основные потери — на ошибках, а не на незнании.',
  4: 'Уверенная четвёрка. До пятёрки не хватает нескольких номеров и внимательности.',
  5: 'Сильный результат. Для пятёрки с запасом осталось отточить вторую часть.',
};

const TG_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.9 4.3 18.6 19.8c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L5.9 13.3l-4.9-1.5c-1.1-.3-1.1-1.1.2-1.6L20.4 2.8c.9-.3 1.7.2 1.5 1.5z"/></svg>';

function resultView(r) {
  const ege = r.exam === 'ЕГЭ' || r.subject === EGE;
  const pct = ege ? Math.min(100, r.test || 0) : Math.round((100 * r.correct) / r.total);
  const startLink = `https://t.me/${BOT}?start=diag_${r.id.replace(/-/g, '')}`;
  const bad = r.items.filter((i) => !i.ok);
  const weakNums = bad.map((i) => i.num).join(', ');
  render(`
    <ol class="x-steps" aria-label="Шаги">
      <li class="done"><span>✓</span>Диагностика</li>
      <li class="now"><span>2</span>План в Telegram</li>
      <li><span>3</span>Подготовка</li>
    </ol>

    <div class="card x-result">
      <p class="l-eyebrow">Диагностика ${ege ? 'ЕГЭ' : 'ОГЭ'} · ${esc(r.subject)}</p>
      <div class="x-ring" style="--p:0;--c:${GRADE_COLOR[r.grade]}" data-p="${pct}"><div><span class="x-grade ${ege ? 'x-grade-ege' : ''}" data-v="${ege ? r.test : r.grade}">${ege ? 0 : r.grade}</span><small>${ege ? 'прогноз, тестовых баллов' : 'прогноз оценки'}</small></div></div>
      <p class="x-score">Верно <b>${r.correct} из ${r.total}</b> · ориентировочно <b>${r.primary} из ${r.max}</b> первичных баллов</p>
      <p class="muted" style="margin-top:10px">${(ege ? EGE_TEXT : GRADE_TEXT)[r.grade]}</p>
      ${ege ? '<p class="hint" style="margin-top:8px">Порог ЕГЭ — 27 баллов, для вузов обычно от 39. Прогноз ориентировочный: по 10 задачам первой части.</p>' : ''}
      ${r.geometry_fail ? '<div class="x-note">⚠️ Не решена ни одна задача по геометрии. На ОГЭ без 2 баллов за геометрию ставят «2», даже если остальное решено.</div>' : ''}
    </div>

    <section class="x-tg" aria-labelledby="tg-title">
      <div class="x-tg-head">
        <span class="x-tg-ico">${TG_ICON}</span>
        <div><h2 id="tg-title">${bad.length ? 'Твой план подготовки готов' : 'План на пятёрку готов'}</h2>
          <p>${bad.length ? `Составлен по твоим ответам: задания № ${weakNums}` : 'Ошибок нет — план сразу на вторую часть'}</p></div>
      </div>
      <ul class="x-tg-list">
        ${bad.length ? `<li><b>Разбор ${bad.length} ${bad.length === 1 ? 'ошибки' : 'ошибок'}</b> — где именно теряешь баллы и правильные ответы</li>` : ''}
        <li><b>План по неделям</b> до экзамена: что решать и в каком порядке</li>
        <li><b>3 задачи</b> на ${bad.length ? 'самую слабую тему' : 'закрепление'} — с ответами</li>
      </ul>
      <a class="x-tg-btn" href="${startLink}" target="_blank" rel="noopener" data-tg>${TG_ICON}<span>Забрать план в Telegram</span></a>
      <p class="x-tg-free">Бесплатно · придёт за 5 секунд</p>
      <ol class="x-tg-how">
        <li>Откроется бот <b>@${BOT}</b> — нажми <b>«Запустить»</b></li>
        <li>Подпишись на канал <b>@mamchuck_formula</b> — там разборы задач ОГЭ и ЕГЭ</li>
        <li>Бот сразу пришлёт разбор и план</li>
      </ol>
      <div class="x-qr" hidden><div id="qr"></div><span>С телефона удобнее —<br>наведи камеру на код</span></div>
      <p class="x-tg-fallback" hidden>Telegram не открылся? <a href="${startLink}" target="_blank" rel="noopener">Открыть ссылку ещё раз</a> или <button class="link-btn" data-copy>скопировать её</button></p>
    </section>

    <div class="card x-result x-result-grid">
      <div class="x-grid">${r.items.map((i) => `<div class="x-cell ${i.ok ? 'ok' : 'bad'}">${i.num}<small>${i.ok ? 'верно' : 'мимо'}</small></div>`).join('')}</div>
      <p class="hint">Номера заданий ${ege ? 'ЕГЭ' : 'ОГЭ'}</p>
      ${r.strong ? `<p class="x-strong">💪 Сильная сторона: <b>${esc(r.strong)}</b></p>` : ''}
    </div>

    <div class="x-nav" style="margin-top:18px">
      <button class="link-btn small" data-again>Пройти ещё раз</button>
      <button class="link-btn small" data-share>Поделиться результатом</button>
    </div>
    <a class="x-tg-btn x-sticky" href="${startLink}" target="_blank" rel="noopener" data-tg>${TG_ICON}<span>Забрать план в Telegram</span></a>`);

  // Кольцо «набегает» до результата, фон вспыхивает цветом результата
  animateRing(root.querySelector('.x-ring'));
  fx.burst(BAND_HEX[r.grade]);
  spotlight(root.querySelectorAll('.x-result, .x-tg'));

  // Клик → если вкладка не ушла в Telegram, через пару секунд подсказываем запасной путь
  root.querySelectorAll('[data-tg]').forEach((a) => a.addEventListener('click', () => {
    setTimeout(() => { const f = root.querySelector('.x-tg-fallback'); if (f) f.hidden = false; }, 2500);
  }));
  root.querySelector('[data-copy]')?.addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(startLink); e.target.textContent = 'скопировано ✓'; } catch {}
  });
  // Компьютер: QR-код, чтобы открыть план на телефоне
  if (matchMedia('(pointer: fine) and (min-width: 720px)').matches) showQr(startLink);
  // Липкая кнопка видна, только пока основная за экраном и подвал (договор, оферта) ещё не показался
  const main = root.querySelector('.x-tg-btn:not(.x-sticky)'), sticky = root.querySelector('.x-sticky');
  const foot = document.querySelector('.l-foot');
  if ('IntersectionObserver' in window) {
    const seen = new Map();
    const io = new IntersectionObserver((es) => {
      for (const e of es) seen.set(e.target, e.isIntersecting);
      sticky.classList.toggle('show', !seen.get(main) && !seen.get(foot));
    }, { rootMargin: '0px 0px 40px 0px' });
    io.observe(main); if (foot) io.observe(foot);
  }

  root.querySelector('[data-again]').addEventListener('click', () => { history.replaceState(null, '', location.pathname + location.search); pickView(); });
  root.querySelector('[data-share]').addEventListener('click', async () => {
    const text = ege ? `Мой прогноз на ЕГЭ по профильной математике — ≈ ${r.test} баллов. Проверь себя за 12 минут:`
      : `Мой прогноз на ОГЭ по предмету «${r.subject}» — ${r.grade}. Проверь себя за 12 минут:`;
    const url = location.origin + location.pathname;
    try { if (navigator.share) await navigator.share({ text, url }); else { await navigator.clipboard.writeText(`${text} ${url}`); alert('Ссылка скопирована'); } } catch {}
  });
}

function animateRing(ring) {
  if (!ring) return;
  const target = +ring.dataset.p, num = ring.querySelector('[data-v]'), to = +num.dataset.v;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) { ring.style.setProperty('--p', target); num.textContent = to; return; }
  const t0 = performance.now(), dur = 1400, ease = (x) => 1 - (1 - x) ** 3;
  const tick = (now) => {
    const k = ease(Math.min(1, (now - t0) / dur));
    ring.style.setProperty('--p', (target * k).toFixed(1));
    if (num.classList.contains('x-grade-ege')) num.textContent = Math.round(to * k);
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function errorView(msg, retry) {
  render(`<div class="card x-err"><p>😕 ${esc(msg)}</p><div class="x-actions" style="max-width:360px;margin:16px auto 0">
    ${retry ? '<button class="btn btn-primary" data-retry>Повторить</button>' : ''}<a class="btn btn-ghost" href="https://t.me/${BOT}">Написать в Telegram</a></div></div>`);
  root.querySelector('[data-retry]')?.addEventListener('click', retry);
}

function showQr(text) {
  const draw = () => { const el = document.getElementById('qr'); if (!el) return; el.innerHTML = '';
    new window.QRCode(el, { text, width: 132, height: 132, correctLevel: window.QRCode.CorrectLevel.M }); el.parentElement.hidden = false; };
  if (window.QRCode) return draw();
  const sc = document.createElement('script');
  sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  sc.onload = draw; document.head.appendChild(sc);
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
let DEMO_SUBJ = null;
function demo(fn, args) {
  if (fn === 'xray_start') DEMO_SUBJ = args.p_subject;
  const nums = [6, 8, 9, 10, 12, 13, 15, 16, 17, 18];
  if (fn === 'xray_start') return { id: '00000000-0000-4000-8000-000000000000', subject: args.p_subject,
    tasks: nums.map((n) => ({ id: `t${n}`, num: n, topic: 'Демо-тема', body: `Найдите значение выражения ${n} · 2 + 1.`, image_path: n === 18 ? 'img/tasks/m7-1.svg' : null })) };
  const ans = args.p_answers || {};
  const items = nums.map((n) => ({ num: n, ok: String(n * 2 + 1) === ans[`t${n}`] }));
  const correct = items.filter((i) => i.ok).length;
  if (DEMO_SUBJ === EGE) {
    const prim = Math.round(correct * 1.2) + (correct >= 9 ? 4 : correct >= 7 ? 2 : 0);
    const test = [0, 6, 11, 17, 22, 27, 34, 40, 46, 52, 58, 64, 70, 72, 74, 76, 78][Math.min(prim, 16)];
    return { id: '00000000-0000-4000-8000-000000000000', subject: EGE, exam: 'ЕГЭ', finished: true, correct, total: 10, primary: prim, max: 32, test,
      grade: test >= 70 ? 5 : test >= 50 ? 4 : test >= 27 ? 3 : 2, geometry_fail: false, strong: correct ? 'Демо-тема' : null, weak_count: 10 - correct,
      items: items.map((i, k) => ({ ...i, num: [1, 3, 4, 5, 6, 7, 8, 9, 11, 12][k] })) };
  }
  return { id: '00000000-0000-4000-8000-000000000000', subject: 'Математика', finished: true, correct, total: 10,
    primary: Math.round(correct * 1.9), max: 31, grade: correct >= 9 ? 5 : correct >= 7 ? 4 : correct >= 4 ? 3 : 2,
    geometry_fail: !items.slice(6).some((i) => i.ok) && correct >= 4, strong: correct ? 'Демо-тема' : null, weak_count: 10 - correct, items };
}
