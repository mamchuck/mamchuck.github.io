// Доска на весь экран: перо, маркер, ластик (стирает часть линии), выделение и перемещение, картинки, отмена/повтор.
// Данные — те же таблицы board_pages → board_items (штрих {c, w, p, h?}, картинка {path, x, y, w, h}), поэтому старые доски открываются как есть.
//
// Почему не тормозит:
// • Всё сохранённое нарисовано в «кэш-холст» с запасом вокруг экрана. Сдвиг и масштаб — это только CSS-трансформация этого холста
//   (видеокарта, без перерисовки). Перерисовка — когда ушли за запас, сильно изменили масштаб или что-то стёрли/сдвинули.
// • Новый штрих дорисовывается в кэш поверх, без перерисовки всего.
// • Пространственный индекс (сетка 1024×1024): отрисовка, ластик и выделение смотрят только объекты рядом, а не все.
// • При мелком масштабе штрихи рисуются упрощёнными (меньше точек), совсем мелкие пропускаются.
// • Пока пишешь, каждый кадр перерисовывается только верхний прозрачный слой с одной линией.
import { toast, confirmDialog } from '../app/js/ui.js?v=202611071254';

const CELL = 40, GRID = 1024, MIN_Z = 0.08, MAX_Z = 5, MARK_K = 3, MARK_A = 0.38;
export const COLORS = [['#1b2330', 'Чёрный'], ['#2563eb', 'Синий'], ['#e5392f', 'Красный'], ['#1f9d55', 'Зелёный'], ['#f08a00', 'Оранжевый'], ['#8b3fd9', 'Фиолетовый'], ['#f5c400', 'Жёлтый'], ['#15aabf', 'Голубой']];
export const WIDTHS = [[3, 'Тонкое'], [6, 'Среднее'], [12, 'Толстое']];
const ERASE_PX = { 3: 10, 6: 18, 12: 34 };              // радиус ластика на экране для каждой толщины
const uuid = () => crypto.randomUUID();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const q1 = (v) => Math.round(v * 10) / 10;
const now = () => performance.now();

// ---------- Геометрия ----------
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
// Упрощение линии (Рамер — Дуглас — Пекер)
export function simplify(p, eps) {
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
const HEX = /^#[0-9a-f]{6}$/i, fin = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e6;
const okPath = (p, sid) => typeof p === 'string' && p.startsWith(`${sid}/board/`) && !p.includes('..') && p.length < 200;
// Всё, что пришло из базы или по сети, проверяем: чужие данные не должны ломать доску
export function sane(kind, d, sid) {
  if (!d || typeof d !== 'object') return false;
  if (kind === 'stroke') return Array.isArray(d.p) && d.p.length >= 2 && d.p.length <= 20000 && d.p.length % 2 === 0 && d.p.every(fin) && fin(d.w) && d.w >= 1 && d.w <= 60 && typeof d.c === 'string' && HEX.test(d.c) && (d.h === undefined || d.h === 1);
  if (kind === 'img') return okPath(d.path, sid) && [d.x, d.y, d.w, d.h].every(fin) && d.w > 0 && d.h > 0 && d.w < 20000 && d.h < 20000;
  return false;
}
function bboxOf(it) {
  if (it.bb) return it.bb;
  const d = it.data;
  if (it.kind === 'img') return (it.bb = [d.x, d.y, d.x + d.w, d.y + d.h]);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < d.p.length; i += 2) { const x = d.p[i], y = d.p[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const m = d.w / 2;
  return (it.bb = [x0 - m, y0 - m, x1 + m, y1 + m]);
}
const hitsRect = (b, r) => b[2] >= r[0] && b[0] <= r[2] && b[3] >= r[1] && b[1] <= r[3];
function strokeHit(d, x, y, r) {
  const m = r + d.w / 2, p = d.p;
  if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) <= m;
  for (let i = 0; i < p.length - 2; i += 2) if (segDist(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= m) return true;
  return false;
}
// Ластик стирает часть линии: штрих режется на куски вне круга. null — круг линию не задел
export function cutStroke(d, x, y, r) {
  const R = r + d.w / 2, R2 = R * R, s = Math.max(0.4, R / 3), p = d.p, out = [];
  let part = [], hit = false;
  const add = (px, py) => {
    if ((px - x) ** 2 + (py - y) ** 2 < R2) { hit = true; if (part.length) { out.push(part); part = []; } }
    else part.push(px, py);
  };
  add(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2], ay = p[i - 1], bx = p[i], by = p[i + 1];
    if (segDist(x, y, ax, ay, bx, by) > R) { add(bx, by); continue; }
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / s));
    for (let k = 1; k <= n; k++) add(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n);
  }
  if (!hit) return null;
  if (part.length) out.push(part);
  return out.map((q) => ({ ...d, p: simplify(q.map(q1), 0.25) }));
}
// Сдвиг штриха или картинки
function shifted(kind, d, dx, dy) {
  if (kind === 'img') return { ...d, x: Math.round(d.x + dx), y: Math.round(d.y + dy) };
  return { ...d, p: d.p.map((v, i) => q1(v + (i % 2 ? dy : dx))) };
}

