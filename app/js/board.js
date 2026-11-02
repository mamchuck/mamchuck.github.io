// Онлайн-доска: у каждого ученика своя, одно бесконечное клетчатое поле. Двигается и масштабируется, открывается на весь экран.
// Перо, маркер-выделитель, ластик (стирает часть линии), картинки/скриншоты. Рисуют оба: преподаватель и ученик.
// Всё хранится в базе (board_pages → board_items), чужие штрихи видны сразу (Realtime + «живой» штрих во время письма).
// Координаты мировые, у всех одинаковые; у каждого участника свой масштаб и положение окна.
// Планшет: со стилусом (Apple Pencil) рисует только стилус, а пальцы и ладонь двигают доску; без стилуса рисует палец, двумя пальцами — сдвиг и масштаб,
// касание двумя пальцами — отменить.
import { toast, confirmDialog, I, $ } from './ui.js?v=202611021941';

const CELL = 40, MIN_Z = 0.1, MAX_Z = 4, MARK_K = 3, MARK_A = 0.38;
const COLORS = [['#1b2330', 'Чёрный'], ['#2563eb', 'Синий'], ['#e5392f', 'Красный'], ['#1f9d55', 'Зелёный'], ['#f08a00', 'Оранжевый'], ['#8b3fd9', 'Фиолетовый'], ['#f5c400', 'Жёлтый'], ['#e64980', 'Розовый'], ['#15aabf', 'Голубой']];
const MORE = [['#868e96', 'Серый'], ['#495057', 'Графит'], ['#8d5524', 'Коричневый'], ['#c92a2a', 'Бордовый'], ['#ff8787', 'Светло-красный'], ['#ffa94d', 'Персиковый'],
  ['#82c91e', 'Салатовый'], ['#2b8a3e', 'Тёмно-зелёный'], ['#0c8599', 'Бирюзовый'], ['#74c0fc', 'Небесный'], ['#0b3d91', 'Тёмно-синий'], ['#4c6ef5', 'Индиго'], ['#da77f2', 'Сиреневый'], ['#5f3dc4', 'Тёмно-фиолетовый'], ['#ffffff', 'Белый']];
const WIDTHS = [[3, 'Тонкое'], [6, 'Среднее'], [12, 'Толстое']];
const ERASE_PX = { 3: 10, 6: 18, 12: 34 };                // радиус ластика на экране для каждой толщины
const uuid = () => crypto.randomUUID();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const q1 = (v) => Math.round(v * 10) / 10;               // координаты с точностью 0,1: при сильном увеличении линия не «ступенчатая»
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } } };
let dispose = null;

const IC = {
  pen: '<path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16z"/><path d="M14 7l3 3"/>',
  marker: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  eraser: '<path d="M8 20h12"/><path d="M5.5 14.5 14 6a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11.5 18.5H8z"/><path d="M9 11l4.5 4.5"/>',
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  hand: '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5m0-1V4.5a1.5 1.5 0 0 1 3 0V11m0-5.5a1.5 1.5 0 0 1 3 0V13m0-4a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1.2a6 6 0 0 1-4.6-2.2L4 15.5a1.6 1.6 0 0 1 2.4-2L8 15"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.7"/><path d="m21 16-5-5-9 9"/>',
  down: '<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  unfull: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
};
const ico = (k) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;

// ---------- Рисование штриха ----------
// Плавная линия: через середины соседних точек проходят квадратичные кривые. Тот же контур и во время письма, и после — линия не «перескакивает».
const PATHS = new WeakMap();                              // готовый контур штриха: строится один раз, а не на каждый кадр
function buildPath(d) {
  const p = d.p, n = p.length / 2, P = new Path2D();
  if (n === 1) { P.arc(p[0], p[1], d.w / 2, 0, Math.PI * 2); return P; }
  P.moveTo(p[0], p[1]);
  for (let i = 1; i < n - 1; i++) P.quadraticCurveTo(p[2 * i], p[2 * i + 1], (p[2 * i] + p[2 * i + 2]) / 2, (p[2 * i + 1] + p[2 * i + 3]) / 2);
  P.lineTo(p[2 * n - 2], p[2 * n - 1]);
  return P;
}
function drawStroke(ctx, d, cache = true) {            // cache=false для штриха, который ещё растёт
  let P = cache && PATHS.get(d);
  if (!P) { P = buildPath(d); if (cache) PATHS.set(d, P); }
  ctx.strokeStyle = ctx.fillStyle = d.c; ctx.lineWidth = d.w; ctx.lineCap = ctx.lineJoin = 'round';
  if (d.h) ctx.globalAlpha = MARK_A;                      // маркер полупрозрачный: формула под ним видна
  if (d.p.length === 2) ctx.fill(P); else ctx.stroke(P);
  if (d.h) ctx.globalAlpha = 1;
}
// Упрощение линии (Рамер — Дуглас — Пекер): меньше точек — быстрее рисуется, меньше уходит по сети и лежит в базе
function simplify(p, eps) {
  const n = p.length / 2; if (n < 3) return p;
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) { const d = segDist(p[2 * i], p[2 * i + 1], p[2 * a], p[2 * a + 1], p[2 * b], p[2 * b + 1]); if (d > max) { max = d; idx = i; } }
    if (max > eps && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(p[2 * i], p[2 * i + 1]);
  return out;
}
// Всё, что пришло из базы или по сети, проверяем: чужие данные не должны ломать доску
const HEX = /^#[0-9a-f]{6}$/i, fin = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e6;
function sane(kind, d, studentId) {
  if (!d || typeof d !== 'object') return false;
  if (kind === 'stroke') return Array.isArray(d.p) && d.p.length >= 2 && d.p.length <= 20000 && d.p.length % 2 === 0 && d.p.every(fin) && fin(d.w) && d.w >= 1 && d.w <= 60 && typeof d.c === 'string' && HEX.test(d.c) && (d.h === undefined || d.h === 1);
  if (kind === 'img') return okPath(d.path, studentId) && [d.x, d.y, d.w, d.h].every(fin) && d.w > 0 && d.h > 0 && d.w < 20000 && d.h < 20000;
  return false;
}
const okPath = (p, studentId) => typeof p === 'string' && p.startsWith(`${studentId}/board/`) && !p.includes('..') && p.length < 200;
const bboxOf = (it) => {
  if (it._bb) return it._bb;
  const d = it.data;
  if (it.kind === 'img') return (it._bb = [d.x, d.y, d.x + d.w, d.y + d.h]);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < d.p.length; i += 2) { x0 = Math.min(x0, d.p[i]); x1 = Math.max(x1, d.p[i]); y0 = Math.min(y0, d.p[i + 1]); y1 = Math.max(y1, d.p[i + 1]); }
  return (it._bb = [x0, y0, x1, y1]);
};
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function strokeHit(it, x, y, r) {
  const m = r + it.data.w / 2, [x0, y0, x1, y1] = bboxOf(it);
  if (x < x0 - m || x > x1 + m || y < y0 - m || y > y1 + m) return false;
  const p = it.data.p;
  if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) <= m;
  for (let i = 0; i < p.length - 2; i += 2) if (segDist(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= m) return true;
  return false;
}
// Ластик стирает часть линии: штрих режется на куски вне круга ластика. Возвращает null, если круг линию не задел.
function cutStroke(d, x, y, r) {
  const R = r + d.w / 2, R2 = R * R, s = Math.max(0.4, R / 3), p = d.p, out = [];
  let part = [], hit = false;
  const add = (px, py) => {
    if ((px - x) ** 2 + (py - y) ** 2 < R2) { hit = true; if (part.length) { out.push(part); part = []; } }
    else part.push(px, py);
  };
  add(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2], ay = p[i - 1], bx = p[i], by = p[i + 1];
    if (segDist(x, y, ax, ay, bx, by) > R) { add(bx, by); continue; }         // отрезок далеко от ластика: делить не нужно
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / s));
    for (let k = 1; k <= n; k++) add(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n);
  }
  if (!hit) return null;
  if (part.length) out.push(part);
  return out.map((q) => ({ ...d, p: simplify(q.map(q1), 0.25) }));
}
function drawGrid(g, x0, y0, x1, y1, z) {
  const px = CELL * z;                                  // клетка на экране в пикселях
  if (px * 5 < 7) return;                               // слишком мелко: клетку не рисуем
  const step = px < 9 ? CELL * 5 : CELL;
  g.lineWidth = 1 / z;
  for (const major of [false, true]) {
    g.strokeStyle = major ? '#c2d5ec' : '#dde9f6'; g.beginPath();
    for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) if ((Math.round(x / CELL) % 5 === 0) === major) { g.moveTo(x, y0); g.lineTo(x, y1); }
    for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) if ((Math.round(y / CELL) % 5 === 0) === major) { g.moveTo(x0, y); g.lineTo(x1, y); }
    g.stroke();
  }
}

