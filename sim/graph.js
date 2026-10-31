// Графики величин от времени с общей осью (как в учебнике): сетка, подписи, отметки периода T и характерных моментов.
// Быстро: сетка, оси и кривые рисуются один раз в скрытые слои; в кадре только копирование слоя, «жирная» часть кривой до текущего момента и курсор.
import { INK, fmt, tex, layer, fitCanvas } from './tex.js?v=202610311416';

const WMAX = 640, ML = 52, MR = 12, PH = 76, GAP = 10, TOP = 8, AXIS = 34;
const nice = (x) => { const e = 10 ** Math.floor(Math.log10(x)), f = x / e; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e; };
const dec = (v) => (v >= 10 ? 0 : v >= 1 ? 1 : v >= 0.1 ? 2 : 3);

export class Graphs {
  constructor(cv) { this.fs = 1; this.cv = cv; this.panels = []; this.T = 1; this.marks = []; this.cur = null; }

  // panels: [{label, unit, signed, max, curves:[{f(t), color, dash}]}], T — длина окна по времени, tick — шаг подписей T
  setup({ panels, T, period, marks = [], fs = 1 }) { this.fs = fs; this.panels = panels; this.T = T; this.period = period; this.marks = marks; this.build(); }

  get H() { return TOP + this.panels.length * (PH + GAP) - GAP + AXIS; }
  px(t) { return ML + (t / this.T) * (this.W - ML - MR); }

