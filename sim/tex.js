// Рисование «как в книге по физике»: настоящие шрифты и формулы LaTeX (KaTeX, лежит на сайте, ничего не грузится снаружи),
// аккуратные стрелки, пружина-катушка, скруглённые детали. Всё рисуется на canvas в логических единицах.
export const INK = '#1b2330';
export const SERIF = '"KaTeX_Main","Latin Modern Roman","STIX Two Text",Cambria,"Times New Roman",serif';
export const MATH = '"KaTeX_Math","Latin Modern Roman","STIX Two Math","STIX Two Text",Cambria,"Times New Roman",serif';

export const fmt = (n, d = 2) => (Math.abs(n) < 0.5 * 10 ** -d ? 0 : n).toFixed(d).replace('.', ',').replace('-', '−');

// ---------- KaTeX: подключаем один раз (скрипт, стили и шрифты берутся с нашего же сайта) ----------
const here = (p) => new URL(p, import.meta.url).href;
let kx;
function loadKatex() {
  if (kx) return kx;
  kx = new Promise((resolve) => {
    if (!document.querySelector('link[data-katex]')) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = here('./katex/katex.min.css'); l.dataset.katex = '1'; document.head.append(l);
    }
    if (window.katex) return resolve(window.katex);
    const s = document.createElement('script'); s.src = here('./katex/katex.min.js'); s.onload = () => resolve(window.katex); s.onerror = () => resolve(null);
    document.head.append(s);
  }).then(async (k) => {
    // шрифты нужны ещё до первого кадра, иначе подписи на холсте мигнут запасным шрифтом
    const fonts = ['16px KaTeX_Main', 'italic 16px KaTeX_Main', 'bold 16px KaTeX_Main', 'italic 16px KaTeX_Math'];
    await Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
    return k;
  });
  return kx;
}
export const ready = () => loadKatex();
// Формула LaTeX → HTML (без дублирующей MathML-разметки)
export function math(latex, display = false) {
  const k = window.katex;
  if (!k) return latex.replace(/[\\{}_^]/g, '');
  return k.renderToString(latex, { output: 'html', throwOnError: false, strict: 'ignore', displayMode: display });
}

// ---------- Холсты ----------
// Размер холста подгоняем под экран; число точек ограничено, чтобы на больших экранах с плотностью 2× кадр не тяжелел.
export function fitCanvas(cv, w, h, cap = 1.7e6) {
  const cssW = cv.clientWidth || w, cssH = cssW * h / w;
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(cap / (cssW * cssH))));
  const pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(pw / w, 0, 0, ph / h, 0, 0);
  return ctx;
}
// Готовая картинка (спрайт): рисуем сложное один раз, потом в кадре только копируем
export function sprite(w, h, k, draw) {
  const c = document.createElement('canvas'); c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
  const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); draw(g); return c;
}
export function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ---------- Подписи: _{под} ^{над} \v{вектор}; латиница и греческие — курсивом (KaTeX_Math), цифры и русские слова — прямо ----------
const isMath = (c) => /[A-Za-zΑ-Ωα-ωϕφ]/.test(c);
function tokenize(s) {
  const t = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '_' || c === '^') {
      i++; let g;
      if (s[i] === '{') { const j = s.indexOf('}', i); g = s.slice(i + 1, j); i = j + 1; } else { g = s[i]; i++; }
      t.push({ k: c === '_' ? 'sub' : 'sup', s: g });
    } else if (s.startsWith('\\v{', i)) { const j = s.indexOf('}', i); t.push({ k: 'vec', s: s.slice(i + 3, j) }); i = j + 1; }
    else { let j = i; while (j < s.length && !'_^\\'.includes(s[j])) j++; if (j === i) j = i + 1; t.push({ k: 'txt', s: s.slice(i, j) }); i = j; }
  }
  return t;
}
export function tex(ctx, src, x, y, { size = 16, color = INK, align = 'left' } = {}) {
  const ops = []; let w = 0;
  for (const tk of tokenize(src)) {
    const sz = tk.k === 'sub' || tk.k === 'sup' ? size * 0.7 : size, dy = tk.k === 'sub' ? size * 0.26 : tk.k === 'sup' ? -size * 0.38 : 0;
    let run = '', math_ = null;
    const flush = () => { if (!run) return; ctx.font = math_ ? `italic ${sz}px ${MATH}` : `${sz}px ${SERIF}`; const mw = ctx.measureText(run).width; ops.push({ run, math: math_, sz, dy, x: w, vec: tk.k === 'vec', mw }); w += mw; run = ''; };
    for (const ch of tk.s) { const m = isMath(ch); if (math_ !== null && m !== math_) flush(); math_ = m; run += ch; }
    flush();
  }
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.fillStyle = ctx.strokeStyle = color; ctx.textBaseline = 'alphabetic';
  for (const o of ops) {
    ctx.font = o.math ? `italic ${o.sz}px ${MATH}` : `${o.sz}px ${SERIF}`; ctx.fillText(o.run, x0 + o.x, y + o.dy);
    if (o.vec) {                                          // стрелка над буквой
      const ax = x0 + o.x + o.mw * 0.1, bx = x0 + o.x + o.mw * 0.95, ay = y - o.sz * 0.8;
      ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, ay); ctx.moveTo(bx - 3.4, ay - 2.6); ctx.lineTo(bx, ay); ctx.lineTo(bx - 3.4, ay + 2.6); ctx.stroke();
    }
  }
  return w;
}

