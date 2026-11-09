// Сцена «Механические волны»: бегущая волна в верёвке (поперечная) или в пружине (продольная). Смещение точки на расстоянии x от начала:
// ξ(x, t) = A·sin(2π(νt − x/λ)). Волна переносит энергию, а сами точки только колеблются около своих мест. Скорость волны v = λν.
// Две отмеченные точки A и B на расстоянии d: график их колебаний показывает запаздывание Δt = d/v и разность фаз Δφ = 2πd/λ.
import { fmt, tex } from './tex.js?v=202611091414';

const el = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };
export const COLW = { A: '#e03131', B: '#2563eb', rope: '#1b2330' };
const SW = 520, SH = 400, XL = 40, SCX = 55, XM = 8, Y0 = 188, SCY = 64, BAND = 150, XA = 1;
const AL = (p) => Math.min(p.A, 0.12 * p.lam);                                // амплитуда продольной волны ограничена, чтобы частицы не «обгоняли» друг друга

export const waves = {
  id: 'waves',
  title: 'Механические волны',
  lead: 'Волна бежит по верёвке, а каждая точка верёвки только колеблется вверх-вниз. Скорость волны v = λν. Точки A и B колеблются одинаково, но B запаздывает: на графике видно, насколько.',
  stage: { w: SW, h: SH, label: 'Бегущая волна и две отмеченные точки A и B' },
  speed: 0.5,
  hold: 0.5,
  params: [
    { id: 'type', name: 'Волна', tex: '', unit: '', dec: 0, def: 1, options: [{ label: 'Поперечная', v: 1 }, { label: 'Продольная', v: 2 }] },
    { id: 'lam', name: 'Длина волны', tex: '\\lambda', unit: 'м', min: 0.5, max: 4, step: 0.1, def: 2, dec: 1 },
    { id: 'nu', name: 'Частота', tex: '\\nu', unit: 'Гц', min: 0.25, max: 2, step: 0.05, def: 0.5, dec: 2 },
    { id: 'A', name: 'Амплитуда', tex: 'A', unit: 'м', min: 0.1, max: 0.9, step: 0.05, def: 0.4, dec: 2 },
    { id: 'd', name: 'Расстояние между A и B', tex: 'd', unit: 'м', min: 0, max: 4, step: 0.1, def: 1, dec: 1 },
  ],
  derive(p) {
    const T = 1 / p.nu, v = p.lam * p.nu, dt = p.d / v, dphi = (2 * Math.PI * p.d) / p.lam, amp = p.type === 2 ? AL(p) : p.A;
    const crest = (x) => ((x / p.lam + 0.25) % 1 + 1) % 1 / p.nu;                 // первый момент, когда в точке x гребень
    return { T, v, dt, dphi, amp, win: Math.min(12, Math.max(4, 3 * T)), tA: crest(XA), tB: crest(XA + p.d), XB: XA + p.d };
  },
  window: (d) => d.win,
  axisMarks: (d) => [1, 2, 3].filter((n) => n * d.T <= d.win + 1e-9).map((n) => ({ t: n * d.T, tex: n === 1 ? 'T' : `${n}T`, canvas: n === 1 ? 'T' : `${n}T` })),
  at(p, d, t) {
    const ph = (x) => 2 * Math.PI * (p.nu * t - x / p.lam), a = d.amp;
    return { t, yA: a * Math.sin(ph(XA)), yB: a * Math.sin(ph(d.XB)) };
  },
  marks: (p, d) => [{ t: d.tA, kind: 'ext' }, { t: d.tB, kind: 'blue' }].filter((m) => m.t <= d.win),
  panels: [
    { id: 'y', tex: '\\xi', label: 'ξ', unit: 'м', signed: true, on: true, max: (p, d) => d.amp, curves: (S_) => [{ f: (t) => S_.at(t).yA, color: COLW.A, name: 'A' }, { f: (t) => S_.at(t).yB, color: COLW.B, name: 'B' }] },
  ],
  toggles: [{ id: 'g', name: 'Точки A и B', color: COLW.A, on: true }],
  table: {
    cols: ['t', '\\xi_A', '\\xi_B'],
    units: ['с', 'м', 'м'],
    rows: [
      { id: 'a', color: COLW.A, name: 'Гребень в точке A', vals: (p, d) => [d.tA, d.amp, d.amp * Math.sin(2 * Math.PI * (p.nu * d.tA - d.XB / p.lam))], test: (s, p, d, t) => Math.abs(t - d.tA) < 0.03 * d.win },
      { id: 'b', color: COLW.B, name: 'Гребень в точке B', vals: (p, d) => [d.tB, d.amp * Math.sin(2 * Math.PI * (p.nu * d.tB - XA / p.lam)), d.amp], test: (s, p, d, t) => Math.abs(t - d.tB) < 0.03 * d.win },
    ],
    now: (s) => [s.t, s.yA, s.yB],
    note: 'Разница между временами гребней в B и A равна запаздыванию Δt = d/v, если оно меньше периода (иначе до B дошёл следующий гребень).',
  },
  readouts: (p, d) => [['Скорость волны', 'v = \\lambda\\nu', `${fmt(d.v, 2)} м/с`], ['Период', 'T = 1/\\nu', `${fmt(d.T, 2)} с`], ['Запаздывание B', '\\Delta t = d/v', `${fmt(d.dt, 2)} с`],
    ['Разность фаз', '\\Delta\\varphi = 2\\pi d/\\lambda', `${fmt(d.dphi, 2)} рад`], ['Путь точки за период', '4A', `${fmt(4 * d.amp, 2)} м`]],
  formulas: [
    { tag: 'Скорость волны', color: '#e8590c', tex: 'v = \\lambda\\nu = \\dfrac{\\lambda}{T}' },
    { tag: 'Смещение точки', color: '#2563eb', tex: '\\xi(x,t) = A\\sin\\left[2\\pi\\left(\\nu t - \\dfrac{x}{\\lambda}\\right)\\right]' },
    { tag: 'Запаздывание и фаза', color: '#7048e8', tex: '\\Delta t = \\dfrac{d}{v},\\qquad \\Delta\\varphi = \\dfrac{2\\pi d}{\\lambda}' },
  ],

  mount(box, P0) {
    const bg = el('sm-sbg', 'canvas'), band = el('sm-wband', 'canvas'); box.prepend(bg); box.append(band);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label); bg.setAttribute('aria-hidden', 'true'); band.setAttribute('aria-hidden', 'true');
    let P = P0, d = waves.derive(P0), showAB = true, bc = null, bk = 1;
    const X = (x) => XL + x * SCX;
    const setup = (cv, w, h, cap) => {
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(cap / (cssW * ((cssW * h) / w)))));
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(((cssW * h) / w) * dpr); const g = cv.getContext('2d'); g.setTransform(cv.width / w, 0, 0, cv.height / h, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round'; return g;
    };
    const paintBg = () => {
      const c = setup(bg, SW, SH, 1.2e6); c.clearRect(0, 0, SW, SH);
      c.strokeStyle = '#9aa5b8'; c.lineWidth = 1.2; c.setLineDash([4, 5]); c.beginPath(); c.moveTo(XL - 8, Y0); c.lineTo(X(XM) + 8, Y0); c.stroke();
      const a = d.amp * SCY; c.strokeStyle = 'rgba(232,89,12,.5)'; c.beginPath(); c.moveTo(XL - 8, Y0 - a); c.lineTo(X(XM) + 8, Y0 - a); c.moveTo(XL - 8, Y0 + a); c.lineTo(X(XM) + 8, Y0 + a); c.stroke(); c.setLineDash([]);
      tex(c, 'A', XL - 14, Y0 - a + 5, { size: 14, align: 'right', color: '#c2410c' });
      // шкала длины волны внизу — сравнивай с расстоянием между гребнями
      const yb = SH - 44, w = P.lam * SCX; c.strokeStyle = '#e8590c'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(XL, yb); c.lineTo(XL + w, yb); c.moveTo(XL, yb - 6); c.lineTo(XL, yb + 6); c.moveTo(XL + w, yb - 6); c.lineTo(XL + w, yb + 6); c.stroke();
      tex(c, `λ = ${fmt(P.lam, 1)} м`, XL + w / 2, yb - 12, { size: 16, align: 'center', color: '#c2410c' });
      // ось x
      c.strokeStyle = '#2a3140'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(XL, SH - 18); c.lineTo(X(XM), SH - 18); for (let x = 0; x <= XM; x++) { c.moveTo(X(x), SH - 22); c.lineTo(X(x), SH - 14); } c.stroke();
      for (let x = 0; x <= XM; x += 2) tex(c, `${x}`, X(x), SH - 1, { size: 12, align: 'center', color: '#3b475c' });
      tex(c, 'x, м', X(XM) + 6, SH - 15, { size: 13 });
      if (showAB) for (const [x, col, n] of [[XA, COLW.A, 'A'], [d.XB, COLW.B, 'B']]) { c.setLineDash([3, 4]); c.strokeStyle = col; c.lineWidth = 1.3; c.beginPath(); c.moveTo(X(x), Y0 - 88); c.lineTo(X(x), Y0 + 88); c.stroke(); c.setLineDash([]); tex(c, n, X(x), Y0 - 96, { size: 18, align: 'center', color: col }); }
    };
    const layout = () => { band.style.width = '100%'; band.style.height = `${(BAND / SH) * 100}%`; band.style.top = `${((Y0 - BAND / 2) / SH) * 100}%`; bc = setup(band, SW, BAND, 1e6); bk = band.width / SW; };
    const draw = (t) => {
      const c = bc, p = P, w = 2 * Math.PI, ph = (x) => w * (p.nu * t - x / p.lam), cy = BAND / 2; c.clearRect(0, 0, SW, BAND);
      if (p.type === 1) {
        c.strokeStyle = COLW.rope; c.lineWidth = 3.6; c.beginPath();
        for (let i = 0; i <= 160; i++) { const x = (i / 160) * XM, y = cy - d.amp * SCY * Math.sin(ph(x)); i ? c.lineTo(X(x), y) : c.moveTo(X(x), y); }
        c.stroke();
        if (showAB) for (const [x, col] of [[XA, COLW.A], [d.XB, COLW.B]]) { c.beginPath(); c.arc(X(x), cy - d.amp * SCY * Math.sin(ph(x)), 7.5, 0, 7); c.fillStyle = col; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); }
      } else {
        const N = Math.round(XM / 0.1), a = d.amp * SCX; c.lineWidth = 3; c.strokeStyle = 'rgba(27,35,48,.78)'; c.beginPath();
        for (let i = 0; i <= N; i++) { const x0 = i * 0.1, xx = X(x0) + a * Math.sin(ph(x0)); c.moveTo(xx, cy - 42); c.lineTo(xx, cy + 42); }
        c.stroke();
        if (showAB) for (const [x, col] of [[XA, COLW.A], [d.XB, COLW.B]]) { const xx = X(x) + a * Math.sin(ph(x)); c.strokeStyle = col; c.lineWidth = 6; c.beginPath(); c.moveTo(xx, cy - 54); c.lineTo(xx, cy + 54); c.stroke(); }
      }
    };
    const api = {
      resize() { layout(); paintBg(); },
      params(p) { P = p; d = waves.derive(p); layout(); paintBg(); },
      update(s, dd, o, t) { if (!!o.g !== showAB) { showAB = !!o.g; paintBg(); } d = dd; draw(t); },
    };
    return api;
  },
};