// ---------- Отрисовка штриха ----------
// Плавная линия через середины соседних точек. Контур строится один раз и кэшируется; для мелкого масштаба — упрощённый
const PATHS = new WeakMap();
function buildPath(p, w) {
  const n = p.length / 2, P = new Path2D();
  if (n === 1) { P.arc(p[0], p[1], w / 2, 0, Math.PI * 2); return P; }
  P.moveTo(p[0], p[1]);
  for (let i = 1; i < n - 1; i++) P.quadraticCurveTo(p[2 * i], p[2 * i + 1], (p[2 * i] + p[2 * i + 2]) / 2, (p[2 * i + 1] + p[2 * i + 3]) / 2);
  P.lineTo(p[2 * n - 2], p[2 * n - 1]);
  return P;
}
function pathFor(d, z, cache = true) {
  if (!cache) return buildPath(d.p, d.w);
  const lod = z < 0.35 && d.p.length > 16 ? 1 : 0;           // 1 — упрощённая версия для мелкого масштаба
  let e = PATHS.get(d); if (!e) PATHS.set(d, (e = []));
  return e[lod] || (e[lod] = buildPath(lod ? simplify(d.p, 1.2) : d.p, d.w));
}
function drawStroke(g, d, z, cache = true) {
  const P = pathFor(d, z, cache);
  g.strokeStyle = g.fillStyle = d.c; g.lineWidth = d.w; g.lineCap = g.lineJoin = 'round';
  if (d.h) g.globalAlpha = MARK_A;
  if (d.p.length === 2) g.fill(P); else g.stroke(P);
  if (d.h) g.globalAlpha = 1;
}
// Клетка в кэше: каждая линия привязана к пикселям экрана — всегда ровно 1 CSS-пиксель, без размытия на любом масштабе.
// k — пикселей холста на единицу мира, (ox, oy) — мировая точка левого верхнего угла холста, d — плотность пикселей
function drawGridPx(g, x0, y0, x1, y1, k, ox, oy, d) {
  const z = k / d, px = CELL * z;
  if (px * 5 < 7) return;
  const step = px < 9 ? CELL * 5 : CELL, lw = Math.max(1, Math.round(d)), off = lw % 2 ? 0.5 : 0;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.lineWidth = lw;
  for (const major of [false, true]) {
    g.strokeStyle = major ? '#c2d5ec' : '#dde9f6'; g.beginPath();
    const X0 = (x0 - ox) * k, X1 = (x1 - ox) * k, Y0 = (y0 - oy) * k, Y1 = (y1 - oy) * k;
    for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) if ((Math.round(x / CELL) % 5 === 0) === major) { const X = Math.round((x - ox) * k) + off; g.moveTo(X, Y0); g.lineTo(X, Y1); }
    for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) if ((Math.round(y / CELL) % 5 === 0) === major) { const Y = Math.round((y - oy) * k) + off; g.moveTo(X0, Y); g.lineTo(X1, Y); }
    g.stroke();
  }
  g.restore();
}
function drawGrid(g, x0, y0, x1, y1, z) {
  const px = CELL * z;
  if (px * 5 < 7) return;
  const step = px < 9 ? CELL * 5 : CELL;
  g.lineWidth = 1 / z;
  for (const major of [false, true]) {
    g.strokeStyle = major ? '#c2d5ec' : '#dde9f6'; g.beginPath();
    for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) if ((Math.round(x / CELL) % 5 === 0) === major) { g.moveTo(x, y0); g.lineTo(x, y1); }
    for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) if ((Math.round(y / CELL) % 5 === 0) === major) { g.moveTo(x0, y); g.lineTo(x1, y); }
    g.stroke();
  }
}

// ---------- Пространственный индекс: сетка ячеек GRID×GRID ----------
class Index {
  constructor() { this.cells = new Map(); }
  *keys(b) { for (let cx = Math.floor(b[0] / GRID); cx <= Math.floor(b[2] / GRID); cx++) for (let cy = Math.floor(b[1] / GRID); cy <= Math.floor(b[3] / GRID); cy++) yield `${cx},${cy}`; }
  add(it) { const b = bboxOf(it); it.cellb = b; for (const k of this.keys(b)) { let s = this.cells.get(k); if (!s) this.cells.set(k, (s = new Set())); s.add(it); } }
  remove(it) { if (!it.cellb) return; for (const k of this.keys(it.cellb)) { const s = this.cells.get(k); if (s) { s.delete(it); if (!s.size) this.cells.delete(k); } } it.cellb = null; }
  query(r) {                                                   // объекты, чей прямоугольник пересекает r, в порядке рисования
    const out = new Set();
    for (const k of this.keys(r)) { const s = this.cells.get(k); if (s) for (const it of s) if (hitsRect(bboxOf(it), r)) out.add(it); }
    return [...out].sort((a, b) => a.seq - b.seq);
  }
}