// ---------- Стрелка в стиле TikZ «stealth» ----------
export function arrow(ctx, x0, y0, x1, y1, { color = INK, lw = 1.6, head = 9, wide = 0.42, dash = null } = {}) {
  const L = Math.hypot(x1 - x0, y1 - y0); if (L < 1.5) return;
  const a = Math.atan2(y1 - y0, x1 - x0), c = Math.cos(a), s = Math.sin(a), hl = Math.min(head, L), nx = x1 - c * hl * 0.68, ny = y1 - s * hl * 0.68;
  ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'butt'; ctx.setLineDash(dash || []);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(nx, ny); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - c * hl - s * hl * wide, y1 - s * hl + c * hl * wide); ctx.lineTo(nx, ny);
  ctx.lineTo(x1 - c * hl + s * hl * wide, y1 - s * hl - c * hl * wide); ctx.closePath(); ctx.fill();
}

// ---------- Штриховка ----------
export function hatch(ctx, x, y, w, h, step = 7, { color = INK, lw = 0.9 } = {}) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
  for (let d = -h; d < w; d += step) { ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); }
  ctx.stroke(); ctx.restore();
}

// ---------- Пружина-катушка: задние витки тоньше и светлее, передние с обводкой цвета фона (витки перекрывают друг друга) ----------
export function coil(ctx, x0, x1, y, { turns = 13, r = 16, lead = 12, lean = 0.5, lw = 1.7, color = '#2b3140', halo = '#eef0f5' } = {}) {
  const xs = x0 + lead, xe = x1 - lead, Lc = xe - xs;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(Math.min(xs, x1), y); ctx.moveTo(Math.max(xe, x0), y); ctx.lineTo(x1, y); ctx.stroke();
  if (Lc < 3) return;
  const M = turns * 18, X = new Float32Array(M + 1), Y = new Float32Array(M + 1), Z = new Float32Array(M + 1);
  for (let i = 0; i <= M; i++) { const u = i / M, th = 2 * Math.PI * turns * u; X[i] = xs + Lc * u + lean * r * (Math.cos(th) - 1); Y[i] = y + r * Math.sin(th); Z[i] = Math.cos(th); }
  const runs = (front) => {
    const out = []; let cur = null;
    for (let i = 0; i < M; i++) { const f = (Z[i] + Z[i + 1]) >= 0; if (f === front) { if (!cur) { cur = [i]; out.push(cur); } cur.push(i + 1); } else cur = null; }
    return out;
  };
  const stroke = (rs) => { ctx.beginPath(); for (const r_ of rs) { ctx.moveTo(X[r_[0]], Y[r_[0]]); for (let k = 1; k < r_.length; k++) ctx.lineTo(X[r_[k]], Y[r_[k]]); } ctx.stroke(); };
  const back = runs(false), front = runs(true);
  ctx.strokeStyle = '#8590a3'; ctx.lineWidth = lw * 0.85; stroke(back);
  ctx.strokeStyle = halo; ctx.lineWidth = lw + 3.2; stroke(front);
  ctx.strokeStyle = color; ctx.lineWidth = lw; stroke(front);
}
