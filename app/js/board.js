// Онлайн-доска: у каждого ученика своя, одно бесконечное клетчатое поле. Двигается и масштабируется, открывается на весь экран.
// Перья разных цветов, ластик (стирает штрих целиком), картинки/скриншоты. Рисуют оба: преподаватель и ученик.
// Всё хранится в базе (board_pages → board_items), чужие штрихи видны сразу (Realtime + «живой» штрих во время письма).
// Координаты мировые, у всех одинаковые; у каждого участника свой масштаб и положение окна.
import { toast, confirmDialog, I, $ } from './ui.js?v=202610291837';

const CELL = 40, ERASER_PX = 11, MIN_Z = 0.1, MAX_Z = 4;
const COLORS = [['#1b2330', 'Чёрный'], ['#2563eb', 'Синий'], ['#e5392f', 'Красный'], ['#1f9d55', 'Зелёный'], ['#f08a00', 'Оранжевый'], ['#8b3fd9', 'Фиолетовый']];
const WIDTHS = [[3, 'Тонкое'], [6, 'Среднее'], [12, 'Толстое']];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uuid = () => crypto.randomUUID();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let dispose = null;

const IC = {
  pen: '<path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16z"/><path d="M14 7l3 3"/>',
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
  if (d.p.length === 2) ctx.fill(P); else ctx.stroke(P);
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
  if (kind === 'stroke') return Array.isArray(d.p) && d.p.length >= 2 && d.p.length <= 20000 && d.p.length % 2 === 0 && d.p.every(fin) && fin(d.w) && d.w >= 1 && d.w <= 60 && typeof d.c === 'string' && HEX.test(d.c);
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

export { sane, simplify };

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
  const items = new Map();                      // id → { id, kind, data }
  const mine = [];                              // id моих последних объектов (для «отменить»)
  const live = new Map();                       // чужие штрихи, которые ещё пишутся: id → { d }
  const imgCache = new Map();                   // path → { el, p, failed }
  const touches = new Map();                    // активные пальцы: id → { x, y }
  const view = { x: 0, y: 0, z: 0.7 };          // окно: мировая точка левого верхнего угла и масштаб
  let tool = 'pen', color = COLORS[1][0], width = WIDTHS[1][0];
  let fingerDraw = false, spaceDown = false, full = false, selected = null, cur = null, drag = null, pan = null, gesture = null;
  let pending = 0, raf = 0, loadToken = 0;
  const unsub = [];

  root.innerHTML = `
    <div class="bd" id="bd">
      <div class="bd-bar card">
        <div class="bd-grp" role="group" aria-label="Инструменты">
          ${canWrite ? `<button class="bd-btn on" data-tool="pen" title="Перо (P)" aria-label="Перо">${ico('pen')}</button>
          <button class="bd-btn" data-tool="eraser" title="Ластик (E)" aria-label="Ластик">${ico('eraser')}</button>
          <button class="bd-btn" data-tool="move" title="Двигать картинки (V)" aria-label="Двигать картинки">${ico('move')}</button>` : ''}
          <button class="bd-btn${canWrite ? '' : ' on'}" data-tool="hand" title="Двигать доску (H, или зажать пробел)" aria-label="Двигать доску">${ico('hand')}</button>
        </div>
        ${canWrite ? `
        <div class="bd-grp" role="group" aria-label="Цвет">${COLORS.map(([c, n], i) => `<button class="bd-dot${i === 1 ? ' on' : ''}" data-color="${c}" style="--c:${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div>
        <div class="bd-grp" role="group" aria-label="Толщина">${WIDTHS.map(([w, n], i) => `<button class="bd-w${i === 1 ? ' on' : ''}" data-w="${w}" title="${n}" aria-label="${n}"><i style="height:${Math.round(w / 2) + 1}px"></i></button>`).join('')}</div>
        <div class="bd-grp">
          <button class="bd-btn" id="bd-undo" title="Отменить (Ctrl+Z)" aria-label="Отменить">${ico('undo')}</button>
          <button class="bd-btn" id="bd-img" title="Добавить картинку или скриншот (можно просто вставить Ctrl+V)" aria-label="Добавить картинку">${ico('image')}</button>
          <button class="bd-btn bd-touch" id="bd-finger" title="Рисовать пальцем" aria-pressed="false" aria-label="Рисовать пальцем">☝</button>
        </div>` : ''}
        <div class="bd-grp" role="group" aria-label="Масштаб">
          <button class="bd-btn" id="bd-zout" title="Уменьшить (−)" aria-label="Уменьшить">${ico('minus')}</button>
          <button class="bd-zoom" id="bd-zlabel" title="Масштаб 100%" aria-label="Сбросить масштаб">70%</button>
          <button class="bd-btn" id="bd-zin" title="Увеличить (+)" aria-label="Увеличить">${ico('plus')}</button>
          <button class="bd-btn" id="bd-fit" title="Показать всё, что нарисовано (0)" aria-label="Показать всё">${ico('fit')}</button>
        </div>
        <div class="bd-grp bd-right">
          <span class="bd-status" id="bd-status" aria-live="polite"></span>
          <button class="bd-btn" id="bd-save" title="Скачать доску картинкой" aria-label="Скачать доску">${ico('down')}</button>
          ${isTutor ? `<button class="bd-btn" id="bd-clear" title="Очистить доску" aria-label="Очистить доску">${ico('trash')}</button>` : ''}
          <button class="bd-btn" id="bd-full" title="На весь экран (F)" aria-label="На весь экран">${ico('full')}</button>
        </div>
      </div>
      <div class="bd-stage" id="bd-stage"><canvas id="bd-cv"></canvas></div>
      <input type="file" id="bd-file" accept="image/*" hidden>
    </div>`;
  const bd = $('#bd', root), stage = $('#bd-stage', root), cv = $('#bd-cv', root), ctx = cv.getContext('2d', { alpha: false, desynchronized: true });
  const status = $('#bd-status', root), zlabel = $('#bd-zlabel', root);
  if (!canWrite) tool = 'hand';

  // Положение холста на странице кэшируем: не дёргаем раскладку на каждое движение мыши
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
  function paint() {
    raf = 0; if (!root.isConnected) return;
    const cw = stage.clientWidth, ch = stage.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!cw || !ch) return;
    const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, pw, ph);
    const k = dpr * view.z;
    ctx.setTransform(k, 0, 0, k, -view.x * k, -view.y * k);
    drawGrid(ctx, view.x, view.y, view.x + cw / view.z, view.y + ch / view.z, view.z);
    const vx0 = view.x, vy0 = view.y, vx1 = view.x + cw / view.z, vy1 = view.y + ch / view.z;
    const seen = (it, m = 0) => { const b = bboxOf(it); return b[2] + m >= vx0 && b[0] - m <= vx1 && b[3] + m >= vy0 && b[1] - m <= vy1; };
    for (const it of items.values()) if (it.kind === 'img' && seen(it)) {
      const el = getImg(it.data.path), d = it.data;
      if (el) ctx.drawImage(el, d.x, d.y, d.w, d.h);
      else { ctx.fillStyle = '#eef3f9'; ctx.fillRect(d.x, d.y, d.w, d.h); ctx.fillStyle = '#8aa0b8'; ctx.font = '28px sans-serif'; ctx.fillText(imgCache.get(d.path)?.failed ? 'Не удалось загрузить' : 'Загрузка…', d.x + 20, d.y + 44); }
    }
    for (const it of items.values()) if (it.kind === 'stroke' && seen(it, it.data.w)) drawStroke(ctx, it.data);
    for (const l of live.values()) drawStroke(ctx, l.d, false);
    if (cur) drawStroke(ctx, cur.d, false);
    const sel = selected && items.get(selected);
    if (sel) {
      const d = sel.data, s = 1 / view.z; ctx.save(); ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 3 * s; ctx.setLineDash([12 * s, 8 * s]); ctx.strokeRect(d.x, d.y, d.w, d.h); ctx.setLineDash([]);
      ctx.fillStyle = '#2563eb'; ctx.fillRect(d.x + d.w - 8 * s, d.y + d.h - 8 * s, 16 * s, 16 * s); ctx.restore();
    }
  }
  const redraw = () => { if (!raf) raf = requestAnimationFrame(paint); };

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
      const id = uuid(), item = { id, kind: 'img', data };
      imgCache.set(path, { el: c, p: Promise.resolve(c), failed: false });
      items.set(id, item); selected = id; setTool('move'); redraw();
      setPending(1);
      try { await api.upload(path, blob); await api.insert('board_items', { id, page_id: page.id, student_id: studentId, kind: 'img', data }); mine.push(id); }
      catch (e) { items.delete(id); selected = null; toast(`Не удалось добавить картинку: ${e.message}`, 'error'); redraw(); }
      setPending(-1);
    } catch { toast('Не удалось прочитать картинку', 'error'); }
  }

  // ---------- Сохранение ----------
  function setPending(d) {
    pending += d; status.textContent = pending > 0 ? 'Сохраняю…' : '✓ Сохранено';
    status.classList.toggle('busy', pending > 0);
  }
  async function persist(item) {
    setPending(1);
    for (let t = 0; t < 3; t++) {
      try { await api.insert('board_items', { id: item.id, page_id: item.page_id, student_id: studentId, kind: item.kind, data: item.data }); setPending(-1); return; }
      catch (e) { if (t === 2) { items.delete(item.id); redraw(); toast(`Штрих не сохранился: ${e.message}`, 'error'); setPending(-1); return; } await sleep(700 * (t + 1)); }
    }
  }
  // Ластик за один взмах стирает много штрихов: удаляем их одним запросом, а не десятками
  let delQ = [], delT = 0;
  function flushDel() {
    clearTimeout(delT); delT = 0;
    const ids = delQ; delQ = []; if (!ids.length) return;
    api.removeMany('board_items', ids).catch((e) => toast(`Не удалось удалить: ${e.message}`, 'error')).finally(() => setPending(-ids.length));
  }
  function del(it, { file = true } = {}) {
    items.delete(it.id); if (selected === it.id) selected = null;
    const i = mine.indexOf(it.id); if (i >= 0) mine.splice(i, 1);
    setPending(1); delQ.push(it.id); if (!delT) delT = setTimeout(flushDel, 150);
    if (file && it.kind === 'img' && okPath(it.data.path, studentId)) api.removeFile(it.data.path).catch(() => {});
    redraw();
  }

  // ---------- Живой штрих ----------
  const chan = api.live(`board-live:${studentId}`, (m) => {
    if (!root.isConnected || !m || m.page !== page.id || typeof m.id !== 'string' || m.id.length > 40 || items.has(m.id)) return;
    if (!Array.isArray(m.p) || m.p.length > 400 || !m.p.every(fin) || !fin(m.w) || m.w < 1 || m.w > 60 || typeof m.c !== 'string' || !HEX.test(m.c)) return;
    let l = live.get(m.id);
    if (!l) { if (live.size >= 50) return; live.set(m.id, l = { d: { c: m.c, w: m.w, p: [] } }); }
    if (l.d.p.length + m.p.length > 20000) return;
    l.d.p.push(...m.p);
    if (m.end) setTimeout(() => { if (live.delete(m.id)) redraw(); }, 4000);   // если сохранённый штрих так и не пришёл
    redraw();
  });
  function sendLive(force = false, end = false) {
    const now = Date.now();
    if (!cur || (!force && now - cur.t < 70)) return;
    const p = cur.d.p, from = Math.max(0, cur.sent - 2);       // с запасом в одну точку, чтобы линия не рвалась
    chan.send({ id: cur.id, page: page.id, c: cur.d.c, w: cur.d.w, p: p.slice(from), end });
    cur.sent = p.length; cur.t = now;
  }

  // ---------- Указатель ----------
  const pt = (e) => [view.x + (e.clientX - rect.left) / view.z, view.y + (e.clientY - rect.top) / view.z];
  const imgAt = (x, y) => { const l = [...items.values()].filter((i) => i.kind === 'img'); for (let i = l.length - 1; i >= 0; i--) { const d = l[i].data; if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return l[i]; } return null; };
  const eraseAt = (x, y) => { const r = ERASER_PX / view.z; for (const it of [...items.values()]) if (it.kind === 'stroke' && strokeHit(it, x, y, r)) del(it); };
  const mid = () => { const a = [...touches.values()]; return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1 }; };
  const cancelStroke = () => { if (cur) { sendLive(true, true); cur = null; redraw(); } drag = null; };

  function down(e) {
    cv.setPointerCapture?.(e.pointerId); refreshRect();
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) { cancelStroke(); pan = null; const m = mid(); gesture = { d0: m.d, z0: view.z, wx: view.x + (m.x - cv.getBoundingClientRect().left) / view.z, wy: view.y + (m.y - cv.getBoundingClientRect().top) / view.z }; return; }
      if (touches.size > 2) return;
      if (!fingerDraw || !canWrite) { e.preventDefault(); pan = { id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; return; }
    }
    if (e.button === 1 || e.button === 2 || tool === 'hand' || spaceDown || !canWrite) { e.preventDefault(); pan = { id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; stage.classList.add('panning'); return; }
    if (e.button > 0) return;
    e.preventDefault();
    const [x, y] = pt(e);
    if (tool === 'pen') {
      cur = { id: uuid(), sent: 0, t: 0, d: { c: color, w: width, p: [Math.round(x), Math.round(y)] } };
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, width / 2, 0, Math.PI * 2); ctx.fill();
      sendLive(true);
    } else if (tool === 'eraser') { drag = { erase: true }; eraseAt(x, y); }
    else if (tool === 'move') {
      const sel = selected && items.get(selected), d = sel?.data, tol = 24 / view.z;
      if (d && Math.abs(x - (d.x + d.w)) < tol && Math.abs(y - (d.y + d.h)) < tol) drag = { id: sel.id, resize: true, x0: x, w0: d.w, h0: d.h, moved: false };
      else { const hit = imgAt(x, y); selected = hit ? hit.id : null; drag = hit ? { id: hit.id, x0: x, y0: y, ox: hit.data.x, oy: hit.data.y, moved: false } : null; redraw(); }
    }
  }
  function move(e) {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture && touches.size >= 2) {                         // два пальца: масштаб и сдвиг
      const m = mid(), r = cv.getBoundingClientRect(), z = clamp(gesture.z0 * m.d / gesture.d0, MIN_Z, MAX_Z);
      view.z = z; view.x = gesture.wx - (m.x - r.left) / z; view.y = gesture.wy - (m.y - r.top) / z;
      setZoomLabel(); redraw(); return;
    }
    if (pan && pan.id === e.pointerId) {
      view.x = pan.vx - (e.clientX - pan.sx) / view.z; view.y = pan.vy - (e.clientY - pan.sy) / view.z; redraw(); return;
    }
    if (!cur && !drag) return;
    const co = cur && e.getCoalescedEvents?.(), evs = co?.length ? co : [e];
    for (const ev of evs) {
      const [x, y] = pt(ev);
      if (cur) {
        const p = cur.d.p, lx = p[p.length - 2], ly = p[p.length - 1], rx = Math.round(x), ry = Math.round(y);
        if (Math.hypot(rx - lx, ry - ly) < 1.5) continue;
        p.push(rx, ry); sendLive();
        ctx.strokeStyle = cur.d.c; ctx.lineWidth = cur.d.w; ctx.lineCap = ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(rx, ry); ctx.stroke();
      } else if (drag?.erase) eraseAt(x, y);
      else if (drag) {
        const it = items.get(drag.id); if (!it) continue; const d = { ...it.data };
        if (drag.resize) { const nw = Math.max(80, drag.w0 + (x - drag.x0)); d.w = Math.round(nw); d.h = Math.round(nw * drag.h0 / drag.w0); }
        else { d.x = Math.round(drag.ox + x - drag.x0); d.y = Math.round(drag.oy + y - drag.y0); }
        drag.moved = true; it.data = d; it._bb = null; redraw();
      }
    }
  }
  function up(e) {
    touches.delete(e.pointerId);
    if (touches.size < 2) gesture = null;
    if (pan && pan.id === e.pointerId) { pan = null; stage.classList.remove('panning'); return; }
    if (cur) {
      sendLive(true, true);
      cur.d.p = simplify(cur.d.p, 0.7);
      const item = { id: cur.id, page_id: page.id, kind: 'stroke', data: cur.d };
      items.set(item.id, item); mine.push(item.id); cur = null; redraw(); persist(item);
    } else if (drag && !drag.erase && drag.moved) {
      const it = items.get(drag.id);
      if (it) { setPending(1); api.update('board_items', it.id, { data: it.data }).catch((er) => toast(`Не удалось сохранить: ${er.message}`, 'error')).finally(() => setPending(-1)); }
    }
    drag = null;
  }
  cv.addEventListener('contextmenu', (e) => e.preventDefault());      // правая кнопка — двигать доску, а не меню
  cv.addEventListener('pointerdown', down);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), u = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1;   // Firefox отдаёт строки, а не пиксели
    const dx = e.deltaX * u, dy = e.deltaY * u;
    if (e.ctrlKey || e.metaKey) zoomAt(view.z * Math.exp(-dy * 0.01), e.clientX - r.left, e.clientY - r.top);   // щипок на тачпаде или Ctrl + колесо
    else { view.x += (e.shiftKey && !dx ? dy : dx) / view.z; view.y += (e.shiftKey ? 0 : dy) / view.z; redraw(); }
  }, { passive: false });

  // ---------- Панель ----------
  function setTool(t) {
    tool = t; if (t !== 'move') selected = null;
    root.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
    stage.dataset.tool = t; redraw();
  }
  function undo() {
    const id = mine[mine.length - 1], it = id && items.get(id);
    if (!it) { mine.pop(); if (mine.length) undo(); return; }
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
  root.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => {
    color = b.dataset.color; root.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('on', x === b)); setTool('pen');
  }));
  root.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', () => {
    width = +b.dataset.w; root.querySelectorAll('[data-w]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('#bd-undo', root)?.addEventListener('click', undo);
  $('#bd-img', root)?.addEventListener('click', () => $('#bd-file', root).click());
  $('#bd-file', root).addEventListener('change', (e) => { [...e.target.files].forEach(addImage); e.target.value = ''; });
  $('#bd-finger', root)?.addEventListener('click', (e) => {
    fingerDraw = !fingerDraw; e.currentTarget.classList.toggle('on', fingerDraw); e.currentTarget.setAttribute('aria-pressed', fingerDraw);
  });
  $('#bd-zin', root).addEventListener('click', () => zoomAt(view.z * 1.25));
  $('#bd-zout', root).addEventListener('click', () => zoomAt(view.z / 1.25));
  zlabel.addEventListener('click', () => zoomAt(1));
  $('#bd-fit', root).addEventListener('click', fitContent);
  $('#bd-save', root).addEventListener('click', exportPng);
  $('#bd-full', root).addEventListener('click', () => setFull(!full));
  $('#bd-clear', root)?.addEventListener('click', () => confirmDialog('Стереть всю доску? Вернуть нельзя.', async () => {
    await api.removeWhere('board_items', { page_id: page.id }); items.clear(); mine.length = 0; selected = null; redraw();
  }, 'Очистить'));

  const typing = (e) => e.target.closest?.('input, textarea, select, [contenteditable], .modal');
  const onKey = (e) => {
    if (!root.isConnected) return stop();
    if (typing(e)) return;
    if (e.code === 'Space' && e.target.closest?.('button, a')) return;
    if (e.code === 'Space') { if (!spaceDown) { spaceDown = true; stage.classList.add('space'); } e.preventDefault(); return; }
    if (e.code === 'Escape' && full) { setFull(false); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && canWrite) { e.preventDefault(); undo(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selected && canWrite) { e.preventDefault(); const it = items.get(selected); if (it) del(it); }
    else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === '+' || e.key === '=') zoomAt(view.z * 1.25);
      else if (e.key === '-' || e.key === '_') zoomAt(view.z / 1.25);
      else if (e.key === '0') fitContent();
      else if (e.code === 'KeyF') setFull(!full);
      else { const t = { KeyP: canWrite && 'pen', KeyE: canWrite && 'eraser', KeyV: canWrite && 'move', KeyH: 'hand' }[e.code]; if (t) setTool(t); }
    }
  };
  const onKeyUp = (e) => { if (e.code === 'Space') { spaceDown = false; stage.classList.remove('space'); } };
  const onPaste = (e) => {
    if (!root.isConnected || !canWrite) return;
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); addImage(f); }
  };
  const onFs = () => { if (full && !document.fullscreenElement) setFull(false); };
  addEventListener('keydown', onKey); addEventListener('keyup', onKeyUp); addEventListener('paste', onPaste);
  document.addEventListener('fullscreenchange', onFs);
  stage.addEventListener('dragover', (e) => { if (canWrite) e.preventDefault(); });
  stage.addEventListener('drop', (e) => { if (!canWrite) return; e.preventDefault(); [...e.dataTransfer.files].forEach(addImage); });
  const ro = new ResizeObserver(() => { refreshRect(); redraw(); }); ro.observe(stage);
  addEventListener('scroll', refreshRect, true); addEventListener('resize', refreshRect);
  status.textContent = '';

  // ---------- Загрузка ----------
  async function load() {
    const token = ++loadToken;
    let rows;
    try { rows = await api.select('board_items', { eq: { page_id: page.id }, order: 'created_at' }); }
    catch (e) { toast(`Не удалось загрузить доску: ${e.message}`, 'error'); return; }
    if (token !== loadToken) return;
    for (const r of rows) if (sane(r.kind, r.data, studentId)) items.set(r.id, { id: r.id, kind: r.kind, data: r.data });
    fitContent();
  }

  // ---------- Живые обновления ----------
  function onItem(ev) {
    if (!root.isConnected) return stop();
    const n = ev.new, o = ev.old;
    if (ev.eventType === 'INSERT') { live.delete(n.id); if (n.page_id === page.id && !items.has(n.id) && sane(n.kind, n.data, studentId)) items.set(n.id, { id: n.id, kind: n.kind, data: n.data }); }
    else if (ev.eventType === 'DELETE') { if (items.delete(o.id) && selected === o.id) selected = null; }
    else if (ev.eventType === 'UPDATE') { const it = items.get(n.id); if (it && drag?.id !== n.id && sane(it.kind, n.data, studentId)) { it.data = n.data; it._bb = null; } }
    redraw();
  }
  // Запасной вариант, если Realtime не подключился: раз в 4 секунды подтягиваем новое
  let poll = null;
  const startPoll = () => {
    if (poll) return;
    poll = setInterval(async () => {
      if (!root.isConnected) return stop();
      try {
        const rows = await api.select('board_items', { eq: { page_id: page.id }, order: 'created_at' });
        const ids = new Set(rows.map((r) => r.id)); let ch = false;
        for (const r of rows) if (!items.has(r.id) && sane(r.kind, r.data, studentId)) { items.set(r.id, { id: r.id, kind: r.kind, data: r.data }); ch = true; }
        for (const id of [...items.keys()]) if (!ids.has(id) && !pending) { items.delete(id); ch = true; }
        if (ch) redraw();
      } catch { /* повторим */ }
    }, 4000);
  };
  const onStatus = (s) => { if (s === 'SUBSCRIBED') { clearInterval(poll); poll = null; } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') startPoll(); };
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
    for (const it of list) if (it.kind === 'stroke') drawStroke(g, it.data);
    try {
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `доска-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch { toast('Не удалось сохранить картинку', 'error'); }
  }

  function stop() {
    flushDel();
    unsub.forEach((f) => { try { f(); } catch {} }); unsub.length = 0;
    clearInterval(poll); clearInterval(watchdog); ro.disconnect(); chan.close();
    removeEventListener('scroll', refreshRect, true); removeEventListener('resize', refreshRect);
    removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); removeEventListener('paste', onPaste);
    document.removeEventListener('fullscreenchange', onFs);
    document.body.classList.remove('bd-lock');
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    if (dispose === stop) dispose = null;
  }
  dispose = stop;

  stage.dataset.tool = tool;
  setZoomLabel();
  await load();
}