  build() {
    const { cv, panels } = this, fs = 1; if (!panels.length) return;
    const W = (this.W = Math.round(Math.min(WMAX, Math.max(300, cv.clientWidth || WMAX))));     // на узком экране рисуем 1:1, подписи остаются читаемыми
    const g = fitCanvas(cv, W, this.H);                       // размер и масштаб главного холста
    this.ctx = g;
    const mk = () => { const l = layer(cv); const c = l.getContext('2d'); c.setTransform(cv.width / W, 0, 0, cv.height / this.H, 0, 0); return [l, c]; };
    [this.base, this.cb] = mk(); [this.bold, this.cd] = mk();
    const c = this.cb; c.fillStyle = '#fff'; c.fillRect(0, 0, W, this.H);
    panels.forEach((p, i) => {
      const y0 = TOP + i * (PH + GAP), ymax = p.max * 1.18, ymin = p.signed ? -ymax : 0;
      p.y0 = y0; p.ymin = ymin; p.ymax = ymax; p.yy = (v) => y0 + PH - ((v - ymin) / (ymax - ymin)) * PH;
      // сетка
      c.lineWidth = 1; c.strokeStyle = '#e1ebf7'; c.beginPath();
      const tstep = nice(this.T / 8);
      for (let t = 0; t <= this.T + 1e-9; t += tstep) { const x = Math.round(this.px(t)) + 0.5; c.moveTo(x, y0); c.lineTo(x, y0 + PH); }
      const ticks = p.signed ? [-p.max, -p.max / 2, 0, p.max / 2, p.max] : [0, p.max / 2, p.max];
      for (const v of ticks) { const y = Math.round(p.yy(v)) + 0.5; c.moveTo(ML, y); c.lineTo(W - MR, y); }
      c.stroke();
      // характерные моменты (крайнее положение / равновесие): тонкие вертикали
      c.setLineDash([3, 3]); c.lineWidth = 1;
      for (const m of this.marks) { c.strokeStyle = m.kind === 'ext' ? 'rgba(240,138,0,.55)' : 'rgba(37,99,235,.45)'; const x = Math.round(this.px(m.t)) + 0.5; c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 + PH); c.stroke(); }
      c.setLineDash([]);
      // рамка, ось нуля, подписи
      c.strokeStyle = INK; c.lineWidth = 1.1; c.strokeRect(ML + 0.5, y0 + 0.5, W - ML - MR, PH);
      if (p.signed) { c.lineWidth = 1.1; c.beginPath(); c.moveTo(ML, Math.round(p.yy(0)) + 0.5); c.lineTo(W - MR, Math.round(p.yy(0)) + 0.5); c.stroke(); }
      for (const v of (p.signed ? [-p.max, 0, p.max] : ticks)) tex(c, fmt(v, v === 0 ? 0 : dec(p.max)), ML - 6, p.yy(v) + 4, { size: 11.5 * fs, align: 'right' });
      tex(c, p.label, 10, y0 + 15, { size: 15 * fs }); tex(c, p.unit, 10, y0 + 31, { size: 11 * fs, color: '#5b6b82' });
      // кривые: бледные целиком; насыщенные до курсора рисуем во втором слое
      for (const [layerCtx, alpha, w] of [[c, 0.32, 2], [this.cd, 1, 2.4]]) {
        layerCtx.save(); layerCtx.beginPath(); layerCtx.rect(ML, y0 - 1, W - ML - MR, PH + 2); layerCtx.clip();
        for (const cu of p.curves) {
          layerCtx.strokeStyle = cu.color; layerCtx.globalAlpha = alpha; layerCtx.lineWidth = w; layerCtx.lineJoin = 'round'; layerCtx.setLineDash(cu.dash || []);
          layerCtx.beginPath();
          const N = 480; for (let k = 0; k <= N; k++) { const t = (k / N) * this.T, x = this.px(t), y = p.yy(cu.f(t)); k ? layerCtx.lineTo(x, y) : layerCtx.moveTo(x, y); }
          layerCtx.stroke();
        }
        layerCtx.restore();
      }
      // легенда кривых, если их несколько
      if (p.curves.length > 1) p.curves.forEach((cu, k) => { c.fillStyle = cu.color; c.fillRect(ML + 8 + k * 56, y0 + 8, 14, 3); tex(c, cu.name, ML + 26 + k * 56, y0 + 13, { size: 11.5 * fs }); });
    });
    // ось времени: подписи в секундах и отметки периода T
    const ay = TOP + panels.length * (PH + GAP) - GAP;
    const tstep = nice(this.T / 8); c.strokeStyle = INK; c.lineWidth = 1;
    for (let t = 0; t <= this.T + 1e-9; t += tstep) { const x = this.px(t); c.beginPath(); c.moveTo(x, ay); c.lineTo(x, ay + 4); c.stroke(); tex(c, fmt(t, tstep < 1 ? 1 : 0), x, ay + 16, { size: 11.5 * fs, align: 'center' }); }
    for (let k = 1; k * this.period <= this.T + 1e-9; k++) { const x = this.px(k * this.period); c.strokeStyle = '#e8590c'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, ay - 5); c.lineTo(x, ay + 5); c.stroke(); tex(c, k === 1 ? 'T' : `${k}T`, x, ay + 29, { size: 13 * fs, color: '#c2410c', align: 'center' }); }
    tex(c, 't, с', ML - 14, ay + 16, { size: 12 * fs, align: 'right', color: '#5b6b82' });
  }

  draw(t) {
    const { ctx, cv } = this, W = this.W; if (!this.base) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.base, 0, 0);
    const kx = cv.width / W, x = this.px(t) * kx;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, x, cv.height); ctx.clip(); ctx.drawImage(this.bold, 0, 0); ctx.restore();
    ctx.restore();
    // курсор и точки на кривых
    ctx.save(); const px = this.px(t);
    ctx.strokeStyle = 'rgba(27,35,48,.75)'; ctx.lineWidth = 1.1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(px, TOP - 2); ctx.lineTo(px, this.H - AXIS + GAP - 2); ctx.stroke(); ctx.setLineDash([]);
    for (const p of this.panels) for (const cu of p.curves) { if (cu.dash) continue; ctx.fillStyle = cu.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(px, p.yy(cu.f(t)), 4.2, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
}
