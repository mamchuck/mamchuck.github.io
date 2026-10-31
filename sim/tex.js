// Рисунок «как в научной книге» (стиль TeX/TikZ): тонкие чёрные линии, засечки, курсивные обозначения величин,
// штриховка стен, стрелки-«стелс», пружина-катушка. Всё рисуется на canvas в логических единицах.
export const INK = '#1b2330';
// KaTeX_* подхватятся, если шрифты добавлены в sim.css; иначе берётся ближайшая системная антиква
export const SERIF = '"KaTeX_Main","Latin Modern Roman","CMU Serif","STIX Two Text",Cambria,"Times New Roman",Times,serif';
export const MATH = '"KaTeX_Math","Latin Modern Roman","CMU Serif","STIX Two Math","STIX Two Text","Cambria Math","Times New Roman",Times,serif';

export const fmt = (n, d = 2) => (Math.abs(n) < 0.5 * 10 ** -d ? 0 : n).toFixed(d).replace('.', ',').replace('-', '−');

// ---------- Холст: чёткий на любом экране, рисуем в логических единицах w×h ----------
export function fitCanvas(cv, w, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), cssW = cv.clientWidth || w;
  const pw = Math.round(cssW * dpr), ph = Math.round((cssW * h / w) * dpr);
  cv.style.height = `${cssW * h / w}px`;
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(pw / w, 0, 0, ph / h, 0, 0);
  return ctx;
}
export function layer(cv) {                                   // скрытый слой того же размера (для всего, что не меняется между кадрами)
  const l = document.createElement('canvas'); l.width = cv.width; l.height = cv.height;
  return l;
}

// ---------- Надписи: _{под} ^{над} \v{вектор}; латиница и греческие — курсивом, цифры и русские слова — прямо ----------
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
    let run = '', math = null;
    const flush = () => { if (!run) return; ctx.font = math ? `italic ${sz}px ${MATH}` : `${sz}px ${SERIF}`; const mw = ctx.measureText(run).width; ops.push({ run, math, sz, dy, x: w, vec: tk.k === 'vec', mw }); w += mw; run = ''; };
    for (const ch of tk.s) { const m = isMath(ch); if (math !== null && m !== math) flush(); math = m; run += ch; }
    flush();
  }
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.fillStyle = ctx.strokeStyle = color; ctx.textBaseline = 'alphabetic';
  for (const o of ops) {
    ctx.font = o.math ? `italic ${o.sz}px ${MATH}` : `${o.sz}px ${SERIF}`; ctx.fillText(o.run, x0 + o.x, y + o.dy);
    if (o.vec) {                                          // стрелка над буквой
      const ax = x0 + o.x + o.mw * 0.08, bx = x0 + o.x + o.mw * 0.95, ay = y - o.sz * 0.78;
      ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, ay); ctx.moveTo(bx - 3, ay - 2.2); ctx.lineTo(bx, ay); ctx.lineTo(bx - 3, ay + 2.2); ctx.stroke();
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

// ---------- Штриховка («north east lines») ----------
export function hatch(ctx, x, y, w, h, step = 7, { color = INK, lw = 0.9 } = {}) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
  for (let d = -h; d < w; d += step) { ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); }
  ctx.stroke(); ctx.restore();
}

// ---------- Пружина-катушка: задние витки тоньше и светлее, передние с белой «обводкой» (витки перекрывают друг друга) ----------
export function coil(ctx, x0, x1, y, { turns = 12, r = 17, lead = 14, lean = 0.5, lw = 1.7, color = INK } = {}) {
  const xs = x0 + lead, xe = x1 - lead, Lc = xe - xs;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(Math.min(xs, x1), y); ctx.moveTo(Math.max(xe, x0), y); ctx.lineTo(x1, y); ctx.stroke();
  if (Lc < 3) return;
  const M = turns * 22, X = new Float32Array(M + 1), Y = new Float32Array(M + 1), Z = new Float32Array(M + 1);
  for (let i = 0; i <= M; i++) { const u = i / M, th = 2 * Math.PI * turns * u; X[i] = xs + Lc * u + lean * r * (Math.cos(th) - 1); Y[i] = y + r * Math.sin(th); Z[i] = Math.cos(th); }
  const runs = (front) => {                              // подряд идущие точки с одной стороны витка — одной ломаной
    const out = []; let cur = null;
    for (let i = 0; i < M; i++) {
      const f = (Z[i] + Z[i + 1]) >= 0;
      if (f === front) { if (!cur) { cur = [i]; out.push(cur); } cur.push(i + 1); } else cur = null;
    }
    return out;
  };
  const stroke = (rs) => { ctx.beginPath(); for (const r of rs) { ctx.moveTo(X[r[0]], Y[r[0]]); for (let k = 1; k < r.length; k++) ctx.lineTo(X[r[k]], Y[r[k]]); } ctx.stroke(); };
  const back = runs(false), front = runs(true);
  ctx.strokeStyle = '#7d8da6'; ctx.lineWidth = lw * 0.85; stroke(back);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = lw + 3.4; stroke(front);
  ctx.strokeStyle = color; ctx.lineWidth = lw; stroke(front);
}

// ---------- Кубик в косоугольной проекции (видны передняя, верхняя и правая грани) ----------
export function cube(ctx, x, yTop, s, { dx = 20, dy = 15, front = '#dbe7fb', top = '#f2f6fe', side = '#bcd0f2', color = INK, lw = 1.4 } = {}) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.fillStyle = top; ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x + dx, yTop - dy); ctx.lineTo(x + s + dx, yTop - dy); ctx.lineTo(x + s, yTop); ctx.closePath(); ctx.fill(); ctx.stroke();
  const sidePath = () => { ctx.beginPath(); ctx.moveTo(x + s, yTop); ctx.lineTo(x + s + dx, yTop - dy); ctx.lineTo(x + s + dx, yTop + s - dy); ctx.lineTo(x + s, yTop + s); ctx.closePath(); };
  ctx.fillStyle = side; sidePath(); ctx.fill();
  ctx.save(); sidePath(); ctx.clip(); ctx.strokeStyle = '#7f9bd0'; ctx.lineWidth = 0.7; ctx.beginPath();     // тонкая штриховка правой грани
  for (let d = -s; d < dx + 4; d += 4.5) { ctx.moveTo(x + s + d, yTop + s + 2); ctx.lineTo(x + s + d + s * 0.6, yTop + s + 2 - s * 0.6); }
  ctx.stroke(); ctx.restore();
  ctx.strokeStyle = color; ctx.lineWidth = lw; sidePath(); ctx.stroke();
  ctx.fillStyle = front; ctx.beginPath(); ctx.rect(x, yTop, s, s); ctx.fill(); ctx.stroke();
}