export async function mountBoard(root, { api, studentId, canWrite, isTutor }) {
  // ---------- Лист ученика (один, создаётся при первом открытии) ----------
  const getPage = async () => (await api.select('board_pages', { eq: { student_id: studentId }, order: 'created_at' }))[0];
  let page = await getPage();
  if (!page && canWrite) { try { await api.insert('board_pages', { student_id: studentId, title: '' }); } catch { /* уже создал второй участник */ } page = await getPage(); }
  if (!page) throw new Error('Доска появится, когда её откроет ученик или преподаватель.');

  // ---------- Состояние ----------
  const items = new Map(), index = new Index();
  const live = new Map(), imgCache = new Map(), touches = new Map();
  const view = { x: 0, y: 0, z: 0.7 };
  const pref = (() => { try { return JSON.parse(localStorage.getItem('bd.pen')) || {}; } catch { return {}; } })();
  let tool = canWrite ? 'pen' : 'hand';
  let color = HEX.test(pref.c) ? pref.c : COLORS[1][0], width = WIDTHS.some(([w]) => w === pref.w) ? pref.w : WIDTHS[1][0];
  const fingerPref = (() => { try { return JSON.parse(localStorage.getItem('bd.finger')); } catch { return null; } })();
  let fingerDraw = canWrite && (typeof fingerPref === 'boolean' ? fingerPref : matchMedia('(pointer: coarse)').matches);
  let penDown = false, penUpAt = 0, tapUndo = false, spaceDown = false;
  let cur = null, drag = null, pan = null, gesture = null, eraser = null, band = null;
  const sel = new Set();                                    // выделенные объекты
  let seq = 0, busy = 0;
  const bad = new Set();
  const unsub = [];
  const onChange = new Set();                              // подписчики интерфейса (выделение, отмена, масштаб)
  const emit = () => onChange.forEach((f) => f());

  // ---------- Слои ----------
  root.classList.add('bd2-stage');
  root.innerHTML = '<canvas class="bd2-base"></canvas><canvas class="bd2-ink"></canvas>';
  const base = root.querySelector('.bd2-base'), ink = root.querySelector('.bd2-ink');
  const bctx = base.getContext('2d', { alpha: false }), ictx = ink.getContext('2d');
  let rect = root.getBoundingClientRect();
  const refreshRect = () => { rect = root.getBoundingClientRect(); };
  const vw = () => root.clientWidth || 1, vh = () => root.clientHeight || 1;
  const dprOf = () => Math.min(2, window.devicePixelRatio || 1);

  // Кэш-холст: мир [cx0, cy0] — левый верхний угол, масштаб cz, плотность cdpr, размер cw×ch в CSS-пикселях
  const C = { valid: false, x0: 0, y0: 0, z: 1, dpr: 1, w: 0, h: 0 };
  let raf = 0, needBase = false, needInk = false, idleT = 0, lastMoveAt = 0, dirty = null;
  const sched = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const invalidate = () => { needBase = true; sched(); };          // перерисовать кэш целиком
  const invalidateRect = (b) => {                                   // перерисовать только кусок (стёрли, сдвинули)
    if (!b) return;
    dirty = dirty ? [Math.min(dirty[0], b[0]), Math.min(dirty[1], b[1]), Math.max(dirty[2], b[2]), Math.max(dirty[3], b[3])] : [...b];
    sched();
  };
  const redrawInk = () => { needInk = true; sched(); };
  const placeBase = () => {                                         // кэш на экране: только CSS-трансформация
    const s = view.z / C.z;
    base.style.transform = `translate(${(C.x0 - view.x) * view.z}px, ${(C.y0 - view.y) * view.z}px) scale(${s})`;
  };
  function coversView() {                                           // экран внутри кэша и масштаб не уехал слишком далеко
    if (!C.valid) return false;
    const r = view.z / C.z;
    if (r > 1.6 || r < 0.6) return false;
    return view.x >= C.x0 && view.y >= C.y0 && view.x + vw() / view.z <= C.x0 + C.w / C.z && view.y + vh() / view.z <= C.y0 + C.h / C.z;
  }
  function paintArea(g, r) {                                        // сетка + объекты области r (мировые координаты)
    drawGridPx(g, r[0], r[1], r[2], r[3], C.dpr * C.z, C.x0, C.y0, C.dpr);
    const list = index.query(r), tiny = 0.6 / C.z;                 // объект меньше ~полпикселя — не рисуем
    for (const it of list) if (it.kind === 'img' && !it.hidden) drawImg(g, it);
    for (const hl of [1, 0]) for (const it of list) {
      if (it.kind !== 'stroke' || it.hidden || !it.data.h !== !hl) continue;
      const b = bboxOf(it); if (b[2] - b[0] < tiny && b[3] - b[1] < tiny) continue;
      drawStroke(g, it.data, C.z);
    }
  }
  function repaint(r) {                                             // перерисовать только изменившийся кусок кэша
    const m = 2 / C.z, k = C.dpr * C.z, g = bctx;
    const a = [r[0] - m, r[1] - m, r[2] + m, r[3] + m];
    g.setTransform(k, 0, 0, k, -C.x0 * k, -C.y0 * k);
    g.save(); g.beginPath(); g.rect(a[0], a[1], a[2] - a[0], a[3] - a[1]); g.clip();
    g.fillStyle = '#fff'; g.fillRect(a[0], a[1], a[2] - a[0], a[3] - a[1]);
    paintArea(g, a);
    g.restore();
  }
  function renderBase() {
    const W = vw(), H = vh(), dpr = dprOf();
    // запас вокруг экрана: больше — плавнее сдвиг; ограничен 16 млн пикселей (предел Safari на один холст)
    const f = clamp(Math.sqrt(16e6 / (W * H * dpr * dpr)), 1, 1.8);
    C.z = view.z; C.dpr = dpr; C.w = Math.round(W * f); C.h = Math.round(H * f);
    C.x0 = view.x - ((C.w - W) / 2) / view.z; C.y0 = view.y - ((C.h - H) / 2) / view.z;
    const pw = Math.round(C.w * dpr), ph = Math.round(C.h * dpr);
    if (base.width !== pw || base.height !== ph) { base.width = pw; base.height = ph; base.style.width = `${C.w}px`; base.style.height = `${C.h}px`; }
    const g = bctx, k = dpr * C.z;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.fillRect(0, 0, pw, ph);
    g.setTransform(k, 0, 0, k, -C.x0 * k, -C.y0 * k);
    paintArea(g, [C.x0, C.y0, C.x0 + C.w / C.z, C.y0 + C.h / C.z]);
    C.valid = true; dirty = null; placeBase();
  }
  function appendBase(it) {                                         // новый объект поверх кэша, без полной перерисовки
    if (!C.valid || needBase || it.hidden) return;
    const k = C.dpr * C.z; bctx.setTransform(k, 0, 0, k, -C.x0 * k, -C.y0 * k);
    if (it.kind === 'img' || it.data.h) { invalidateRect(bboxOf(it)); return; }   // картинка и маркер — под чернилами: перерисовать кусок
    drawStroke(bctx, it.data, C.z);
  }
  function drawImg(g, it) {
    const d = it.data, el = getImg(d.path);
    if (el) g.drawImage(el, d.x, d.y, d.w, d.h);
    else { g.fillStyle = '#eef3f9'; g.fillRect(d.x, d.y, d.w, d.h); g.fillStyle = '#8aa0b8'; g.font = '28px sans-serif'; g.fillText(imgCache.get(d.path)?.failed ? 'Не удалось загрузить' : 'Загрузка…', d.x + 20, d.y + 44); }
  }
  function renderInk() {
    const W = vw(), H = vh(), dpr = dprOf(), pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (ink.width !== pw || ink.height !== ph) { ink.width = pw; ink.height = ph; }
    const g = ictx, k = dpr * view.z, s = 1 / view.z;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, pw, ph);
    g.setTransform(k, 0, 0, k, -view.x * k, -view.y * k);
    for (const l of live.values()) drawStroke(g, l.d, view.z, false);
    if (cur) drawStroke(g, cur.d, view.z, false);
    if (drag?.move) {                                               // перетаскиваемые объекты — на верхнем слое со сдвигом
      g.save(); g.translate(drag.dx, drag.dy);
      for (const it of sel) if (it.kind === 'img') drawImg(g, it);
      for (const it of sel) if (it.kind === 'stroke') drawStroke(g, it.data, view.z);
      g.restore();
    }
    if (sel.size) {
      const b = selBox(); if (b) {
        const ox = drag?.move ? drag.dx : 0, oy = drag?.move ? drag.dy : 0;
        g.strokeStyle = '#2563eb'; g.lineWidth = 1.5 * s; g.setLineDash([8 * s, 6 * s]);
        g.strokeRect(b[0] + ox - 6 * s, b[1] + oy - 6 * s, b[2] - b[0] + 12 * s, b[3] - b[1] + 12 * s); g.setLineDash([]);
      }
    }
    if (band) {
      const [x0, y0, x1, y1] = band; g.fillStyle = 'rgba(37,99,235,.08)'; g.strokeStyle = 'rgba(37,99,235,.7)'; g.lineWidth = 1.2 * s;
      g.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); g.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
    if (eraser) { g.beginPath(); g.arc(eraser.x, eraser.y, eraseR(), 0, Math.PI * 2); g.fillStyle = 'rgba(37,99,235,.08)'; g.fill(); g.strokeStyle = 'rgba(27,35,48,.55)'; g.lineWidth = 1.5 * s; g.stroke(); }
  }
  function frame() {
    raf = 0; if (!root.isConnected) return;
    // Во время сдвига и масштаба кэш просто растягивается CSS-ом. Перерисовываем целиком, когда кэш уже не покрывает экран,
    // а после жеста — чтобы при новом масштабе всё было чётким
    const moving = now() - lastMoveAt < 140, stale = !coversView(), blurry = C.valid && C.z !== view.z;
    if (stale || ((needBase || blurry) && !moving)) { needBase = false; renderBase(); }
    else { if (dirty && !needBase) { repaint(dirty); dirty = null; } placeBase(); }
    if (needBase || (C.valid && C.z !== view.z)) { clearTimeout(idleT); idleT = setTimeout(sched, 160); }
    if (needInk) { needInk = false; renderInk(); }
  }
  const viewChanged = () => { lastMoveAt = now(); needInk = true; sched(); emit(); };
  const eraseR = () => ERASE_PX[width] / view.z;
  const selBox = () => { let b = null; for (const it of sel) { const x = bboxOf(it); b = b ? [Math.min(b[0], x[0]), Math.min(b[1], x[1]), Math.max(b[2], x[2]), Math.max(b[3], x[3])] : [...x]; } return b; };

  // ---------- Сцена ----------
  function put(it, { draw = true } = {}) {                         // добавить или заменить объект
    const old = items.get(it.id), oldB = old?.cellb; if (old) index.remove(old);
    it.seq = old?.seq ?? ++seq; it.bb = null; items.set(it.id, it); index.add(it);
    if (oldB) invalidateRect(oldB);                                  // старое место освободилось
    if (draw || oldB) { if (oldB) invalidateRect(bboxOf(it)); else appendBase(it); }
  }
  function drop(id) { const it = items.get(id); if (!it) return null; invalidateRect(it.cellb || bboxOf(it)); index.remove(it); items.delete(id); sel.delete(it); return it; }

  // ---------- Вид ----------
  function zoomAt(z2, cx = vw() / 2, cy = vh() / 2) {
    z2 = clamp(z2, MIN_Z, MAX_Z);
    const wx = view.x + cx / view.z, wy = view.y + cy / view.z;
    view.z = z2; view.x = wx - cx / z2; view.y = wy - cy / z2; viewChanged();
  }
  function fit() {
    const W = vw(), H = vh(); let b = null;
    for (const it of items.values()) { const x = bboxOf(it); b = b ? [Math.min(b[0], x[0]), Math.min(b[1], x[1]), Math.max(b[2], x[2]), Math.max(b[3], x[3])] : [...x]; }
    if (!b) { view.z = clamp(W / 1400, 0.4, 1); view.x = -40; view.y = -40; }
    else { const pad = 80; view.z = clamp(Math.min(W / (b[2] - b[0] + pad * 2), H / (b[3] - b[1] + pad * 2)), MIN_Z, 1.2); view.x = (b[0] + b[2]) / 2 - W / 2 / view.z; view.y = (b[1] + b[3]) / 2 - H / 2 / view.z; }
    lastMoveAt = 0; invalidate(); viewChanged();
  }

  // ---------- Картинки ----------
  function loadImg(path) {
    let e = imgCache.get(path); if (e) return e.p;
    e = { el: null, failed: false };
    e.p = api.fileUrl(path).then((url) => new Promise((res) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { e.el = im; res(im); invalidate(); };
      im.onerror = () => { e.failed = true; res(null); invalidate(); };
      im.src = url;
    })).catch(() => { e.failed = true; invalidate(); return null; });
    imgCache.set(path, e); return e.p;
  }
  const getImg = (path) => { const e = imgCache.get(path); if (!e) { loadImg(path); return null; } return e.el; };
  async function addImage(file) {
    if (!canWrite || !file?.type?.startsWith('image/')) return;
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 1600 / bmp.width), c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
      const path = `${studentId}/board/${uuid()}.jpg`;
      const w = Math.round(Math.min(c.width, 900, (vw() / view.z) * 0.6)), h = Math.round((w * c.height) / c.width);
      const data = { path, x: Math.round(view.x + (vw() / view.z - w) / 2), y: Math.round(view.y + (vh() / view.z - h) / 2), w, h };
      const it = { id: uuid(), kind: 'img', data, sync: 'pending' };
      imgCache.set(path, { el: c, p: Promise.resolve(c), failed: false });
      put(it); setTool('select'); sel.clear(); sel.add(it); redrawInk(); emit();
      busy++; showSave();
      try { await api.upload(path, blob); await api.insert('board_items', { id: it.id, page_id: page.id, student_id: studentId, kind: 'img', data }); it.sync = 'db'; record({ t: 'add', items: [snap(it)] }); }
      catch (e) { drop(it.id); toast(`Не удалось добавить картинку: ${e.message}`, 'error'); }
      busy--; showSave(); emit();
    } catch { toast('Не удалось прочитать картинку', 'error'); }
  }

  // ---------- Сохранение: очередь вставок, удалений и изменений, отправка пачками, повторы без потерь ----------
  const outbox = new Map(), inflight = new Set(), updQ = new Map();
  let flushT = 0, flushP = null, fails = 0, delQ = [], delT = 0, delBusy = 0, delFail = false, updT = 0, updBusy = 0;
  let status = { text: '', s: '' }, warnT = 0, okT = 0;
  const netErr = (e) => /fetch|network|load failed|timeout|connection|offline|abort/i.test(e?.message || '') || navigator.onLine === false;
  const unsaved = () => outbox.size + delQ.length + delBusy + updQ.size + updBusy + busy;
  const setStatus = (text, s) => { status = { text, s }; emit(); };
  function showSave() {
    if (!unsaved()) {
      clearTimeout(warnT); warnT = 0;
      if (status.s === 'warn') { setStatus('✓ Сохранено', 'ok'); clearTimeout(okT); okT = setTimeout(() => { if (status.s === 'ok') setStatus('', ''); }, 2500); }
      return;
    }
    if (fails || delFail) setStatus(navigator.onLine === false ? 'Нет сети — сохраню, когда появится' : 'Сохраняю… (связь плохая, повторяю)', 'warn');
    else if (!warnT && status.s !== 'warn') warnT = setTimeout(() => { warnT = 0; if (drag?.erase) showSave(); else if (unsaved()) setStatus('Сохраняю…', 'warn'); }, 2500);
  }
  const row = (it) => ({ id: it.id, page_id: page.id, student_id: studentId, kind: it.kind, data: it.data });
  function queueIns(it) { it.sync = 'pending'; outbox.set(it.id, it); schedFlush(350); }
  function schedFlush(ms) { if (!flushT) flushT = setTimeout(() => { flushT = 0; flush(); }, ms); showSave(); }
  async function insertRows(rows) {
    try { await api.insertMany('board_items', rows); }
    catch (e) {                                              // после обрыва часть пачки могла записаться: досылаем по одной, дубли пропускаем
      if (!/duplicate key/i.test(e.message)) throw e;
      for (const r of rows) { try { await api.insert('board_items', r); } catch (e2) { if (!/duplicate key/i.test(e2.message)) throw e2; } }
    }
  }
  function flush() {
    if (flushP || !outbox.size) return flushP;
    if (drag?.erase) { schedFlush(300); return null; }       // пока стираешь, куски линии ещё меняются
    const batch = [...outbox.values()].slice(0, 200);
    batch.forEach((it) => inflight.add(it.id));
    flushP = (async () => {
      try { await insertRows(batch.map(row)); for (const it of batch) { outbox.delete(it.id); if (it.sync === 'pending') it.sync = 'db'; } fails = 0; }
      catch (e) {
        fails++;
        if (!netErr(e) && fails >= 4) { for (const it of batch) { outbox.delete(it.id); drop(it.id); } fails = 0; toast(`Часть доски не сохранилась: ${e.message}`, 'error'); }
      } finally { batch.forEach((it) => inflight.delete(it.id)); flushP = null; }
      if (outbox.size) schedFlush(fails ? Math.min(15000, 1000 * 2 ** Math.min(fails, 4)) : 30);
      showSave();
    })();
    return flushP;
  }
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
  function queueDel(it, { file = false } = {}) {
    const queued = outbox.delete(it.id); updQ.delete(it.id);
    if (!queued || inflight.has(it.id)) { delQ.push(it.id); if (!delT) delT = setTimeout(flushDel, 200); }
    if (file && it.kind === 'img' && okPath(it.data.path, studentId)) api.removeFile(it.data.path).catch(() => {});
    showSave();
  }
  function queueUpd(it) {
    if (outbox.has(it.id)) { outbox.set(it.id, it); return; }   // ещё не ушёл в базу — уйдёт уже сдвинутым
    updQ.set(it.id, it); clearTimeout(updT); updT = setTimeout(flushUpd, 300); showSave();
  }
  function flushUpd() {
    clearTimeout(updT); updT = 0;
    const list = [...updQ.values()]; updQ.clear(); if (!list.length) return;
    updBusy++;
    (async () => {
      try {
        if (flushP) await flushP;
        for (let i = 0; i < list.length; i += 6) await Promise.all(list.slice(i, i + 6).map((it) => api.update('board_items', it.id, { data: it.data })));
      } catch (e) { for (const it of list) if (items.get(it.id) === it) updQ.set(it.id, it); if (!updT) updT = setTimeout(flushUpd, 3000); if (!netErr(e)) toast(`Не удалось сохранить: ${e.message}`, 'error'); }
      finally { updBusy--; showSave(); }
    })();
  }

  // ---------- Отмена и повтор (свои действия) ----------
  // Записи: add [объекты], del [объекты], move {ids, dx, dy}, swap {removed, added} (ластик режет линию)
  const undoS = [], redoS = [];
  const snap = (it) => ({ id: it.id, kind: it.kind, data: it.data });
  const record = (e) => { undoS.push(e); if (undoS.length > 200) undoS.shift(); redoS.length = 0; emit(); };
  function applyAdd(list) { for (const s of list) { const it = { ...s, sync: 'pending' }; put(it); queueIns(it); } }
  function applyDel(list) { for (const s of list) { const it = drop(s.id); if (it) queueDel(it); } }
  function applyMove(ids, dx, dy) {
    for (const id of ids) { const it = items.get(id); if (!it) continue; it.data = shifted(it.kind, it.data, dx, dy); put(it, { draw: false }); queueUpd(it); }
  }
  function invert(e) {
    if (e.t === 'add') return { t: 'del', items: e.items };
    if (e.t === 'del') return { t: 'add', items: e.items };
    if (e.t === 'move') return { t: 'move', ids: e.ids, dx: -e.dx, dy: -e.dy };
    return { t: 'swap', removed: e.added, added: e.removed };
  }
  function apply(e) {
    if (e.t === 'add') applyAdd(e.items);
    else if (e.t === 'del') applyDel(e.items);
    else if (e.t === 'move') applyMove(e.ids, e.dx, e.dy);
    else { applyDel(e.removed); applyAdd(e.added); }
    sel.clear(); redrawInk(); emit();
  }
  function undo() { const e = undoS.pop(); if (!e) return; const inv = invert(e); apply(inv); redoS.push(e); emit(); }
  function redo() { const e = redoS.pop(); if (!e) return; apply(e); undoS.push(e); emit(); }

  // ---------- Живой штрих (видно, как пишет второй участник) ----------
  const chan = api.live(`board-live:${studentId}`, (m) => {
    if (!root.isConnected || !m || m.page !== page.id || typeof m.id !== 'string' || m.id.length > 40 || items.has(m.id)) return;
    if (m.x) { if (live.delete(m.id)) redrawInk(); return; }
    if (!Array.isArray(m.p) || m.p.length > 2000 || !m.p.every(fin) || !fin(m.w) || m.w < 1 || m.w > 60 || typeof m.c !== 'string' || !HEX.test(m.c)) return;
    let l = live.get(m.id);
    if (!l) { if (live.size >= 50) return; live.set(m.id, (l = { d: { c: m.c, w: m.w, p: [], ...(m.h === 1 ? { h: 1 } : {}) } })); }
    if (l.d.p.length + m.p.length > 20000) return;
    l.d.p.push(...m.p);
    if (m.end) { live.delete(m.id); if (sane('stroke', l.d, studentId)) put({ id: m.id, kind: 'stroke', data: l.d, sync: 'live', t: Date.now() }); }
    redrawInk();
  });
  function sendLive(force = false, end = false) {
    const t = Date.now();
    if (!cur || (!force && t - cur.t < 50)) return;
    const p = cur.d.p; let from = Math.max(0, cur.sent - 2);
    for (;;) {
      const to = Math.min(p.length, from + 1000), last = to >= p.length;
      chan.send({ id: cur.id, page: page.id, c: cur.d.c, w: cur.d.w, h: cur.d.h, p: p.slice(from, to), end: end && last });
      if (last) break; from = to - 2;
    }
    cur.sent = p.length; cur.t = t;
  }

  // ---------- Инструменты ----------
  const pt = (e) => [view.x + (e.clientX - rect.left) / view.z, view.y + (e.clientY - rect.top) / view.z];
  function topAt(x, y) {                                     // верхний объект под точкой (для выделения касанием)
    const r = 8 / view.z, list = index.query([x - r, y - r, x + r, y + r]);
    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      if (it.kind === 'img') { const d = it.data; if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return it; }
      else if (strokeHit(it.data, x, y, r)) return it;
    }
    return null;
  }
  function selectBand(b) {
    const r = [Math.min(b[0], b[2]), Math.min(b[1], b[3]), Math.max(b[0], b[2]), Math.max(b[1], b[3])];
    sel.clear();
    for (const it of index.query(r)) {
      if (it.kind === 'img') { const x = bboxOf(it); if (x[0] >= r[0] && x[2] <= r[2] && x[1] >= r[1] && x[3] <= r[3]) sel.add(it); continue; }
      const p = it.data.p;                                    // штрих — если хоть одна его точка внутри рамки
      for (let i = 0; i < p.length; i += 2) if (p[i] >= r[0] && p[i] <= r[2] && p[i + 1] >= r[1] && p[i + 1] <= r[3]) { sel.add(it); break; }
    }
    emit();
  }
  let eraseLog = null;                                         // что стёр текущий взмах — одной записью для «отменить»
  function eraseAt(x, y) {
    const r = eraseR();
    for (const it of index.query([x - r, y - r, x + r, y + r])) {
      if (it.kind !== 'stroke' || !strokeHit(it.data, x, y, r)) continue;
      const parts = cutStroke(it.data, x, y, r); if (!parts) continue;
      drop(it.id); queueDel(it);
      if (eraseLog.added.has(it.id)) eraseLog.added.delete(it.id); else eraseLog.removed.push(snap(it));
      for (const d of parts) { const n = { id: uuid(), kind: 'stroke', data: d, sync: 'pending' }; put(n, { draw: false }); queueIns(n); eraseLog.added.set(n.id, n); }
    }
  }
  function eraseTo(x, y) {
    const r = eraseR(), dx = x - drag.lx, dy = y - drag.ly, n = Math.min(60, Math.ceil(Math.hypot(dx, dy) / (r * 0.5)));
    for (let k = 1; k <= n; k++) eraseAt(drag.lx + (dx * k) / n, drag.ly + (dy * k) / n);
    drag.lx = x; drag.ly = y;
  }
  function deleteSel() {
    if (!sel.size || !canWrite) return;
    const list = [...sel].map(snap); for (const it of [...sel]) { drop(it.id); queueDel(it); }
    record({ t: 'del', items: list }); sel.clear(); redrawInk(); emit();
  }

  // ---------- Штрих ----------
  function startStroke(e, x, y) {
    const d = { c: color, w: tool === 'marker' ? width * MARK_K : width, p: [q1(x), q1(y)] };
    if (tool === 'marker') d.h = 1;
    cur = { id: uuid(), type: e.pointerType, t0: now(), sent: 0, t: 0, d };
    sendLive(true); redrawInk();
  }
  function dropStroke() { if (!cur) return; chan.send({ id: cur.id, page: page.id, x: 1 }); cur = null; redrawInk(); }
  function finishStroke() {
    if (!cur) return;
    sendLive(true, true);
    cur.d.p = simplify(cur.d.p, clamp(0.35 / view.z, 0.08, 1.2));
    const it = { id: cur.id, kind: 'stroke', data: cur.d, sync: 'pending' };
    cur = null; put(it); queueIns(it); record({ t: 'add', items: [snap(it)] }); redrawInk();
  }
  function endFingerWork() {
    if (cur?.type === 'touch') { if (now() - cur.t0 < 250 || cur.d.p.length < 10) dropStroke(); else finishStroke(); }
    if (drag) endDrag(true);
  }
  function endDrag(cancel = false) {
    const d = drag; drag = null; if (!d) return;
    if (d.erase) {
      eraser = null;
      if (eraseLog && (eraseLog.removed.length || eraseLog.added.size)) record({ t: 'swap', removed: eraseLog.removed, added: [...eraseLog.added.values()].map(snap) });
      eraseLog = null; schedFlush(100);
    } else if (d.move) {
      for (const it of sel) it.hidden = false;
      if (!cancel && (Math.abs(d.dx) > 0.5 || Math.abs(d.dy) > 0.5)) { applyMove([...sel].map((it) => it.id), d.dx, d.dy); record({ t: 'move', ids: [...sel].map((it) => it.id), dx: d.dx, dy: d.dy }); }
      else invalidateRect(selBox());
    } else if (d.band) { if (!cancel) selectBand(band); band = null; }
    redrawInk(); emit();
  }

  // ---------- Указатель ----------
  const startPan = (e) => { pan = { id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; root.classList.add('panning'); };
  const capture = (id) => { try { ink.setPointerCapture(id); } catch { /* указатель уже отпущен */ } };
  const mid = () => { const a = [...touches.values()]; return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1 }; };
  function setFinger(on, save = true) { fingerDraw = on; if (save) try { localStorage.setItem('bd.finger', JSON.stringify(on)); } catch {} emit(); }

  function down(e) {
    refreshRect();
    if (e.pointerType === 'pen') {
      penDown = true;
      if (fingerDraw && fingerPref === null) setFinger(false, false);   // стилус найден: ладонь больше не рисует
      if (cur?.type === 'touch') dropStroke();
      if (pan && touches.has(pan.id)) { pan = null; root.classList.remove('panning'); }
      touches.clear(); gesture = null; tapUndo = false;
    }
    if (e.pointerType === 'touch') {
      if (penDown || now() - penUpAt < 300) return;              // ладонь во время письма стилусом
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); capture(e.pointerId);
      if (touches.size === 2) {
        endFingerWork(); pan = null; root.classList.remove('panning');
        const m = mid();
        gesture = { d0: m.d, z0: view.z, mx: m.x, my: m.y, t0: now(), moved: false, wx: view.x + (m.x - rect.left) / view.z, wy: view.y + (m.y - rect.top) / view.z };
        return;
      }
      if (touches.size > 2) { if (gesture) gesture.moved = true; return; }
      if (!fingerDraw || !canWrite || tool === 'hand') { e.preventDefault(); startPan(e); return; }
    } else capture(e.pointerId);
    if (e.button === 1 || e.button === 2 || tool === 'hand' || spaceDown || !canWrite) { e.preventDefault(); startPan(e); return; }
    if (e.button > 0) return;
    e.preventDefault();
    const [x, y] = pt(e);
    if (tool === 'pen' || tool === 'marker') { sel.clear(); startStroke(e, x, y); }
    else if (tool === 'eraser') { sel.clear(); eraseLog = { removed: [], added: new Map() }; drag = { erase: true, lx: x, ly: y }; eraser = { x, y }; eraseAt(x, y); redrawInk(); }
    else if (tool === 'select') {
      const b = selBox(), r = 10 / view.z;
      const inSel = b && x >= b[0] - r && x <= b[2] + r && y >= b[1] - r && y <= b[3] + r;
      if (!inSel) { const hit = topAt(x, y); sel.clear(); if (hit) sel.add(hit); emit(); }
      if (sel.size) {                                         // тянем выделенное
        drag = { move: true, x0: x, y0: y, dx: 0, dy: 0 };
        for (const it of sel) it.hidden = true; invalidateRect(selBox());
      } else { drag = { band: true }; band = [x, y, x, y]; }
      redrawInk();
    }
  }
  function move(e) {
    if (e.pointerType === 'touch') { if (!touches.has(e.pointerId)) return; touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); }
    if (gesture) {                                            // два пальца: масштаб и сдвиг
      if (touches.size < 2) return;
      const m = mid(), z = clamp((gesture.z0 * m.d) / gesture.d0, MIN_Z, MAX_Z);
      if (!gesture.moved && (Math.abs(m.d - gesture.d0) > 12 || Math.hypot(m.x - gesture.mx, m.y - gesture.my) > 12)) gesture.moved = true;
      if (!gesture.moved) return;
      view.z = z; view.x = gesture.wx - (m.x - rect.left) / z; view.y = gesture.wy - (m.y - rect.top) / z; viewChanged(); return;
    }
    if (pan) { if (pan.id !== e.pointerId) return; view.x = pan.vx - (e.clientX - pan.sx) / view.z; view.y = pan.vy - (e.clientY - pan.sy) / view.z; viewChanged(); return; }
    if (!cur && !drag) {
      if (tool === 'eraser' && e.pointerType !== 'touch') { const [x, y] = pt(e); eraser = { x, y }; redrawInk(); }
      return;
    }
    const co = (cur || drag?.erase) && e.getCoalescedEvents?.(), evs = co?.length ? co : [e];
    for (const ev of evs) {
      const [x, y] = pt(ev);
      if (cur) {
        const p = cur.d.p, rx = q1(x), ry = q1(y);
        if (Math.hypot(rx - p[p.length - 2], ry - p[p.length - 1]) < 0.8 / view.z) continue;
        p.push(rx, ry);
        if (p.length >= 19000) { finishStroke(); startStroke(e, x, y); }
      } else if (drag.erase) { eraseTo(x, y); eraser = { x, y }; }
      else if (drag.move) { drag.dx = x - drag.x0; drag.dy = y - drag.y0; }
      else if (drag.band) { band[2] = x; band[3] = y; }
    }
    if (cur) sendLive();
    redrawInk();
  }
  function up(e) {
    if (e.pointerType === 'pen') { penDown = false; penUpAt = now(); }
    if (e.pointerType === 'touch') {
      if (!touches.delete(e.pointerId)) return;
      if (gesture) {
        if (!gesture.moved && now() - gesture.t0 < 350 && canWrite) tapUndo = true;
        if (touches.size < 2) { gesture = null; lastMoveAt = 0; sched(); }
        if (!touches.size && tapUndo) { tapUndo = false; undo(); }
        return;
      }
      if (!touches.size && tapUndo) { tapUndo = false; undo(); return; }
    }
    if (pan) { if (pan.id === e.pointerId) { pan = null; root.classList.remove('panning'); lastMoveAt = 0; sched(); } return; }
    if (cur) finishStroke(); else if (drag) endDrag(e.type === 'pointercancel');
    if (e.pointerType === 'touch') { eraser = null; redrawInk(); }
  }
  ink.addEventListener('contextmenu', (e) => e.preventDefault());
  ink.addEventListener('pointerdown', down);
  ink.addEventListener('pointermove', move);
  ink.addEventListener('pointerup', up);
  ink.addEventListener('pointercancel', up);
  ink.addEventListener('pointerleave', (e) => { if (eraser && !drag && e.pointerType !== 'touch') { eraser = null; redrawInk(); } });
  const noTouch = (e) => e.preventDefault();                  // Safari: без лупы, выделения и масштаба страницы
  root.addEventListener('touchstart', noTouch, { passive: false });
  root.addEventListener('touchmove', noTouch, { passive: false });
  root.addEventListener('gesturestart', noTouch);
  ink.addEventListener('wheel', (e) => {
    e.preventDefault();
    const u = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1, dx = e.deltaX * u, dy = e.deltaY * u;
    if (e.ctrlKey || e.metaKey) zoomAt(view.z * Math.exp(-dy * 0.01), e.clientX - rect.left, e.clientY - rect.top);
    else { view.x += (e.shiftKey && !dx ? dy : dx) / view.z; view.y += (e.shiftKey ? 0 : dy) / view.z; viewChanged(); }
  }, { passive: false });

  function setTool(t) {
    if (!canWrite && t !== 'hand') return;
    tool = t; if (t !== 'select') sel.clear(); if (t !== 'eraser') eraser = null;
    root.dataset.tool = t; redrawInk(); emit();
  }
  function setColor(c) { if (!HEX.test(c)) return; color = c; try { localStorage.setItem('bd.pen', JSON.stringify({ c, w: width })); } catch {} if (tool !== 'pen' && tool !== 'marker') setTool('pen'); emit(); }
  function setWidth(w) { width = w; try { localStorage.setItem('bd.pen', JSON.stringify({ c: color, w })); } catch {} redrawInk(); emit(); }

  // ---------- Клавиатура, вставка, перетаскивание файлов ----------
  const typing = (e) => e.target.closest?.('input, textarea, select, [contenteditable], .modal');
  const onKey = (e) => {
    if (!root.isConnected) return stop();
    if (typing(e)) return;
    if (e.code === 'Space' && !e.target.closest?.('button, a')) { if (!spaceDown) { spaceDown = true; root.classList.add('space'); } e.preventDefault(); return; }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.code === 'KeyZ' && canWrite) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.code === 'KeyY' && canWrite) { e.preventDefault(); redo(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel.size) { e.preventDefault(); deleteSel(); return; }
    if (e.key === 'Escape' && sel.size) { sel.clear(); redrawInk(); emit(); return; }
    if (mod || e.altKey) return;
    if (e.key === '+' || e.key === '=') zoomAt(view.z * 1.25);
    else if (e.key === '-' || e.key === '_') zoomAt(view.z / 1.25);
    else if (e.key === '0') fit();
    else { const t = { KeyV: 'select', KeyP: 'pen', KeyM: 'marker', KeyE: 'eraser', KeyH: 'hand' }[e.code]; if (t) setTool(t); }
  };
  const onKeyUp = (e) => { if (e.code === 'Space') { spaceDown = false; root.classList.remove('space'); } };
  const onPaste = (e) => { if (!canWrite) return; const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); addImage(f); } };
  const onOnline = () => { fails = 0; flush(); flushDel(); flushUpd(); };
  const onHide = () => { if (document.visibilityState === 'hidden') { flush(); flushDel(); flushUpd(); } };
  const onLeave = (e) => { if (unsaved()) { flush(); flushDel(); flushUpd(); e.preventDefault(); e.returnValue = ''; } };
  addEventListener('keydown', onKey); addEventListener('keyup', onKeyUp); addEventListener('paste', onPaste);
  addEventListener('online', onOnline); addEventListener('beforeunload', onLeave); document.addEventListener('visibilitychange', onHide);
  root.addEventListener('dragover', (e) => { if (canWrite) e.preventDefault(); });
  root.addEventListener('drop', (e) => { if (!canWrite) return; e.preventDefault(); [...e.dataTransfer.files].forEach(addImage); });
  const ro = new ResizeObserver(() => { refreshRect(); C.valid = false; invalidate(); redrawInk(); }); ro.observe(root);
  addEventListener('resize', refreshRect);

  // ---------- Загрузка и живые обновления ----------
  try {
    const rows = await api.select('board_items', { eq: { page_id: page.id }, order: 'created_at' });
    for (const r of rows) { if (sane(r.kind, r.data, studentId)) put({ id: r.id, kind: r.kind, data: r.data, sync: 'db' }, { draw: false }); else bad.add(r.id); }
  } catch (e) { toast(`Не удалось загрузить доску: ${e.message}`, 'error'); }
  function onItem(ev) {
    if (!root.isConnected) return stop();
    const n = ev.new, o = ev.old;
    if (ev.eventType === 'INSERT') {
      if (n.page_id !== page.id) return;
      if (!sane(n.kind, n.data, studentId)) { bad.add(n.id); return; }
      const ex = items.get(n.id);
      if (!ex) { if (outbox.has(n.id) || inflight.has(n.id)) return; live.delete(n.id); put({ id: n.id, kind: n.kind, data: n.data, sync: 'db' }); redrawInk(); }
      else if (ex.sync === 'live') { ex.data = n.data; ex.sync = 'db'; index.remove(ex); ex.bb = null; index.add(ex); }   // та же линия, перерисовывать не нужно
      else if (ex.sync === 'pending') ex.sync = 'db';
    } else if (ev.eventType === 'DELETE') { if (items.has(o.id) && !outbox.has(o.id)) { drop(o.id); redrawInk(); emit(); } }
    else if (ev.eventType === 'UPDATE') {
      const it = items.get(n.id);
      if (it && !updQ.has(n.id) && !(drag?.move && sel.has(it)) && sane(it.kind, n.data, studentId)) { it.data = n.data; put(it, { draw: false }); redrawInk(); }
    }
  }
  // Сверка с базой: Realtime не гарантирует доставку (обрыв, сон вкладки) — раз в несколько секунд сравниваем число объектов
  let timer = null, online = false, reconciling = false;
  const quiet = () => unsaved() || flushP || cur || drag;
  async function reconcile() {
    if (!root.isConnected) return stop();
    if (reconciling || quiet()) return;
    reconciling = true;
    try {
      const { count } = await api.page('board_items', { from: 0, to: 0, cols: 'id', eq: { page_id: page.id } });
      const t = Date.now(); let inDb = 0, stale = false;
      for (const it of items.values()) { if (it.sync === 'db') inDb++; else if (it.sync === 'live' && t - it.t > 20000) stale = true; }
      if (count === inDb + bad.size && !stale) return;
      const rows = await api.select('board_items', { eq: { page_id: page.id }, order: 'created_at' });
      if (quiet()) return;
      const ids = new Set(rows.map((r) => r.id)); let ch = false;
      for (const r of rows) {
        if (!sane(r.kind, r.data, studentId)) { bad.add(r.id); continue; }
        const ex = items.get(r.id);
        if (!ex) { put({ id: r.id, kind: r.kind, data: r.data, sync: 'db' }, { draw: false }); ch = true; }
        else if (ex.sync === 'live') { ex.data = r.data; ex.sync = 'db'; put(ex, { draw: false }); ch = true; }
      }
      for (const [id, it] of items) if (!ids.has(id) && (it.sync === 'db' || (it.sync === 'live' && t - it.t > 20000))) { index.remove(it); items.delete(id); sel.delete(it); ch = true; }
      if (ch) { invalidate(); redrawInk(); emit(); }
    } catch { /* повторим */ } finally { reconciling = false; }
  }
  const onStatus = (st) => { online = st === 'SUBSCRIBED'; emit(); clearInterval(timer); timer = setInterval(reconcile, online ? 8000 : 3000); if (online) reconcile(); };
  timer = setInterval(reconcile, 3000);
  unsub.push(api.subscribe('board_items', `student_id=eq.${studentId}`, onItem, onStatus));

  // ---------- Скачать картинкой ----------
  async function exportPng() {
    const list = [...items.values()];
    if (!list.length) return toast('На доске пока пусто', 'error');
    await Promise.all(list.filter((i) => i.kind === 'img').map((i) => loadImg(i.data.path)));
    let b = null; for (const it of list) { const x = bboxOf(it); b = b ? [Math.min(b[0], x[0]), Math.min(b[1], x[1]), Math.max(b[2], x[2]), Math.max(b[3], x[3])] : [...x]; }
    const pad = 60, x0 = Math.floor((b[0] - pad) / CELL) * CELL, y0 = Math.floor((b[1] - pad) / CELL) * CELL;
    const w = Math.max(1200, Math.ceil((b[2] + pad - x0) / CELL) * CELL), h = Math.max(800, Math.ceil((b[3] + pad - y0) / CELL) * CELL);
    const k = Math.min(1, 4000 / Math.max(w, h)), c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k); const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    drawGrid(g, x0, y0, x0 + w, y0 + h, k);
    const sorted = list.sort((a, z) => a.seq - z.seq);
    for (const it of sorted) if (it.kind === 'img') { const el = imgCache.get(it.data.path)?.el; if (el) g.drawImage(el, it.data.x, it.data.y, it.data.w, it.data.h); }
    for (const hl of [1, 0]) for (const it of sorted) if (it.kind === 'stroke' && !it.data.h === !hl) drawStroke(g, it.data, 1);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `доска-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function clearAll() {
    confirmDialog('Стереть всю доску? Вернуть нельзя.', async () => {
      outbox.clear(); updQ.clear(); if (flushP) await flushP;
      await api.removeWhere('board_items', { page_id: page.id });
      for (const it of items.values()) index.remove(it);
      items.clear(); sel.clear(); undoS.length = 0; redoS.length = 0; invalidate(); redrawInk(); emit();
    }, 'Очистить');
  }

  function stop() {
    if (cur) finishStroke();
    flush(); flushDel(); flushUpd();
    unsub.forEach((f) => { try { f(); } catch {} }); unsub.length = 0;
    clearInterval(timer); ro.disconnect(); chan.close();
    removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); removeEventListener('paste', onPaste);
    removeEventListener('online', onOnline); removeEventListener('beforeunload', onLeave); removeEventListener('resize', refreshRect);
    document.removeEventListener('visibilitychange', onHide);
  }

  root.dataset.tool = tool;
  fit();
  return {
    get state() { return { tool, color, width, fingerDraw, zoom: view.z, canUndo: undoS.length > 0, canRedo: redoS.length > 0, selected: sel.size, status, online, count: items.size }; },
    onChange: (f) => { onChange.add(f); return () => onChange.delete(f); },
    setTool, setColor, setWidth, setFinger, undo, redo, deleteSel, fit, exportPng, clearAll, addImage,
    zoomIn: () => zoomAt(view.z * 1.25), zoomOut: () => zoomAt(view.z / 1.25), zoomReset: () => zoomAt(1),
    canWrite, isTutor, stop,
  };
}
