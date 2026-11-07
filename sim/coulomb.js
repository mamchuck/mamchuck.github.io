// Сцена «Закон Кулона и электрическое поле»: два точечных заряда, силы между ними и силовые линии поля.
// F = k|q₁||q₂|/r². При q в мкКл и r в см: F = 90·|q₁q₂|/r² (в ньютонах). Заряд можно сдвигать мышью: расстояние меняется симметрично.
// Силовые линии идут от «+» к «−»: их число у заряда пропорционально его величине, густота показывает силу поля.
import { fmt, tex, arrow, rr, math as mathHtml } from './tex.js?v=202611071149';

const SW = 520, SH = 400, CY = 190, SC = 6.2, K = 90;
const COLQ = { pos: '#e03131', neg: '#1971c2', F: '#e8590c', E: '#7048e8' };
const sgn = (q) => (q > 0 ? '+' : q < 0 ? '−' : '0');

export const coulomb = {
  id: 'coulomb',
  mode: 'free',
  title: 'Закон Кулона и электрическое поле',
  lead: 'Два точечных заряда. Меняй заряды и расстояние (заряд можно двигать мышью) и смотри, как меняется сила. Силовые линии идут от «+» к «−»: чем они гуще, тем сильнее поле. Одноимённые заряды отталкиваются, разноимённые притягиваются.',
  stage: { w: SW, h: SH, label: 'Два точечных заряда, силы взаимодействия и силовые линии' },
  params: [
    { id: 'q1', name: 'Первый заряд', tex: 'q_1', unit: 'мкКл', min: -10, max: 10, step: 1, def: 5, dec: 0 },
    { id: 'q2', name: 'Второй заряд', tex: 'q_2', unit: 'мкКл', min: -10, max: 10, step: 1, def: -5, dec: 0 },
    { id: 'r', name: 'Расстояние между зарядами', tex: 'r', unit: 'см', min: 8, max: 50, step: 1, def: 30, dec: 0 },
  ],
  toggles: [{ id: 'lines', name: 'Силовые линии', color: '#7048e8', on: true }, { id: 'f', name: 'Силы', color: '#e8590c', on: true }],
  actions: [
    { id: 'r2', group: 'Опыты', label: 'Расстояние ×2', color: '#2563eb' },
    { id: 'h2', group: 'Опыты', label: 'Расстояние ÷2', color: '#2563eb' },
    { id: 'q2x', group: 'Опыты', label: 'Заряд q₁ ×2', color: '#e8590c' },
    { id: 'same', group: 'Опыты', label: 'Одноимённые', color: '#e03131' },
    { id: 'opp', group: 'Опыты', label: 'Разноимённые', color: '#1971c2' },
  ],
  act(id, p) {
    const c = (v, a, b) => Math.max(a, Math.min(b, v));
    return { set: { r2: { r: c(p.r * 2, 8, 50) }, h2: { r: c(Math.round(p.r / 2), 8, 50) }, q2x: { q1: c(p.q1 * 2, -10, 10) }, same: { q1: Math.abs(p.q1) || 5, q2: Math.abs(p.q2) || 5 }, opp: { q1: Math.abs(p.q1) || 5, q2: -(Math.abs(p.q2) || 5) } }[id] };
  },
  derive(p) {
    const F = (K * Math.abs(p.q1 * p.q2)) / (p.r * p.r), same = p.q1 * p.q2 > 0, zero = p.q1 === 0 || p.q2 === 0;
    const h = p.r / 2, Emid = (K * (p.q1 - p.q2)) / (h * h);                                      // поле посередине вдоль оси x в единицах 10⁶ Н/Кл: заряд 1 слева толкает вправо, заряд 2 справа — влево
    return { F, same, zero, Emid, x1: SW / 2 - (p.r * SC) / 2, x2: SW / 2 + (p.r * SC) / 2 };
  },
  readouts: (p, d) => [['Сила взаимодействия', 'F = k|q_1 q_2|/r^2', d.zero ? '0 Н' : `${fmt(d.F, d.F < 1 ? 3 : 2)} Н`], ['Характер силы', '', d.zero ? 'нет' : d.same ? 'отталкивание' : 'притяжение'],
    ['Поле посередине', 'E', Math.abs(d.Emid) < 1e-9 ? '0' : `${fmt(Math.abs(d.Emid), 2)}·10⁶ Н/Кл ${d.Emid > 0 ? '→' : '←'}`]],
  formulas: [
    { tag: 'Закон Кулона', color: '#e8590c', tex: 'F = k\\dfrac{|q_1||q_2|}{r^2},\\quad k = 9\\cdot10^9\\ \\dfrac{\\text{Н}\\cdot\\text{м}^2}{\\text{Кл}^2}' },
    { tag: 'Напряжённость точечного заряда', color: '#7048e8', tex: 'E = k\\dfrac{|q|}{r^2},\\qquad \\vec F = q\\vec E' },
    { tag: 'Если меняем расстояние', color: '#2563eb', tex: 'F \\propto \\dfrac{1}{r^2}:\\quad r \\to 2r\\ \\Rightarrow\\ F \\to \\dfrac{F}{4}' },
  ],
  note: 'Длина стрелок силы растёт медленнее самой силы (логарифмическая шкала), чтобы большие и малые силы одновременно помещались на экране. Число силовых линий у заряда пропорционально его величине.',
  info(p, d) {
    const cond = d.zero ? 'один из зарядов равен нулю: силы нет' : d.same ? 'заряды одного знака: силы отталкивания' : 'заряды разных знаков: силы притяжения';
    return `<div class="sm-big" style="font-size:26px">${d.zero ? '0 Н' : `${fmt(d.F, d.F < 1 ? 3 : 2)} Н`}</div>
      <div><span class="sm-chip">${cond}</span></div>
      <table class="sm-it"><tr><td>q₁</td><td>${sgn(p.q1)} ${fmt(Math.abs(p.q1), 0)} мкКл</td></tr><tr><td>q₂</td><td>${sgn(p.q2)} ${fmt(Math.abs(p.q2), 0)} мкКл</td></tr><tr><td>r</td><td>${fmt(p.r, 0)} см = ${fmt(p.r / 100, 2)} м</td></tr><tr><td>F₁ на 2 = F₂ на 1</td><td>${d.zero ? '0' : fmt(d.F, 2)} Н</td></tr></table>
      <div class="sm-eq">Третий закон Ньютона: силы, с которыми заряды действуют друг на друга, <b>равны по модулю</b>, даже если заряды разные.<small>Пример: F = 90·${fmt(Math.abs(p.q1 * p.q2), 0)}/${fmt(p.r * p.r, 0)} = ${fmt(d.F, 2)} Н</small></div>`;
  },

  mount(box) {
    const bg = document.createElement('canvas'); bg.className = 'sm-sbg'; box.prepend(bg);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label); bg.setAttribute('aria-hidden', 'true');
    let P = null, d = null, on = { lines: true, f: true };
    const full = () => {
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.4e6 / (cssW * ((cssW * SH) / SW)))));
      bg.width = Math.round(cssW * dpr); bg.height = Math.round(((cssW * SH) / SW) * dpr);
      const g = bg.getContext('2d'); g.setTransform(bg.width / SW, 0, 0, bg.height / SH, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round'; return g;
    };
    const lab = (c, str, x, y, o) => {                                                         // подпись на светлой подложке: линии поля не мешают читать
      const w = tex(c, str, x, y, { ...o, color: 'rgba(0,0,0,0)' }), x0 = o.align === 'center' ? x - w / 2 : x;
      rr(c, x0 - 5, y - o.size + 1, w + 10, o.size + 7, 6); c.fillStyle = 'rgba(244,246,250,.88)'; c.fill(); tex(c, str, x, y, o);
    };
    const field = (x, y, ch) => { let ex = 0, ey = 0; for (const c of ch) { const dx = x - c.x, dy = y - c.y, r2 = dx * dx + dy * dy + 1, r3 = r2 * Math.sqrt(r2); ex += (c.q * dx) / r3; ey += (c.q * dy) / r3; } return [ex, ey]; };
    const lines = (c, ch) => {
      const pos = ch.filter((q) => q.q > 0), seeds = pos.length ? pos : ch.filter((q) => q.q < 0), dirn = pos.length ? 1 : -1, qm = Math.max(...ch.map((q) => Math.abs(q.q)), 1);
      c.strokeStyle = 'rgba(112,72,232,.55)'; c.lineWidth = 1.4;
      for (const s of seeds) {
        const m = Math.max(4, Math.round(16 * Math.sqrt(Math.abs(s.q) / qm)));
        for (let k = 0; k < m; k++) {
          const a = (k / m) * 2 * Math.PI + 0.001; let x = s.x + 17 * Math.cos(a), y = s.y + 17 * Math.sin(a), len = 0, last = [x, y];
          c.beginPath(); c.moveTo(x, y);
          for (let it = 0; it < 700; it++) {
            const [ex, ey] = field(x, y, ch), m2 = Math.hypot(ex, ey) || 1; x += (dirn * ex * 3) / m2; y += (dirn * ey * 3) / m2; len += 3;
            if (x < 2 || x > SW - 2 || y < 2 || y > SH - 2) { c.lineTo(x, y); break; }
            if (ch.some((q) => q !== s && Math.hypot(x - q.x, y - q.y) < 14)) { c.lineTo(x, y); break; }
            c.lineTo(x, y);
            if (len > 90) { len = 0; const ang = Math.atan2(dirn * ey, dirn * ex); c.stroke(); arrow(c, x - 5 * Math.cos(ang), y - 5 * Math.sin(ang), x + 3 * Math.cos(ang), y + 3 * Math.sin(ang), { color: 'rgba(112,72,232,.8)', lw: 1.4, head: 7 }); c.beginPath(); c.moveTo(x, y); }
          }
          c.stroke();
        }
      }
    };
    const paint = () => {
      const c = full(); c.clearRect(0, 0, SW, SH); if (!d) return;
      const ch = [{ x: d.x1, y: CY, q: P.q1 }, { x: d.x2, y: CY, q: P.q2 }];
      const act = ch.filter((q) => q.q !== 0); if (on.lines && act.length) lines(c, act);
      // ось и расстояние r
      c.strokeStyle = '#6b7a90'; c.lineWidth = 1.2; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(d.x1, CY + 92); c.lineTo(d.x2, CY + 92); c.stroke(); c.setLineDash([]);
      arrow(c, d.x1, CY + 92, d.x2, CY + 92, { color: '#6b7a90', lw: 1.3, head: 7 }); arrow(c, d.x2, CY + 92, d.x1, CY + 92, { color: '#6b7a90', lw: 1.3, head: 7 });
      lab(c, `r = ${fmt(P.r, 0)} см`, SW / 2, CY + 116, { size: 16, align: 'center', color: '#3b475c' });
      // силы (логарифмическая шкала)
      if (on.f && !d.zero) {
        const L = Math.min(118, 20 + 24 * Math.log10(d.F + 1)), toward = d.same ? -1 : 1;                 // у отталкивания силы направлены наружу, у притяжения — друг к другу
        arrow(c, d.x1, CY - 36, d.x1 + toward * L, CY - 36, { color: COLQ.F, lw: 3.2, head: 12 }); arrow(c, d.x2, CY - 36, d.x2 - toward * L, CY - 36, { color: COLQ.F, lw: 3.2, head: 12 });
        lab(c, `F = ${fmt(d.F, 2)} Н`, SW / 2, CY - 56, { size: 17, align: 'center', color: '#c2410c' });
      }
      // заряды
      for (const q of ch) {
        const r = 12 + Math.min(10, Math.abs(q.q)), col = q.q > 0 ? COLQ.pos : q.q < 0 ? COLQ.neg : '#868e96';
        const g = c.createRadialGradient(q.x - 4, CY - 5, 2, q.x, CY, r); g.addColorStop(0, q.q > 0 ? '#ff9b9b' : q.q < 0 ? '#8fc4f5' : '#d9dee6'); g.addColorStop(1, col);
        c.beginPath(); c.arc(q.x, CY, r, 0, 7); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(30,30,40,.6)'; c.lineWidth = 1.6; c.stroke();
        c.strokeStyle = '#fff'; c.lineWidth = 2.6; c.beginPath(); if (q.q) { c.moveTo(q.x - 6, CY); c.lineTo(q.x + 6, CY); if (q.q > 0) { c.moveTo(q.x, CY - 6); c.lineTo(q.x, CY + 6); } } c.stroke();
        lab(c, `q = ${q.q > 0 ? '+' : q.q < 0 ? '−' : ''}${fmt(Math.abs(q.q), 0)} мкКл`, q.x, CY + 58, { size: 15, align: 'center', color: col });
      }
    };
    return { resize() {}, params(p, dd) { P = p; d = dd; paint(); }, update(dd, flags) { if (!!flags.lines !== on.lines || !!flags.f !== on.f) { on = { lines: !!flags.lines, f: !!flags.f }; paint(); } }, busy: () => false, animate() {} };
  },
};
coulomb.drag = {
  hit: (p, d, x, y) => Math.abs(y - CY) < 34 && (Math.abs(x - d.x1) < 28 || Math.abs(x - d.x2) < 28),
  to: (p, x) => ({ r: Math.max(8, Math.min(50, Math.round((2 * Math.abs(x - SW / 2)) / SC))) }),
};
