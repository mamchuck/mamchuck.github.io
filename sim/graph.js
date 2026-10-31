// Графики величин от времени с общей осью (как в учебнике): сетка, подписи, отметки периода T и характерных моментов.
// Ничего тяжёлого не перерисовывается в кадре: сетка и кривые рисуются один раз в два холста, а двигаются только лёгкие элементы:
//   «жирная» часть кривой открывается обрезкой верхнего холста, курсор и точки — это обычные элементы со сдвигом (их ведёт видеокарта).
import { fmt, tex, fitCanvas } from './tex.js?v=202610311450';

const ML = 52, MR = 10, GAP = 8, TOP = 8, AXIS = 34;
const nice = (x) => { const e = 10 ** Math.floor(Math.log10(x)), f = x / e; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e; };
const dec = (v) => (v >= 10 ? 0 : v >= 1 ? 1 : v >= 0.1 ? 2 : 3);
const el = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };

export class Graphs {
  constructor(wrap) {
    this.wrap = wrap; this.panels = []; this.T = 1; this.marks = []; this.dots = [];
    this.base = el('sm-gl sm-gl-base', 'canvas'); this.trace = el('sm-gl sm-gl-trace', 'canvas'); this.line = el('sm-gcur'); this.holder = el('sm-gdots');
    wrap.append(this.base, this.trace, this.line, this.holder);
  }
  px(t) { return ML + (t / this.T) * (this.W - ML - MR); }

  setup({ panels, T, period, marks = [] }) { this.panels = panels; this.T = T; this.period = period; this.marks = marks; this.build(); }

  build() {
    const { panels, wrap } = this; if (!panels.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    const W = (this.W = Math.round(Math.max(260, wrap.clientWidth || 480))), H = (this.H = Math.round(Math.max(200, wrap.clientHeight || 360)));   // рисуем 1:1 по размеру окна: подписи всегда читаемы
    const PH = (this.PH = Math.max(46, (H - TOP - AXIS + GAP) / panels.length - GAP)), tstep = nice(this.T / (W < 420 ? 4 : 6));
    this.f = (wrap.clientWidth || W) / W;
    const c = fitCanvas(this.base, W, H, 1.3e6), gt = fitCanvas(this.trace, W, H, 1.3e6);
    c.clearRect(0, 0, W, H); gt.clearRect(0, 0, W, H);
    panels.forEach((p, i) => {
      const y0 = TOP + i * (PH + GAP), ymax = p.max * 1.18, ymin = p.signed ? -ymax : 0;
      p.y0 = y0; p.yy = (v) => y0 + PH - ((v - ymin) / (ymax - ymin)) * PH;
      c.lineWidth = 1; c.strokeStyle = '#e4ecf6'; c.beginPath();
      for (let t = 0; t <= this.T + 1e-9; t += tstep) { const x = Math.round(this.px(t)) + 0.5; c.moveTo(x, y0); c.lineTo(x, y0 + PH); }
      const ticks = p.signed ? [-p.max, -p.max / 2, 0, p.max / 2, p.max] : [0, p.max / 2, p.max];
      for (const v of ticks) { const y = Math.round(p.yy(v)) + 0.5; c.moveTo(ML, y); c.lineTo(W - MR, y); }
      c.stroke();
      c.setLineDash([3, 3]); c.lineWidth = 1;                               // характерные моменты
      for (const m of this.marks) { c.strokeStyle = m.kind === 'ext' ? 'rgba(240,138,0,.6)' : 'rgba(37,99,235,.5)'; const x = Math.round(this.px(m.t)) + 0.5; c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 + PH); c.stroke(); }
      c.setLineDash([]);
      c.strokeStyle = '#2a3140'; c.lineWidth = 1.1; c.strokeRect(ML + 0.5, y0 + 0.5, W - ML - MR, PH);
      if (p.signed) { c.beginPath(); c.moveTo(ML, Math.round(p.yy(0)) + 0.5); c.lineTo(W - MR, Math.round(p.yy(0)) + 0.5); c.stroke(); }
      for (const v of (p.signed ? [-p.max, 0, p.max] : ticks)) tex(c, fmt(v, v === 0 ? 0 : dec(p.max)), ML - 7, p.yy(v) + 4, { size: 12, align: 'right', color: '#3b475c' });
      tex(c, p.label, 12, y0 + 18, { size: 17 }); tex(c, p.unit, 12, y0 + 34, { size: 12, color: '#6b7a90' });
      for (const [g, alpha, lw] of [[c, 0.28, 2], [gt, 1, 2.5]]) {            // бледная кривая (нижний холст) и насыщенная (верхний, открывается по мере движения)
        g.save(); g.beginPath(); g.rect(ML, y0 - 1, W - ML - MR, PH + 2); g.clip();
        for (const cu of p.curves) {
          if (g === gt && cu.dash) continue;
          g.strokeStyle = cu.color; g.globalAlpha = alpha; g.lineWidth = lw; g.lineJoin = 'round'; g.setLineDash(cu.dash || []); g.beginPath();
          const N = 360; for (let k = 0; k <= N; k++) { const t = (k / N) * this.T, x = this.px(t), y = p.yy(cu.f(t)); k ? g.lineTo(x, y) : g.moveTo(x, y); }
          g.stroke();
        }
        g.restore();
      }
      if (p.curves.length > 1) p.curves.forEach((cu, k) => { c.fillStyle = cu.color; c.fillRect(ML + 10 + k * 60, y0 + 10, 14, 3); tex(c, cu.name, ML + 29 + k * 60, y0 + 15, { size: 12.5 }); });
    });
    const ay = TOP + panels.length * (PH + GAP) - GAP;
    c.strokeStyle = '#2a3140'; c.lineWidth = 1;
    for (let t = 0; t <= this.T + 1e-9; t += tstep) { const x = this.px(t); c.beginPath(); c.moveTo(x, ay); c.lineTo(x, ay + 4); c.stroke(); tex(c, fmt(t, tstep < 1 ? 1 : 0), x, ay + 17, { size: 12, align: 'center', color: '#3b475c' }); }
    for (let k = 1; k * this.period <= this.T + 1e-9; k++) { const x = this.px(k * this.period); c.strokeStyle = '#e8590c'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(x, ay - 5); c.lineTo(x, ay + 5); c.stroke(); tex(c, k === 1 ? 'T' : `${k}T`, x, ay + 31, { size: 14, color: '#c2410c', align: 'center' }); }
    tex(c, 't, с', ML - 14, ay + 17, { size: 12.5, align: 'right', color: '#6b7a90' });
    // курсор и точки: обычные элементы, их двигает видеокарта
    this.line.style.top = `${((TOP - 2) / H) * 100}%`; this.line.style.height = `${((this.H - AXIS + GAP - TOP) / H) * 100}%`;
    this.holder.replaceChildren(); this.dots = [];
    for (const p of panels) for (const cu of p.curves) { if (cu.dash) continue; const d = el('sm-gdot'); d.style.background = cu.color; this.holder.append(d); this.dots.push([d, p, cu]); }
    this.last = -1;
  }

  draw(t) {
    if (!this.panels.length || !this.dots) return;
    const f = this.f, x = this.px(t) * f;
    this.line.style.transform = `translate3d(${x}px,0,0)`;
    this.trace.style.clipPath = `inset(0 ${Math.max(0, this.wrap.clientWidth - x)}px 0 0)`;
    for (const [d, p, cu] of this.dots) d.style.transform = `translate3d(${x}px,${p.yy(cu.f(t)) * f}px,0)`;
  }
}
