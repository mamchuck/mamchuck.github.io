// Сцена «Пружинный маятник»: груз на гладкой горизонтальной поверхности, идеальная пружина (без трения).
// Решение точное (аналитическое), поэтому время можно перематывать и ничего не накапливается: x = A·cos(ωt + φ₀).
import { INK, SERIF, fmt, tex, arrow, hatch, coil, cube } from './tex.js?v=202610311416';

const PI = Math.PI;
export const COL = { x: '#1b2330', v: '#1f9d55', a: '#2563eb', F: '#c92a2a', Ek: '#e8590c', Ep: '#7048e8', E: '#64748b' };

// Геометрия сцены (логические единицы 720×250)
const SW = 720, SH = 250, WALL = 44, X0 = 372, PXM = 1100, S = 62, FLOOR = 178, SPY = FLOOR - S / 2, AXY = 222;

let FS = 1;                                              // на узких экранах рисунок уменьшается целиком, поэтому надписи увеличиваем

export const spring = {
  fit(cssW) { FS = Math.max(1, Math.min(1.8, 660 / cssW)); return FS; },
  id: 'spring',
  title: 'Пружинный маятник',
  lead: 'Оттяни груз и отпусти. Графики идут друг под другом с общей осью времени: в крайнем положении видно, что равно нулю, а что максимально.',
  stage: { w: SW, h: SH, label: 'Груз на пружине, колеблется вдоль горизонтальной оси' },
  params: [
    { id: 'm', name: 'Масса груза', sym: 'm', unit: 'кг', min: 0.1, max: 2, step: 0.1, def: 0.5, dec: 1 },
    { id: 'k', name: 'Жёсткость пружины', sym: 'k', unit: 'Н/м', min: 5, max: 80, step: 1, def: 20, dec: 0 },
    { id: 'A', name: 'Амплитуда', sym: 'A', unit: 'м', min: 0.02, max: 0.15, step: 0.01, def: 0.1, dec: 2 },
    { id: 'phi', name: 'Начальная фаза', sym: 'φ_0', unit: 'π', min: 0, max: 2, step: 0.05, def: 0, dec: 2 },
  ],
  derive(p) { const w = Math.sqrt(p.k / p.m), T = 2 * PI / w; return { w, T, nu: 1 / T, vmax: p.A * w, amax: p.A * w * w, E: 0.5 * p.k * p.A * p.A }; },
  window: (d) => 4 * d.T,
  at(p, d, t) {
    const ph = d.w * t + p.phi * PI, x = p.A * Math.cos(ph), v = -p.A * d.w * Math.sin(ph), a = -d.w * d.w * x;
    return { x, v, a, Ek: 0.5 * p.m * v * v, Ep: 0.5 * p.k * x * x };
  },
  marks(p, d, T4) {                                       // моменты крайних положений и прохождения равновесия
    const out = [];
    for (let n = 0; n < 12; n++) {
      const te = (n * PI - p.phi * PI) / d.w, tq = ((n + 0.5) * PI - p.phi * PI) / d.w;
      if (te >= 0 && te <= T4 + 1e-9) out.push({ t: te, kind: 'ext' });
      if (tq >= 0 && tq <= T4 + 1e-9) out.push({ t: tq, kind: 'eq' });
    }
    return out;
  },
  panels: [
    { id: 'x', name: 'x', label: 'x', unit: 'м', signed: true, on: true, max: (p) => p.A, curves: (S_) => [{ f: (t) => S_.at(t).x, color: COL.x }] },
    { id: 'v', name: 'v', label: 'v_x', unit: 'м/с', signed: true, on: true, max: (p, d) => d.vmax, curves: (S_) => [{ f: (t) => S_.at(t).v, color: COL.v }] },
    { id: 'a', name: 'a', label: 'a_x', unit: 'м/с²', signed: true, on: true, max: (p, d) => d.amax, curves: (S_) => [{ f: (t) => S_.at(t).a, color: COL.a }] },
    { id: 'E', name: 'E', label: 'E', unit: 'Дж', signed: false, on: false, max: (p, d) => d.E,
      curves: (S_) => [{ f: (t) => S_.at(t).Ek, color: COL.Ek, name: 'E_к' }, { f: (t) => S_.at(t).Ep, color: COL.Ep, name: 'E_п' }, { f: () => S_.d.E, color: COL.E, dash: [5, 4], name: 'E' }] },
  ],
  toggles: [{ id: 'v', name: 'Скорость', color: COL.v }, { id: 'a', name: 'Ускорение', color: COL.a }, { id: 'F', name: 'Силы', color: COL.F }],
  table: {                                                  // строки «Положения»: что чему равно в характерных точках
    cols: ['|x|', '|v|', '|a|', 'E_к', 'E_п'],
    rows: [
      { id: 'eq', name: 'Равновесие', vals: (p, d) => [0, d.vmax, 0, d.E, 0], test: (s, p) => Math.abs(s.x) < 0.04 * p.A },
      { id: 'ext', name: 'Крайнее', vals: (p, d) => [p.A, 0, d.amax, 0, d.E], test: (s, p) => Math.abs(s.x) > 0.96 * p.A },
    ],
    units: ['м', 'м/с', 'м/с²', 'Дж', 'Дж'],
    now: (s) => [Math.abs(s.x), Math.abs(s.v), Math.abs(s.a), s.Ek, s.Ep],
  },
  readouts: (p, d) => [['Период', 'T', `${fmt(d.T, 2)} с`], ['Частота', 'ν', `${fmt(d.nu, 2)} Гц`], ['Циклическая частота', 'ω', `${fmt(d.w, 2)} рад/с`],
    ['Макс. скорость', 'v_{max}', `${fmt(d.vmax, 2)} м/с`], ['Макс. ускорение', 'a_{max}', `${fmt(d.amax, 1)} м/с²`], ['Полная энергия', 'E', `${fmt(d.E * 1000, 0)} мДж`]],
  formulas: [
    { tag: 'Период', html: '<i>T</i> = 2π<span class="sq"><i>m</i> / <i>k</i></span>' },
    { tag: 'Закон колебаний', html: '<i>x</i> = <i>A</i> cos(<i>ωt</i> + <i>φ</i><sub>0</sub>),  <i>ω</i> = <span class="sq"><i>k</i> / <i>m</i></span>' },
    { tag: 'Энергия', html: '<i>E</i> = <i>kA</i><sup>2</sup> / 2 = <i>E</i><sub>к</sub> + <i>E</i><sub>п</sub>' },
  ],

  // ---------- Неизменная часть рисунка: стена, пол, ось x ----------
  drawStatic(c, p) {
    c.fillStyle = '#fff'; c.fillRect(0, 0, SW, SH);
    // стена слева и пол
    c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(WALL, 34); c.lineTo(WALL, FLOOR + 10); c.stroke();
    hatch(c, WALL - 14, 34, 14, FLOOR + 10 - 34, 6.5);
    c.lineWidth = 1.8; c.beginPath(); c.moveTo(WALL, FLOOR); c.lineTo(SW - 24, FLOOR); c.stroke();
    hatch(c, WALL, FLOOR, SW - 24 - WALL, 9, 6.5);
    // ось x: стрелка, деления −A, 0, A
    const xa = X0 - p.A * PXM, xb = X0 + p.A * PXM;
    arrow(c, 120, AXY, SW - 28, AXY, { lw: 1.3, head: 8 });
    c.strokeStyle = INK; c.lineWidth = 1.3;
    for (const [x, lab] of [[xa, '−A'], [X0, '0'], [xb, 'A']]) { c.beginPath(); c.moveTo(x, AXY - 4); c.lineTo(x, AXY + 4); c.stroke(); tex(c, lab, x, AXY + 19, { size: 15 * FS, align: 'center' }); }
    tex(c, 'x', SW - 26, AXY + 19, { size: 15 * FS });
    // пунктир равновесия
    c.setLineDash([3, 4]); c.lineWidth = 1; c.strokeStyle = '#8a99b0'; c.beginPath(); c.moveTo(X0, FLOOR + 12); c.lineTo(X0, AXY - 6); c.stroke(); c.setLineDash([]);
  },

  // ---------- Меняющаяся часть: пружина, груз, векторы, время ----------
  drawDynamic(c, p, d, s, t, o) {
    const xc = X0 + s.x * PXM, left = xc - S / 2;
    coil(c, WALL, left, SPY, { turns: 12, r: 17, lead: 12 });
    cube(c, left, FLOOR - S, S, { dx: 20, dy: 15 });
    tex(c, 'm', xc, FLOOR - S / 2 + 8, { size: 24 * FS, align: 'center' });
    // положение на оси
    c.setLineDash([3, 4]); c.lineWidth = 1; c.strokeStyle = '#8a99b0'; c.beginPath(); c.moveTo(xc, FLOOR + 12); c.lineTo(xc, AXY - 6); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#c92a2a'; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(xc, AXY, 4.2, 0, 7); c.fill(); c.stroke();
    // векторы: длина пропорциональна величине (максимум = 84 единицы)
    const top = FLOOR - S - 15, L = 84;
    if (o.v) { const l = (s.v / d.vmax) * L; arrow(c, xc, top - 22, xc + l, top - 22, { color: COL.v, lw: 2.1, head: 9 }); tex(c, '\\v{v}', xc + (l >= 0 ? l + 7 : l - 18), top - 18, { size: 17 * FS, color: COL.v }); }
    if (o.a) { const l = (s.a / d.amax) * L; arrow(c, xc, top - 46, xc + l, top - 46, { color: COL.a, lw: 2.1, head: 9 }); tex(c, '\\v{a}', xc + (l >= 0 ? l + 7 : l - 18), top - 42, { size: 17 * FS, color: COL.a }); }
    if (o.F) { const l = (s.a / d.amax) * L; arrow(c, xc, SPY + 24, xc + l, SPY + 24, { color: COL.F, lw: 2.1, head: 9 }); tex(c, '\\v{F}_{упр}', xc + (l >= 0 ? l + 7 : l - 34), SPY + 28, { size: 16 * FS, color: COL.F }); }
    // время
    c.font = `500 ${22 * FS}px ${SERIF}`; c.fillStyle = INK; c.textAlign = 'right'; c.fillText(`${fmt(t, 2)} с`, SW - 20, 34); c.textAlign = 'left';
  },
};