export { sane, simplify, cutStroke };

export async function mountBoard(root, { api, studentId, canWrite = true, isTutor = false }) {
  dispose?.();
  root.innerHTML = '<div class="loading-block"><span class="spin"></span></div>';

  // Доска у ученика одна: единственный «лист» создаётся при первом открытии (кем угодно из своих, дубли база не даёт)
  const getPage = async () => (await api.select('board_pages', { eq: { student_id: studentId }, order: 'created_at' }))[0];
  let page = await getPage();
  if (!page && canWrite) { try { await api.insert('board_pages', { student_id: studentId, title: '' }); } catch { /* уже создал второй участник */ } page = await getPage(); }
  if (!page) {
    root.innerHTML = `<div class="empty">${I.note?.s || ''}<p>Доска появится, когда её откроет ученик или преподаватель.</p></div>`;
    return;
  }

  // ---------- Состояние ----------
  const items = new Map();                      // id → { id, kind, data, sync: 'pending' | 'live' | 'db' }
  const mine = [];                              // id моих последних объектов (для «отменить»)
  const live = new Map();                       // чужие штрихи, которые ещё пишутся: id → { d }
  const imgCache = new Map();                   // path → { el, p, failed }
  const touches = new Map();                    // принятые пальцы: id → { x, y } (ладонь при письме стилусом сюда не попадает)
  const view = { x: 0, y: 0, z: 0.7 };          // окно: мировая точка левого верхнего угла и масштаб
  const pref = store.get('bd.pen') || {};
  let tool = 'pen', color = HEX.test(pref.c) ? pref.c : COLORS[1][0], width = WIDTHS.some(([w]) => w === pref.w) ? pref.w : WIDTHS[1][0];
  // Пальцем рисуем на планшете и телефоне, пока не появится стилус: тогда палец и ладонь двигают доску. Кнопка ☝ переключает вручную.
  const fingerPref = store.get('bd.finger');
  let fingerDraw = canWrite && (typeof fingerPref === 'boolean' ? fingerPref : matchMedia('(pointer: coarse)').matches);
  let penDown = false, penUpAt = 0, tapUndo = false;
  let spaceDown = false, full = false, selected = null, cur = null, drag = null, pan = null, gesture = null, eraser = null;
  let busy = 0, raf = 0, needBase = false, needOver = false, pdpr = 1, loadToken = 0;
  const unsub = [];
  const bad = new Set();                        // строки в базе, которые не прошли проверку (в сравнении с базой не учитываем)

  const dot = (c, n, on) => `<button class="bd-dot${on ? ' on' : ''}" data-color="${c}" style="--c:${c}" title="${n}" aria-label="${n}"></button>`;
  const inMain = COLORS.some(([c]) => c === color);
  root.innerHTML = `
    <div class="bd" id="bd">
      <div class="bd-bar card">
        <div class="bd-grp" role="group" aria-label="Инструменты">
          ${canWrite ? `<button class="bd-btn on" data-tool="pen" title="Перо (P)" aria-label="Перо">${ico('pen')}</button>
          <button class="bd-btn" data-tool="marker" title="Маркер-выделитель (M)" aria-label="Маркер">${ico('marker')}</button>
          <button class="bd-btn" data-tool="eraser" title="Ластик (E): стирает часть линии, размер — кнопками толщины" aria-label="Ластик">${ico('eraser')}</button>
          <button class="bd-btn" data-tool="move" title="Двигать картинки (V)" aria-label="Двигать картинки">${ico('move')}</button>` : ''}
          <button class="bd-btn${canWrite ? '' : ' on'}" data-tool="hand" title="Двигать доску (H, или зажать пробел)" aria-label="Двигать доску">${ico('hand')}</button>
        </div>
        ${canWrite ? `
        <div class="bd-grp bd-colors" role="group" aria-label="Цвет">${COLORS.map(([c, n]) => dot(c, n, c === color)).join('')}
          <button class="bd-dot bd-more${inMain ? '' : ' on'}" id="bd-more" style="--c:${inMain ? 'transparent' : color}" title="Другие цвета" aria-label="Другие цвета" aria-expanded="false">${inMain ? '+' : ''}</button>
        </div>
        <div class="bd-grp" role="group" aria-label="Толщина">${WIDTHS.map(([w, n]) => `<button class="bd-w${w === width ? ' on' : ''}" data-w="${w}" title="${n}" aria-label="${n}"><i style="height:${Math.round(w / 2) + 1}px"></i></button>`).join('')}</div>
        <div class="bd-grp">
          <button class="bd-btn" id="bd-undo" title="Отменить (Ctrl+Z, на планшете — касание двумя пальцами)" aria-label="Отменить">${ico('undo')}</button>
          <button class="bd-btn" id="bd-img" title="Добавить картинку или скриншот (можно просто вставить Ctrl+V)" aria-label="Добавить картинку">${ico('image')}</button>
          <button class="bd-btn bd-touch${fingerDraw ? ' on' : ''}" id="bd-finger" title="Рисовать пальцем (иначе палец двигает доску)" aria-pressed="${fingerDraw}" aria-label="Рисовать пальцем">☝</button>
        </div>` : ''}
        <div class="bd-grp" role="group" aria-label="Масштаб">
          <button class="bd-btn" id="bd-zout" title="Уменьшить (−)" aria-label="Уменьшить">${ico('minus')}</button>
          <button class="bd-zoom" id="bd-zlabel" title="Масштаб 100%" aria-label="Сбросить масштаб">70%</button>
          <button class="bd-btn" id="bd-zin" title="Увеличить (+)" aria-label="Увеличить">${ico('plus')}</button>
          <button class="bd-btn" id="bd-fit" title="Показать всё, что нарисовано (0)" aria-label="Показать всё">${ico('fit')}</button>
        </div>
        <div class="bd-grp bd-right">
          <span class="bd-conn off" id="bd-conn" role="img" aria-label="Связь"></span>
          <button class="bd-btn" id="bd-save" title="Скачать доску картинкой" aria-label="Скачать доску">${ico('down')}</button>
          ${isTutor ? `<button class="bd-btn" id="bd-clear" title="Очистить доску" aria-label="Очистить доску">${ico('trash')}</button>` : ''}
          <button class="bd-btn" id="bd-full" title="На весь экран (F)" aria-label="На весь экран">${ico('full')}</button>
        </div>
      </div>
      ${canWrite ? `<div class="bd-pop card" id="bd-pop" hidden>${MORE.map(([c, n]) => dot(c, n, c === color)).join('')}
        <label class="bd-dot bd-custom" title="Свой цвет" aria-label="Свой цвет"><input type="color" id="bd-pick" value="${color}"></label></div>` : ''}
      <div class="bd-stage" id="bd-stage"><canvas id="bd-cv"></canvas><canvas id="bd-ov"></canvas><div class="bd-note" id="bd-status" aria-live="polite"></div></div>
      <input type="file" id="bd-file" accept="image/*" hidden>
    </div>`;
  // Два слоя: нижний — всё сохранённое (перерисовывается только при сдвиге, масштабе и изменениях), верхний — то, что пишется сейчас.
  // Пока пишешь, каждый кадр перерисовывается только верхний слой с одним штрихом, а не вся доска.
  const bd = $('#bd', root), stage = $('#bd-stage', root), base = $('#bd-cv', root), cv = $('#bd-ov', root);
  const ctx = base.getContext('2d', { alpha: false }), oc = cv.getContext('2d');
  const status = $('#bd-status', root), zlabel = $('#bd-zlabel', root), pop = $('#bd-pop', root);
  if (!canWrite) tool = 'hand';

  // Положение холста на странице кэшируем: не дёргаем раскладку на каждое движение
  let rect = cv.getBoundingClientRect();
  const refreshRect = () => { rect = cv.getBoundingClientRect(); };

  // ---------- Вид: масштаб и положение ----------
  const setZoomLabel = () => { zlabel.textContent = `${Math.round(view.z * 100)}%`; };
  function zoomAt(z2, cx = stage.clientWidth / 2, cy = stage.clientHeight / 2) {
    z2 = clamp(z2, MIN_Z, MAX_Z);
    const wx = view.x + cx / view.z, wy = view.y + cy / view.z;
    view.z = z2; view.x = wx - cx / z2; view.y = wy - cy / z2;
    setZoomLabel(); redraw();
  }
  function fitContent() {
    const sw = stage.clientWidth || 800, sh = stage.clientHeight || 500;
    let b = null;
    for (const it of items.values()) { const x = bboxOf(it); b = b ? [Math.min(b[0], x[0]), Math.min(b[1], x[1]), Math.max(b[2], x[2]), Math.max(b[3], x[3])] : [...x]; }
    if (!b) { view.z = clamp(sw / 1400, 0.35, 1); view.x = 0; view.y = 0; }
    else {
      const pad = 60, bw = b[2] - b[0] + pad * 2, bh = b[3] - b[1] + pad * 2;
      view.z = clamp(Math.min(sw / bw, sh / bh), MIN_Z, 1.2);
      view.x = (b[0] + b[2]) / 2 - sw / 2 / view.z; view.y = (b[1] + b[3]) / 2 - sh / 2 / view.z;
    }
    setZoomLabel(); redraw();
  }

  // ---------- Отрисовка ----------
  const tf = (g) => { const k = pdpr * view.z; g.setTransform(k, 0, 0, k, -view.x * k, -view.y * k); };
  function frame() {
    raf = 0; if (!root.isConnected) return;
    const cw = stage.clientWidth, ch = stage.clientHeight; if (!cw || !ch) return;
    pdpr = Math.min(2, window.devicePixelRatio || 1);
    const pw = Math.round(cw * pdpr), ph = Math.round(ch * pdpr);
    if (base.width !== pw || base.height !== ph) { base.width = cv.width = pw; base.height = cv.height = ph; needBase = needOver = true; }
    if (needBase) { needBase = false; paintBase(cw, ch); }
    if (needOver) { needOver = false; paintOver(); }
  }
  function paintBase(cw, ch) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, base.width, base.height);
    tf(ctx);
    const vx0 = view.x, vy0 = view.y, vx1 = view.x + cw / view.z, vy1 = view.y + ch / view.z;
    drawGrid(ctx, vx0, vy0, vx1, vy1, view.z);
    const seen = (it, m = 0) => { const b = bboxOf(it); return b[2] + m >= vx0 && b[0] - m <= vx1 && b[3] + m >= vy0 && b[1] - m <= vy1; };
    for (const it of items.values()) if (it.kind === 'img' && seen(it)) {
      const el = getImg(it.data.path), d = it.data;
      if (el) ctx.drawImage(el, d.x, d.y, d.w, d.h);
      else { ctx.fillStyle = '#eef3f9'; ctx.fillRect(d.x, d.y, d.w, d.h); ctx.fillStyle = '#8aa0b8'; ctx.font = '28px sans-serif'; ctx.fillText(imgCache.get(d.path)?.failed ? 'Не удалось загрузить' : 'Загрузка…', d.x + 20, d.y + 44); }
    }
    for (const h of [1, 0]) for (const it of items.values()) if (it.kind === 'stroke' && !it.data.h === !h && seen(it, it.data.w)) drawStroke(ctx, it.data);   // маркер под чернилами
  }
  function paintOver() {
    oc.setTransform(1, 0, 0, 1, 0, 0); oc.clearRect(0, 0, cv.width, cv.height);
    tf(oc);
    for (const l of live.values()) drawStroke(oc, l.d, false);
    if (cur) drawStroke(oc, cur.d, false);
    const sel = selected && items.get(selected), s = 1 / view.z;
    if (sel) {
      const d = sel.data; oc.strokeStyle = '#2563eb'; oc.lineWidth = 3 * s; oc.setLineDash([12 * s, 8 * s]); oc.strokeRect(d.x, d.y, d.w, d.h); oc.setLineDash([]);
      oc.fillStyle = '#2563eb'; oc.fillRect(d.x + d.w - 8 * s, d.y + d.h - 8 * s, 16 * s, 16 * s);
    }
    if (eraser) { oc.beginPath(); oc.arc(eraser.x, eraser.y, eraseR(), 0, Math.PI * 2); oc.fillStyle = 'rgba(37,99,235,.08)'; oc.fill(); oc.strokeStyle = 'rgba(27,35,48,.55)'; oc.lineWidth = 1.5 * s; oc.stroke(); }
  }
  const sched = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const redraw = () => { needBase = needOver = true; sched(); };
  const redrawOver = () => { needOver = true; sched(); };
  // Новый штрих дорисовываем поверх нижнего слоя, без перерисовки всей доски
  const appendBase = (it) => { if (needBase || !base.width || it.kind !== 'stroke') { if (it.kind !== 'stroke') redraw(); return; } tf(ctx); drawStroke(ctx, it.data); };
  const eraseR = () => ERASE_PX[width] / view.z;

  // ---------- Картинки ----------
  function loadImg(path) {
    let e = imgCache.get(path);
    if (e) return e.p;
    e = { el: null, failed: false };
    e.p = api.fileUrl(path).then((url) => new Promise((res) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { e.el = im; res(im); redraw(); };
      im.onerror = () => { e.failed = true; res(null); redraw(); };
      im.src = url;
    })).catch(() => { e.failed = true; redraw(); return null; });
    imgCache.set(path, e);
    return e.p;
  }
  const getImg = (path) => { const e = imgCache.get(path); if (!e) { loadImg(path); return null; } return e.el; };

  async function addImage(file) {
    if (!canWrite || !file || !file.type.startsWith('image/')) return;
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 1600 / bmp.width), c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
      const path = `${studentId}/board/${uuid()}.jpg`;
      const w = Math.round(Math.min(c.width, 900, (stage.clientWidth / view.z) * 0.7)), hgt = Math.round(w * c.height / c.width);
      const data = { path, x: Math.round(view.x + 40 / view.z), y: Math.round(view.y + 40 / view.z), w, h: hgt };
      const id = uuid(), item = { id, kind: 'img', data, sync: 'pending' };
      imgCache.set(path, { el: c, p: Promise.resolve(c), failed: false });
      items.set(id, item); selected = id; setTool('move'); redraw();
      busy++; showSave();
      try { await api.upload(path, blob); await api.insert('board_items', { id, page_id: page.id, student_id: studentId, kind: 'img', data }); item.sync = 'db'; mine.push(id); }
      catch (e) { items.delete(id); selected = null; toast(`Не удалось добавить картинку: ${e.message}`, 'error'); redraw(); }
      busy--; showSave();
    } catch { toast('Не удалось прочитать картинку', 'error'); }
  }

  // ---------- Сохранение ----------
  // Штрихи не пишутся в базу по одному: копятся в очереди и уходят пачкой. Нет сети — очередь ждёт и повторяет, с доски ничего не пропадает.
  // Надпись «Сохраняю…» появляется только если сохранение затянулось, а не мигает на каждой букве.
  const outbox = new Map(), inflight = new Set();
  let flushT = 0, flushP = null, fails = 0, delQ = [], delT = 0, delBusy = 0, delFail = false, warnT = 0, okT = 0, shown = '';
  const netErr = (e) => /fetch|network|load failed|timeout|connection|offline|abort/i.test(e?.message || '') || navigator.onLine === false;
  const unsaved = () => outbox.size + delQ.length + delBusy + busy;
  function setStatus(text, s) { shown = s; status.textContent = text; status.dataset.s = s; $('#bd-conn', root)?.classList.toggle('warn', s === 'warn'); }
  function showSave() {
    if (!unsaved()) {
      clearTimeout(warnT); warnT = 0;
      if (shown === 'warn') { setStatus('✓ Сохранено', 'ok'); clearTimeout(okT); okT = setTimeout(() => { if (shown === 'ok') setStatus('', ''); }, 2500); }
      return;
    }
    if (fails || delFail) setStatus(navigator.onLine === false ? 'Нет сети — сохраню, когда появится' : 'Сохраняю… (связь плохая, повторяю)', 'warn');
    else if (!warnT && shown !== 'warn') warnT = setTimeout(() => { warnT = 0; if (drag?.erase) showSave(); else if (unsaved()) setStatus('Сохраняю…', 'warn'); }, 2500);
  }
  function queue(it) { outbox.set(it.id, it); schedFlush(350); }
  function schedFlush(ms) { if (!flushT) flushT = setTimeout(() => { flushT = 0; flush(); }, ms); showSave(); }
  async function insertRows(rows) {
    try { await api.insertMany('board_items', rows); }
    catch (e) {                                                // после обрыва связи часть пачки могла уже записаться: досылаем по одной, дубли пропускаем
      if (!/duplicate key/i.test(e.message)) throw e;
      for (const r of rows) { try { await api.insert('board_items', r); } catch (e2) { if (!/duplicate key/i.test(e2.message)) throw e2; } }
    }
  }
  function flush() {
    if (flushP || !outbox.size) return flushP;
    if (drag?.erase) { schedFlush(300); return null; }       // пока стираешь, куски линии ещё меняются: отправим, когда отпустишь
    const batch = [...outbox.values()].slice(0, 200);
    batch.forEach((it) => inflight.add(it.id));
    const rows = batch.map((it) => ({ id: it.id, page_id: page.id, student_id: studentId, kind: it.kind, data: it.data }));
    flushP = (async () => {
      try { await insertRows(rows); for (const it of batch) { outbox.delete(it.id); if (it.sync === 'pending') it.sync = 'db'; } fails = 0; }
      catch (e) {
        fails++;
        if (!netErr(e) && fails >= 4) {                       // не сеть, а отказ базы: повторять бесполезно
          for (const it of batch) { outbox.delete(it.id); items.delete(it.id); }
          fails = 0; redraw(); toast(`Часть доски не сохранилась: ${e.message}`, 'error');
        }
      } finally { batch.forEach((it) => inflight.delete(it.id)); flushP = null; }
      if (outbox.size) schedFlush(fails ? Math.min(15000, 1000 * 2 ** Math.min(fails, 4)) : 30);
      showSave();
    })();
    return flushP;
  }
  // Ластик и «отменить» удаляют пачкой; то, что ещё не ушло в базу, просто убираем из очереди
  function flushDel() {
    clearTimeout(delT); delT = 0;
    const ids = delQ; delQ = []; if (!ids.length) return;
    delBusy++;
    (async () => {
      try { if (flushP) await flushP; await api.removeMany('board_items', ids); delFail = false; }
      catch { delQ.push(...ids); delFail = true; if (!delT) delT = setTimeout(flushDel, 3000); }
      finally { delBusy--; showSave(); }
    })();
  }
  function del(it, { file = true } = {}) {
    items.delete(it.id); if (selected === it.id) selected = null;
    const i = mine.indexOf(it.id); if (i >= 0) mine.splice(i, 1);
    const queued = outbox.delete(it.id);
    if (!queued || inflight.has(it.id)) { delQ.push(it.id); if (!delT) delT = setTimeout(flushDel, 200); }
    if (file && it.kind === 'img' && okPath(it.data.path, studentId)) api.removeFile(it.data.path).catch(() => {});
    showSave(); redraw();
  }

  // ---------- Живой штрих ----------
  const chan = api.live(`board-live:${studentId}`, (m) => {
    if (!root.isConnected || !m || m.page !== page.id || typeof m.id !== 'string' || m.id.length > 40 || items.has(m.id)) return;
    if (m.x) { if (live.delete(m.id)) redrawOver(); return; }  // штрих отменён (например, коснулись вторым пальцем)
    if (!Array.isArray(m.p) || m.p.length > 2000 || !m.p.every(fin) || !fin(m.w) || m.w < 1 || m.w > 60 || typeof m.c !== 'string' || !HEX.test(m.c)) return;
    let l = live.get(m.id);
    if (!l) { if (live.size >= 50) return; live.set(m.id, l = { d: { c: m.c, w: m.w, p: [], ...(m.h === 1 ? { h: 1 } : {}) } }); }
    if (l.d.p.length + m.p.length > 20000) return;
    l.d.p.push(...m.p);
    if (m.end) {                                                // штрих дописан: оставляем его на доске, база подтвердит чуть позже
      live.delete(m.id);
      if (sane('stroke', l.d, studentId)) { const it = { id: m.id, kind: 'stroke', data: l.d, sync: 'live', t: Date.now() }; items.set(m.id, it); appendBase(it); }
    }
    redrawOver();
  });
  function sendLive(force = false, end = false) {
    const now = Date.now();
    if (!cur || (!force && now - cur.t < 50)) return;
    const p = cur.d.p;
    let from = Math.max(0, cur.sent - 2);                      // с запасом в одну точку, чтобы линия не рвалась
    do {
      const to = Math.min(p.length, from + 1000), last = to >= p.length;
      chan.send({ id: cur.id, page: page.id, c: cur.d.c, w: cur.d.w, h: cur.d.h, p: p.slice(from, to), end: end && last });
      from = to - 2;
      if (last) break;
    } while (true);
    cur.sent = p.length; cur.t = now;
  }

  // ---------- Указатель ----------
  const pt = (e) => [view.x + (e.clientX - rect.left) / view.z, view.y + (e.clientY - rect.top) / view.z];
  const imgAt = (x, y) => { const l = [...items.values()].filter((i) => i.kind === 'img'); for (let i = l.length - 1; i >= 0; i--) { const d = l[i].data; if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return l[i]; } return null; };
  function eraseAt(x, y) {
    const r = eraseR();
    for (const it of [...items.values()]) {
      if (it.kind !== 'stroke' || !strokeHit(it, x, y, r)) continue;
      const parts = cutStroke(it.data, x, y, r); if (!parts) continue;
      del(it);
      for (const d of parts) { const n = { id: uuid(), page_id: page.id, kind: 'stroke', data: d, sync: 'pending' }; items.set(n.id, n); queue(n); }
    }
  }
  function eraseTo(x, y) {                                       // быстрый взмах: стираем и между соседними точками, без пропусков
    const r = eraseR(), dx = x - drag.lx, dy = y - drag.ly, n = Math.min(60, Math.ceil(Math.hypot(dx, dy) / (r * 0.5)));
    for (let k = 1; k <= n; k++) eraseAt(drag.lx + (dx * k) / n, drag.ly + (dy * k) / n);
    drag.lx = x; drag.ly = y;
  }
  const mid = () => { const a = [...touches.values()]; return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1 }; };
  function dropStroke() { if (!cur) return; chan.send({ id: cur.id, page: page.id, x: 1 }); cur = null; redrawOver(); }
  function finishStroke() {
    if (!cur) return;
    sendLive(true, true);
    cur.d.p = simplify(cur.d.p, clamp(0.35 / view.z, 0.08, 1.2));   // упрощаем не заметнее полпикселя на экране
    const item = { id: cur.id, page_id: page.id, kind: 'stroke', data: cur.d, sync: 'pending' };
    items.set(item.id, item); mine.push(item.id); cur = null;
    appendBase(item); redrawOver(); queue(item);
  }
  function startStroke(e, x, y) {
    const d = { c: color, w: tool === 'marker' ? width * MARK_K : width, p: [q1(x), q1(y)] };
    if (tool === 'marker') d.h = 1;
    cur = { id: uuid(), type: e.pointerType, t0: performance.now(), sent: 0, t: 0, d };
    sendLive(true); redrawOver();
  }
  // Второй палец коснулся, пока первый рисовал: короткий «штрих» — это начало щипка, его выбрасываем; длинный сохраняем
  function endFingerWork() {
    if (cur?.type === 'touch') { if (performance.now() - cur.t0 < 250 || cur.d.p.length < 10) dropStroke(); else finishStroke(); }
    if (drag) { drag = null; eraser = null; schedFlush(100); redrawOver(); }
  }
  const capture = (id) => { try { cv.setPointerCapture(id); } catch { /* указатель уже отпущен */ } };
  const startPan = (e) => { pan = { id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; stage.classList.add('panning'); };

  function down(e) {
    refreshRect();
    if (e.pointerType === 'pen') {
      penDown = true;
      // Стилус найден: ладонь больше не рисует. Касания, которые уже были на экране (ладонь), забываем.
      if (fingerDraw && typeof store.get('bd.finger') !== 'boolean') { setFinger(false, false); if (!store.get('bd.penTip')) { store.set('bd.penTip', true); toast('Стилус: рисует он, а пальцем двигаем доску. Кнопка ☝ — рисовать пальцем'); } }
      if (cur?.type === 'touch') dropStroke();
      if (pan && touches.has(pan.id)) { pan = null; stage.classList.remove('panning'); }
      touches.clear(); gesture = null; tapUndo = false;
      if (drag && !drag.pen) { drag = null; eraser = null; }
    }
    if (e.pointerType === 'touch') {
      if (penDown || performance.now() - penUpAt < 300) return;   // ладонь во время письма стилусом
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      capture(e.pointerId);
      if (touches.size === 2) {
        endFingerWork(); pan = null; stage.classList.remove('panning');
        const m = mid();
        gesture = { d0: m.d, z0: view.z, mx: m.x, my: m.y, t0: performance.now(), moved: false, wx: view.x + (m.x - rect.left) / view.z, wy: view.y + (m.y - rect.top) / view.z };
        return;
      }
      if (touches.size > 2) { gesture && (gesture.moved = true); return; }
      if (!fingerDraw || !canWrite || tool === 'hand') { e.preventDefault(); startPan(e); return; }
    } else capture(e.pointerId);
    if (e.button === 1 || e.button === 2 || tool === 'hand' || spaceDown || !canWrite) { e.preventDefault(); startPan(e); return; }
    if (e.button > 0) return;
    e.preventDefault();
    const [x, y] = pt(e);
    if (tool === 'pen' || tool === 'marker') startStroke(e, x, y);
    else if (tool === 'eraser') { drag = { erase: true, pen: e.pointerType === 'pen', lx: x, ly: y }; eraser = { x, y }; eraseAt(x, y); redrawOver(); }
    else if (tool === 'move') {
      const sel = selected && items.get(selected), d = sel?.data, tol = 24 / view.z;
      if (d && Math.abs(x - (d.x + d.w)) < tol && Math.abs(y - (d.y + d.h)) < tol) drag = { id: sel.id, resize: true, x0: x, w0: d.w, h0: d.h, moved: false };
      else { const hit = imgAt(x, y); selected = hit ? hit.id : null; drag = hit ? { id: hit.id, x0: x, y0: y, ox: hit.data.x, oy: hit.data.y, moved: false } : null; redrawOver(); }
    }
  }
  function move(e) {
    if (e.pointerType === 'touch') { if (!touches.has(e.pointerId)) return; touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); }
    if (gesture) {                                              // два пальца: масштаб и сдвиг
      if (touches.size < 2) return;
      const m = mid(), z = clamp(gesture.z0 * m.d / gesture.d0, MIN_Z, MAX_Z);
      if (!gesture.moved && (Math.abs(m.d - gesture.d0) > 12 || Math.hypot(m.x - gesture.mx, m.y - gesture.my) > 12)) gesture.moved = true;
      if (!gesture.moved) return;
      view.z = z; view.x = gesture.wx - (m.x - rect.left) / z; view.y = gesture.wy - (m.y - rect.top) / z;
      setZoomLabel(); redraw(); return;
    }
    if (pan) {
      if (pan.id !== e.pointerId) return;
      view.x = pan.vx - (e.clientX - pan.sx) / view.z; view.y = pan.vy - (e.clientY - pan.sy) / view.z; redraw(); return;
    }
    if (!cur && !drag) {                                        // ластик мышью или стилусом на весу: показываем кружок
      if (tool === 'eraser' && e.pointerType !== 'touch') { const [x, y] = pt(e); eraser = { x, y }; redrawOver(); }
      return;
    }
    const co = (cur || drag?.erase) && e.getCoalescedEvents?.(), evs = co?.length ? co : [e];
    for (const ev of evs) {
      const [x, y] = pt(ev);
      if (cur) {
        const p = cur.d.p, rx = q1(x), ry = q1(y);
        if (Math.hypot(rx - p[p.length - 2], ry - p[p.length - 1]) < 0.8 / view.z) continue;
        p.push(rx, ry);
        if (p.length >= 19000) { finishStroke(); startStroke(e, x, y); }   // очень длинная линия: продолжаем новым штрихом
      } else if (drag?.erase) { eraseTo(x, y); eraser = { x, y }; }
      else if (drag) {
        const it = items.get(drag.id); if (!it) continue; const d = { ...it.data };
        if (drag.resize) { const nw = Math.max(80, drag.w0 + (x - drag.x0)); d.w = Math.round(nw); d.h = Math.round(nw * drag.h0 / drag.w0); }
        else { d.x = Math.round(drag.ox + x - drag.x0); d.y = Math.round(drag.oy + y - drag.y0); }
        drag.moved = true; it.data = d; it._bb = null; redraw();
      }
    }
    if (cur) { sendLive(); redrawOver(); } else if (drag?.erase) redrawOver();
  }
  function up(e) {
    if (e.pointerType === 'pen') { penDown = false; penUpAt = performance.now(); }
    if (e.pointerType === 'touch') {
      if (!touches.delete(e.pointerId)) return;                 // ладонь, которую мы не принимали
      if (gesture) {
        if (!gesture.moved && performance.now() - gesture.t0 < 350 && canWrite) tapUndo = true;
        if (touches.size < 2) gesture = null;
        if (!touches.size && tapUndo) { tapUndo = false; undo(); }
        return;
      }
      if (!touches.size && tapUndo) { tapUndo = false; undo(); return; }
    }
    if (pan) { if (pan.id === e.pointerId) { pan = null; stage.classList.remove('panning'); } return; }
    if (cur) finishStroke();
    else if (drag?.erase) { eraser = e.pointerType === 'touch' ? null : eraser; schedFlush(100); redrawOver(); }
    else if (drag?.moved) {
      const it = items.get(drag.id);
      if (it) { busy++; showSave(); api.update('board_items', it.id, { data: it.data }).catch((er) => toast(`Не удалось сохранить: ${er.message}`, 'error')).finally(() => { busy--; showSave(); }); }
    }
    drag = null;
  }
  cv.addEventListener('contextmenu', (e) => e.preventDefault());      // правая кнопка — двигать доску, а не меню
  cv.addEventListener('pointerdown', down);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', (e) => { if (eraser && !drag && e.pointerType !== 'touch') { eraser = null; redrawOver(); } });
  // iPad/iPhone: без этого Safari на долгом касании показывает лупу и выделение, а щипком масштабирует всю страницу
  const noTouch = (e) => e.preventDefault();
  stage.addEventListener('touchstart', noTouch, { passive: false });
  stage.addEventListener('touchmove', noTouch, { passive: false });
  stage.addEventListener('gesturestart', noTouch);
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), u = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1;   // Firefox отдаёт строки, а не пиксели
    const dx = e.deltaX * u, dy = e.deltaY * u;
    if (e.ctrlKey || e.metaKey) zoomAt(view.z * Math.exp(-dy * 0.01), e.clientX - r.left, e.clientY - r.top);   // щипок на тачпаде или Ctrl + колесо
    else { view.x += (e.shiftKey && !dx ? dy : dx) / view.z; view.y += (e.shiftKey ? 0 : dy) / view.z; redraw(); }
  }, { passive: false });

  // ---------- Панель ----------
  function setTool(t) {
    tool = t; if (t !== 'move') selected = null; if (t !== 'eraser') eraser = null;
    root.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
    stage.dataset.tool = t; redrawOver();
  }
  function setColor(c) {
    color = c; store.set('bd.pen', { c: color, w: width });
    root.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('on', x.dataset.color === c));
    const more = $('#bd-more', root), main = COLORS.some(([m]) => m === c);
    if (more) { more.classList.toggle('on', !main); more.style.setProperty('--c', main ? 'transparent' : c); more.textContent = main ? '+' : ''; }
    if (tool !== 'pen' && tool !== 'marker') setTool('pen');
  }
  function setFinger(on, save = true) {
    fingerDraw = on; if (save) store.set('bd.finger', on);
    const b = $('#bd-finger', root); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }
  }
  const showPop = (on) => { if (!pop) return; pop.hidden = !on; const bar = $('.bd-bar', root); pop.style.top = `${bar.offsetTop + bar.offsetHeight + 8}px`; $('#bd-more', root).setAttribute('aria-expanded', on); };
  function undo() {
    const id = mine[mine.length - 1], it = id && items.get(id);
    if (!it) { if (mine.length) { mine.pop(); undo(); } return; }
    del(it);
  }
  function setFull(on) {
    full = on; bd.classList.toggle('bd-full', on); document.body.classList.toggle('bd-lock', on);
    $('#bd-full', root).innerHTML = ico(on ? 'unfull' : 'full'); $('#bd-full', root).title = on ? 'Выйти из полного экрана (Esc)' : 'На весь экран (F)';
    if (on) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    redraw();
  }
  root.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  root.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => { setColor(b.dataset.color); showPop(false); }));
  $('#bd-more', root)?.addEventListener('click', (e) => { e.stopPropagation(); showPop(pop.hidden); });
  $('#bd-pick', root)?.addEventListener('input', (e) => { if (HEX.test(e.target.value)) setColor(e.target.value); });
  const onDocDown = (e) => { if (pop && !pop.hidden && !e.target.closest?.('#bd-pop, #bd-more')) showPop(false); };
  document.addEventListener('pointerdown', onDocDown);
  root.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', () => {
    width = +b.dataset.w; store.set('bd.pen', { c: color, w: width });
    root.querySelectorAll('[data-w]').forEach((x) => x.classList.toggle('on', x === b)); redrawOver();
  }));
  $('#bd-undo', root)?.addEventListener('click', undo);
  $('#bd-img', root)?.addEventListener('click', () => $('#bd-file', root).click());
  $('#bd-file', root).addEventListener('change', (e) => { [...e.target.files].forEach(addImage); e.target.value = ''; });
  $('#bd-finger', root)?.addEventListener('click', () => setFinger(!fingerDraw));
  $('#bd-zin', root).addEventListener('click', () => zoomAt(view.z * 1.25));
  $('#bd-zout', root).addEventListener('click', () => zoomAt(view.z / 1.25));
  zlabel.addEventListener('click', () => zoomAt(1));
  $('#bd-fit', root).addEventListener('click', fitContent);
  $('#bd-save', root).addEventListener('click', exportPng);
  $('#bd-full', root).addEventListener('click', () => setFull(!full));
  $('#bd-clear', root)?.addEventListener('click', () => confirmDialog('Стереть всю доску? Вернуть нельзя.', async () => {
    outbox.clear(); if (flushP) await flushP;
    await api.removeWhere('board_items', { page_id: page.id }); items.clear(); mine.length = 0; selected = null; redraw(); showSave();
  }, 'Очистить'));

  const typing = (e) => e.target.closest?.('input, textarea, select, [contenteditable], .modal');
  const onKey = (e) => {
    if (!root.isConnected) return stop();
    if (typing(e)) return;
    if (e.code === 'Space' && e.target.closest?.('button, a')) return;
    if (e.code === 'Space') { if (!spaceDown) { spaceDown = true; stage.classList.add('space'); } e.preventDefault(); return; }
    if (e.code === 'Escape') { if (pop && !pop.hidden) showPop(false); else if (full) setFull(false); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && canWrite) { e.preventDefault(); undo(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selected && canWrite) { e.preventDefault(); const it = items.get(selected); if (it) del(it); }
    else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === '+' || e.key === '=') zoomAt(view.z * 1.25);
      else if (e.key === '-' || e.key === '_') zoomAt(view.z / 1.25);
      else if (e.key === '0') fitContent();
      else if (e.code === 'KeyF') setFull(!full);
      else { const t = { KeyP: canWrite && 'pen', KeyM: canWrite && 'marker', KeyE: canWrite && 'eraser', KeyV: canWrite && 'move', KeyH: 'hand' }[e.code]; if (t) setTool(t); }
    }
  };
  const onKeyUp = (e) => { if (e.code === 'Space') { spaceDown = false; stage.classList.remove('space'); } };
  const onPaste = (e) => {
    if (!root.isConnected || !canWrite) return;
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); addImage(f); }
  };
  const onFs = () => { if (full && !document.fullscreenElement) setFull(false); };
  const onOnline = () => { fails = 0; flush(); flushDel(); };
  const onHide = () => { if (document.visibilityState === 'hidden') { flush(); flushDel(); } };
  const onLeave = (e) => { if (unsaved()) { flush(); e.preventDefault(); e.returnValue = ''; } };
  addEventListener('keydown', onKey); addEventListener('keyup', onKeyUp); addEventListener('paste', onPaste);
  addEventListener('online', onOnline); addEventListener('beforeunload', onLeave); document.addEventListener('visibilitychange', onHide);
  document.addEventListener('fullscreenchange', onFs);
  stage.addEventListener('dragover', (e) => { if (canWrite) e.preventDefault(); });
  stage.addEventListener('drop', (e) => { if (!canWrite) return; e.preventDefault(); [...e.dataTransfer.files].forEach(addImage); });
  const ro = new ResizeObserver(() => { refreshRect(); redraw(); }); ro.observe(stage);
  addEventListener('scroll', refreshRect, true); addEventListener('resize', refreshRect);

  // ---------- Загрузка ----------
  async function load() {
    const token = ++loadToken;
    let rows;
    try { rows = await api.select('board_items', { eq: { page_id: page.id }, order: 'created_at' }); }
    catch (e) { toast(`Не удалось загрузить доску: ${e.message}`, 'error'); return; }
    if (token !== loadToken) return;
    for (const r of rows) { if (sane(r.kind, r.data, studentId)) items.set(r.id, { id: r.id, kind: r.kind, data: r.data, sync: 'db' }); else { bad.add(r.id); console.warn('board: пропущена строка с неверными данными', r.id); } }
    fitContent();
  }

  // ---------- Живые обновления ----------
  function onItem(ev) {
    if (!root.isConnected) return stop();
    const n = ev.new, o = ev.old;
    if (ev.eventType === 'INSERT') {
      if (n.page_id !== page.id) return;
      if (!sane(n.kind, n.data, studentId)) { bad.add(n.id); console.warn('board: пропущен штрих с неверными данными', n.id); return; }
      const ex = items.get(n.id);
      if (!ex) {
        if (outbox.has(n.id) || inflight.has(n.id)) return;
        const it = { id: n.id, kind: n.kind, data: n.data, sync: 'db' }; items.set(n.id, it);
        if (live.delete(n.id)) redrawOver();
        appendBase(it);
      }
      else if (ex.sync === 'live') { ex.data = n.data; ex._bb = null; ex.sync = 'db'; }      // сохранённая версия заменяет «живую» (выглядит так же — не перерисовываем)
      else if (ex.sync === 'pending') ex.sync = 'db';                                           // эхо своего штриха: на экране уже всё есть
    }
    else if (ev.eventType === 'DELETE') { if (items.delete(o.id)) { if (selected === o.id) selected = null; redraw(); } }
    else if (ev.eventType === 'UPDATE') { const it = items.get(n.id); if (it && drag?.id !== n.id && sane(it.kind, n.data, studentId)) { it.data = n.data; it._bb = null; redraw(); } }
  }
  // Сверка с базой. Realtime быстрый, но не гарантирует доставку (обрыв сети, сон вкладки): раз в несколько секунд сравниваем
  // число штрихов с базой и, если разошлись, подтягиваем недостающее. Дёшево: обычно это один лёгкий запрос.
  let timer = null, online = false, reconciling = false;
  const conn = $('#bd-conn', root);
  const showConn = () => { conn.classList.toggle('ok', online); conn.classList.toggle('off', !online); conn.title = online ? 'На связи: изменения видны сразу' : 'Связь восстанавливается, доска обновляется раз в несколько секунд'; };
  const quiet = () => unsaved() || flushP || cur || drag;
  async function reconcile() {
    if (!root.isConnected) return stop();
    if (reconciling || quiet()) return;
    reconciling = true;
    try {
      const { count } = await api.page('board_items', { from: 0, to: 0, cols: 'id', eq: { page_id: page.id } });
      const now = Date.now(); let inDb = 0, stale = false;
      for (const it of items.values()) { if (it.sync === 'db') inDb++; else if (it.sync === 'live' && now - it.t > 20000) stale = true; }
      if (count === inDb + bad.size && !stale) return;
      const rows = await api.select('board_items', { eq: { page_id: page.id }, order: 'created_at' });
      if (quiet()) return;                                      // пока шла загрузка, начали писать: сверимся в следующий раз
      const ids = new Set(rows.map((r) => r.id)); let ch = false;
      for (const r of rows) {
        if (!sane(r.kind, r.data, studentId)) { bad.add(r.id); continue; }
        const ex = items.get(r.id);
        if (!ex) { items.set(r.id, { id: r.id, kind: r.kind, data: r.data, sync: 'db' }); ch = true; }
        else if (ex.sync === 'live') { ex.data = r.data; ex._bb = null; ex.sync = 'db'; ch = true; }
      }
      for (const [id, it] of items) if (!ids.has(id) && (it.sync === 'db' || (it.sync === 'live' && now - it.t > 20000))) { items.delete(id); ch = true; }
      if (ch) redraw();
    } catch { /* повторим в следующий раз */ }
    finally { reconciling = false; }
  }
  const onStatus = (st) => {
    online = st === 'SUBSCRIBED'; showConn();
    clearInterval(timer); timer = setInterval(reconcile, online ? 8000 : 3000);
    if (online) reconcile();
  };
  showConn(); timer = setInterval(reconcile, 3000);
  unsub.push(api.subscribe('board_items', `student_id=eq.${studentId}`, onItem, onStatus));
  const watchdog = setInterval(() => { if (!root.isConnected) stop(); }, 3000);

  // ---------- Скачать доску ----------
  async function exportPng() {
    const list = [...items.values()];
    if (!list.length) return toast('На доске пока пусто', 'error');
    await Promise.all(list.filter((i) => i.kind === 'img').map((i) => loadImg(i.data.path)));
    let b = null; for (const it of list) { const x = bboxOf(it); b = b ? [Math.min(b[0], x[0]), Math.min(b[1], x[1]), Math.max(b[2], x[2]), Math.max(b[3], x[3])] : [...x]; }
    const pad = 60, x0 = Math.floor((b[0] - pad) / CELL) * CELL, y0 = Math.floor((b[1] - pad) / CELL) * CELL;
    const w = Math.max(1200, Math.ceil((b[2] + pad - x0) / CELL) * CELL), h = Math.max(800, Math.ceil((b[3] + pad - y0) / CELL) * CELL);
    const k = Math.min(1, 4000 / Math.max(w, h)), c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k); const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    drawGrid(g, x0, y0, x0 + w, y0 + h, k);
    for (const it of list) if (it.kind === 'img') { const el = imgCache.get(it.data.path)?.el; if (el) g.drawImage(el, it.data.x, it.data.y, it.data.w, it.data.h); }
    for (const hl of [1, 0]) for (const it of list) if (it.kind === 'stroke' && !it.data.h === !hl) drawStroke(g, it.data);
    try {
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `доска-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch { toast('Не удалось сохранить картинку', 'error'); }
  }

  function stop() {
    if (cur) finishStroke();
    flush(); flushDel();                                       // недописанное уходит в базу и после ухода со страницы
    unsub.forEach((f) => { try { f(); } catch {} }); unsub.length = 0;
    clearInterval(timer); clearInterval(watchdog); ro.disconnect(); chan.close();
    removeEventListener('scroll', refreshRect, true); removeEventListener('resize', refreshRect);
    removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); removeEventListener('paste', onPaste);
    removeEventListener('online', onOnline); removeEventListener('beforeunload', onLeave); document.removeEventListener('visibilitychange', onHide);
    document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('pointerdown', onDocDown);
    document.body.classList.remove('bd-lock');
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    if (dispose === stop) dispose = null;
  }
  dispose = stop;

  stage.dataset.tool = tool;
  setZoomLabel();
  await load();
}
