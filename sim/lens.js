// Сцена «Линза и изображение»: тонкая линза, три главных луча, изображение предмета. Предмет можно перетаскивать вдоль оси.
// Формула тонкой линзы 1/F = 1/d + 1/f со знаками: F > 0 у собирающей, F < 0 у рассеивающей; f < 0 — изображение мнимое (по ту же сторону, что предмет).
import { fmt, tex, arrow, sprite, math as mathHtml } from './tex.js?v=202611021941';

const SW = 520, SH = 400, LX = 292, Y0 = 208, SC = 4.4, LH = 100;
const COL = { r1: '#d6336c', r2: '#1f9d55', r3: '#2563eb', obj: '#e8590c', img: '#7048e8' };
const CASES = [['d > 2F', 'real-small', 'действительное, перевёрнутое, уменьшенное'], ['d = 2F', 'real-same', 'действительное, перевёрнутое, того же размера'], ['F < d < 2F', 'real-big', 'действительное, перевёрнутое, увеличенное'], ['d = F', 'none', 'изображения нет (лучи идут параллельно)'], ['d < F', 'virt-big', 'мнимое, прямое, увеличенное']];

export const lens = {
  id: 'lens',
  mode: 'free',
  title: 'Линза и изображение',
  lead: 'Передвинь предмет (его можно взять мышью) и смотри, как меняется изображение. Три главных луча строят его: параллельный оси проходит через фокус, луч через центр не преломляется, луч через передний фокус выходит параллельно оси.',
  stage: { w: SW, h: SH, label: 'Линза, предмет, три главных луча и изображение' },
  params: [
    { id: 'ty', name: 'Линза', tex: 'F', unit: '', dec: 0, def: 1, options: [{ label: 'Собирающая', v: 1 }, { label: 'Рассеивающая', v: -1 }], fmt: (v) => (v > 0 ? 'F > 0' : 'F < 0') },
    { id: 'F', name: 'Фокусное расстояние', tex: '|F|', unit: 'см', min: 4, max: 30, step: 1, def: 10, dec: 0 },
    { id: 'd', name: 'Расстояние до предмета', tex: 'd', unit: 'см', min: 2, max: 60, step: 0.5, def: 25, dec: 1 },
    { id: 'h', name: 'Высота предмета', tex: 'h', unit: 'см', min: 1, max: 8, step: 0.5, def: 4, dec: 1 },
  ],
  derive(p) {
    const F = p.ty * p.F, d = p.d, conv = F > 0, parallel = conv && Math.abs(d - F) < 1e-6, f = parallel ? Infinity : (d * F) / (d - F);
    const G = parallel ? Infinity : -f / d, H = parallel ? Infinity : G * p.h, real = !parallel && f > 0, virt = !parallel && f < 0;
    let kind = conv ? (parallel ? 'none' : d > 2 * F + 1e-6 ? 'real-small' : Math.abs(d - 2 * F) < 1e-6 ? 'real-same' : d > F ? 'real-big' : 'virt-big') : 'virt-small';
    const D = 1 / (F / 100);
    return { F, conv, f, G, H, real, virt, parallel, kind, D };
  },
  readouts: (p, d) => [['Оптическая сила', 'D = 1/F', `${fmt(d.D, 1)} дптр`], ['Расстояние до изображения', 'f', d.parallel ? '—' : `${fmt(d.f, 1)} см`],
    ['Увеличение', '\\Gamma', d.parallel ? '—' : fmt(Math.abs(d.G), 2)], ['Высота изображения', 'H', d.parallel ? '—' : `${fmt(Math.abs(d.H), 1)} см`],
    ['Изображение', '', d.parallel ? 'нет' : d.real ? 'действительное' : 'мнимое']],
  formulas: [
    { tag: 'Формула тонкой линзы', color: '#2563eb', tex: '\\dfrac{1}{F} = \\dfrac{1}{d} + \\dfrac{1}{f}' },
    { tag: 'Увеличение', color: '#1f9d55', tex: '\\Gamma = \\dfrac{H}{h} = \\dfrac{|f|}{d}' },
    { tag: 'Оптическая сила', color: '#e8590c', tex: 'D = \\dfrac{1}{F}\\ \\ (\\text{дптр},\\ F\\ \\text{в метрах})' },
  ],
  note: 'У собирающей линзы F > 0, у рассеивающей F < 0. Отрицательное f означает мнимое изображение: лучи не пересекаются, пересекаются их продолжения.',
  info(p, d) {
    const rows = d.conv ? CASES : [['Рассеивающая линза', 'virt-small', 'мнимое, прямое, уменьшенное (при любом d)']];
    const head = d.parallel ? 'нет изображения' : `${d.real ? 'действительное' : 'мнимое'}, ${d.H < 0 ? 'перевёрнутое' : 'прямое'}, ${Math.abs(d.G) > 1.0005 ? 'увеличенное' : Math.abs(d.G) < 0.9995 ? 'уменьшенное' : 'того же размера'}`;
    return `<div class="sm-big" style="font-size:26px">${d.conv ? 'Собирающая' : 'Рассеивающая'} линза</div>
      <div><span class="sm-chip">${head}</span></div>
      <table class="sm-it"><tr><td>F</td><td>${fmt(d.F, 1)} см</td></tr><tr><td>d (предмет)</td><td>${fmt(p.d, 1)} см</td></tr><tr><td>f (изображение)</td><td>${d.parallel ? '∞' : fmt(d.f, 1) + ' см'}</td></tr><tr><td>Γ = |f|/d</td><td>${d.parallel ? '—' : fmt(Math.abs(d.G), 2)}</td></tr></table>
      <h4 style="margin-top:12px">Случаи</h4>
      ${rows.map(([n, k, t]) => `<div class="sm-eq" style="${k === d.kind ? 'box-shadow: inset 0 0 0 2px #2563eb; background: rgba(37,99,235,.12);' : ''}"><b>${n}</b>: ${t}</div>`).join('')}`;
  },

  mount(box) {
    const bg = document.createElement('canvas'); bg.className = 'sm-sbg'; box.prepend(bg);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label); bg.setAttribute('aria-hidden', 'true');
    let P = null, d = null;
    const full = (cv) => {
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.4e6 / (cssW * ((cssW * SH) / SW)))));
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(((cssW * SH) / SW) * dpr);
      const g = cv.getContext('2d'); g.setTransform(cv.width / SW, 0, 0, cv.height / SH, 0, 0); return g;
    };
    const line = (c, x1, y1, x2, y2, color, lw = 1.8, dash = null) => { c.strokeStyle = color; c.lineWidth = lw; c.setLineDash(dash || []); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.setLineDash([]); };
    const ray = (c, x0, y0, x1, y1, color, far) => {                        // луч от точки (x0,y0) через (x1,y1) до правого края (или до точки far)
      const k = (y1 - y0) / (x1 - x0), xe = far ?? SW - 6; line(c, x0, y0, xe, y0 + k * (xe - x0), color, 1.9);
    };
    const paint = () => {
      const c = full(bg); c.clearRect(0, 0, SW, SH);
      const conv = d.conv, F = Math.abs(d.F), xo = LX - P.d * SC, hp = P.h * SC, yt = Y0 - hp;
      // ось и деления F, 2F
      line(c, 8, Y0, SW - 8, Y0, '#2a3140', 1.4);
      for (const [m, lab] of [[1, 'F'], [2, '2F']]) for (const sg of [-1, 1]) { const x = LX + sg * m * F * SC; if (x < 10 || x > SW - 10) continue; line(c, x, Y0 - 5, x, Y0 + 5, '#2a3140', 1.4); tex(c, lab, x, Y0 + 24, { size: 14, align: 'center', color: '#3b475c' }); }
      // линза
      c.fillStyle = 'rgba(100,160,255,.22)'; c.strokeStyle = '#2f62c9'; c.lineWidth = 1.8; c.beginPath();
      if (conv) { c.moveTo(LX, Y0 - LH); c.quadraticCurveTo(LX + 26, Y0, LX, Y0 + LH); c.quadraticCurveTo(LX - 26, Y0, LX, Y0 - LH); }
      else { c.moveTo(LX - 12, Y0 - LH); c.lineTo(LX + 12, Y0 - LH); c.quadraticCurveTo(LX + 2, Y0, LX + 12, Y0 + LH); c.lineTo(LX - 12, Y0 + LH); c.quadraticCurveTo(LX - 2, Y0, LX - 12, Y0 - LH); }
      c.closePath(); c.fill(); c.stroke();
      for (const sg of [-1, 1]) { const yy = Y0 + sg * LH, dir = conv ? sg : -sg; c.fillStyle = '#2f62c9'; c.beginPath(); c.moveTo(LX, yy + dir * 0); c.lineTo(LX - 6, yy - dir * 11); c.lineTo(LX + 6, yy - dir * 11); c.closePath(); c.fill(); }
      // предмет
      const objX = xo; if (objX > 6) { arrow(c, objX, Y0, objX, yt, { color: COL.obj, lw: 3.2, head: 12 }); tex(c, 'предмет', objX, Y0 + 44, { size: 13, align: 'center', color: '#c2410c' }); }
      // главные лучи (до линзы — отрезки, после линзы — лучи до края сцены)
      const Fs = d.F * SC, aF = Math.abs(Fs);
      const y3 = conv ? yt + (Y0 - yt) * (P.d / (P.d - d.F)) : yt + (Y0 - yt) * (P.d / (P.d + aF));
      // луч 1: параллельно оси; после собирающей идёт через задний фокус, после рассеивающей — так, будто вышел из переднего фокуса
      line(c, objX, yt, LX, yt, COL.r1, 1.9);
      if (conv) ray(c, LX, yt, LX + Fs, Y0, COL.r1);
      else { const fx = LX - aF; const k = (yt - Y0) / (LX - fx); line(c, LX, yt, SW - 6, yt + k * (SW - 6 - LX), COL.r1, 1.9); line(c, fx, Y0, LX, yt, COL.r1, 1.3, [4, 4]); }
      // луч 2: через центр линзы, не преломляется
      ray(c, objX, yt, LX, Y0, COL.r2);
      // луч 3: направлен на передний фокус (у рассеивающей — на задний); после линзы идёт параллельно оси
      if (!(conv && Math.abs(P.d - d.F) < 0.25)) { line(c, objX, yt, LX, y3, COL.r3, 1.9); line(c, LX, y3, SW - 6, y3, COL.r3, 1.9); }
      // изображение
      if (!d.parallel) {
        const xi = LX + d.f * SC;
        const imgY = Y0 - d.H * SC;
        if (d.real) { if (xi < SW - 6) { arrow(c, xi, Y0, xi, imgY, { color: COL.img, lw: 3.2, head: 12 }); tex(c, 'изображение', xi, Y0 + (imgY < Y0 ? 44 : -34), { size: 13, align: 'center', color: '#5b3bbf' }); } else tex(c, 'изображение далеко →', SW - 12, Y0 - 12, { size: 13, align: 'right', color: '#5b3bbf' }); }
        else {
          // мнимое: продолжения лучей назад пунктиром и изображение пунктиром
          for (const [y, col] of [[yt, COL.r1], [Y0, COL.r2], [y3, COL.r3]]) line(c, LX, y, xi, conv && y === Y0 ? imgY : imgY, col, 1.3, [4, 4]);
          if (xi > 4) { c.setLineDash([5, 4]); arrow(c, xi, Y0, xi, imgY, { color: COL.img, lw: 2.8, head: 11, dash: [5, 4] }); tex(c, 'изображение (мнимое)', Math.max(90, xi), imgY < Y0 ? imgY - 14 : Y0 - 34, { size: 13, align: 'center', color: '#5b3bbf' }); }
        }
        // размеры d и f
        const yD = Y0 + LH + 22; arrow(c, objX, yD, LX, yD, { color: '#6b7a90', lw: 1.2, head: 7 }); arrow(c, LX, yD, objX, yD, { color: '#6b7a90', lw: 1.2, head: 7 });
        tex(c, `d = ${fmt(P.d, 1)} см`, (objX + LX) / 2, yD - 6, { size: 13, align: 'center' });
        if (Math.abs(xi - LX) > 12) { const yF = d.real ? yD : yD + 20; arrow(c, LX, yF, xi, yF, { color: '#6b7a90', lw: 1.2, head: 7 }); arrow(c, xi, yF, LX, yF, { color: '#6b7a90', lw: 1.2, head: 7 }); tex(c, `f = ${fmt(Math.abs(d.f), 1)} см`, (LX + xi) / 2, yF - 6, { size: 13, align: 'center' }); }
      }
    };
    return {
      resize() { /* размеры берутся при перерисовке */ },
      params(p, dd) { P = p; d = dd; paint(); },
      update() {},
    };
  },
};
lens.drag = {
  hit: (p, d, x, y) => { const xo = LX - p.d * SC; return Math.abs(x - xo) < 20 && y > Y0 - p.h * SC - 22 && y < Y0 + 52; },
  to: (p, x) => ({ d: Math.max(2, Math.min(60, Math.round(((LX - x) / SC) * 2) / 2)) }),
};
