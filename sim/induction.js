// Сцена «Электромагнитная индукция»: магнит пролетает через катушку. Поток магнита через катушку Φ(x) = Φ₀·exp(−(x/σ)²)·s (s = ±1 — полюс),
// ЭДС индукции ε = −N·dΦ/dt = N·(2x/σ²)·Φ·v, ток I = ε/R. Когда поток растёт, ЭДС одного знака, когда убывает — другого; когда магнит в центре, поток максимален, а ЭДС равна нулю.
// Стрелка гальванометра показывает ток. Правило Ленца: поле индукционного тока препятствует изменению потока.
import { fmt, tex, rr } from './tex.js?v=202611071254';

const el = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };
export const COLI = { phi: '#7048e8', e: '#e8590c', i: '#1f9d55' };
const SW = 520, SH = 400, CX = 260, CY = 168, SCM = 200, XMAX = 1.2, SIG = 0.28, PHI0 = 2e-3, RLOAD = 20, MW = 96, MH = 30, GX = 260, GY = 390, GR = 84;

export const induction = {
  id: 'induction',
  title: 'Электромагнитная индукция',
  lead: 'Магнит пролетает через катушку. Пока поток меняется, в катушке есть ЭДС и ток, а стрелка гальванометра отклоняется. Магнит неподвижен — тока нет, даже если он лежит внутри катушки. Быстрее магнит — больше ЭДС.',
  stage: { w: SW, h: SH, label: 'Магнит движется сквозь катушку, гальванометр показывает ток' },
  speed: 1,
  hold: 0.8,
  params: [
    { id: 'v', name: 'Скорость магнита', tex: 'v', unit: 'м/с', min: 0.2, max: 2, step: 0.1, def: 0.8, dec: 1 },
    { id: 'N', name: 'Число витков', tex: 'N', unit: '', min: 50, max: 400, step: 50, def: 200, dec: 0 },
    { id: 'pole', name: 'Какой полюс впереди', tex: '', unit: '', dec: 0, def: 1, options: [{ label: 'Северный', v: 1 }, { label: 'Южный', v: -1 }] },
  ],
  derive(p) {
    const T = (2 * XMAX) / p.v, em = p.N * PHI0 * ((Math.SQRT2 / SIG) * Math.exp(-0.5)) * p.v, tIn = (XMAX - SIG / Math.SQRT2) / p.v, tOut = (XMAX + SIG / Math.SQRT2) / p.v;
    return { T, em, tIn, tOut, tMid: XMAX / p.v, imax: (em / RLOAD) * 1000 };
  },
  window: (d) => d.T,
  pace: (d) => d.T / 6,
  clockDec: 2,
  axisMarks: (d) => [{ t: d.tIn, tex: 't_1', canvas: 't_1' }, { t: d.tMid, tex: 't_2', canvas: 't_2' }, { t: d.tOut, tex: 't_3', canvas: 't_3' }],
  at(p, d, t) {
    const x = -XMAX + p.v * t, g = Math.exp(-((x / SIG) ** 2)), phi = p.pole * PHI0 * g * 1000, dphi = p.pole * PHI0 * g * (-2 * x / (SIG * SIG)) * p.v, e = -p.N * dphi, i = (e / RLOAD) * 1000;
    return { t, x, phi, e, i, dphi };
  },
  marks: (p, d) => [{ t: d.tIn, kind: 'ext' }, { t: d.tMid, kind: 'blue' }, { t: d.tOut, kind: 'ext' }],
  panels: [
    { id: 'phi', tex: '\\Phi', label: 'Φ', unit: 'мВб', signed: true, on: true, max: () => PHI0 * 1000, curves: (S_) => [{ f: (t) => S_.at(t).phi, color: COLI.phi }] },
    { id: 'e', tex: '\\varepsilon', label: 'ε', unit: 'В', signed: true, on: true, max: (p, d) => d.em, curves: (S_) => [{ f: (t) => S_.at(t).e, color: COLI.e }] },
    { id: 'i', tex: 'I', label: 'I', unit: 'мА', signed: true, on: false, max: (p, d) => d.imax, curves: (S_) => [{ f: (t) => S_.at(t).i, color: COLI.i }] },
  ],
  toggles: [{ id: 'txt', name: 'Правило Ленца', color: '#1f9d55', on: true }],
  table: {
    cols: ['t', '\\Phi', '\\varepsilon', 'I'],
    units: ['с', 'мВб', 'В', 'мА'],
    rows: [
      { id: 'in', color: '#e8590c', name: 'Магнит входит', vals: (p, d) => { const s = induction.at(p, d, d.tIn); return [d.tIn, s.phi, s.e, s.i]; }, test: (s, p, d, t) => Math.abs(t - d.tIn) < 0.03 * d.T },
      { id: 'mid', color: '#2563eb', name: 'Магнит в центре', vals: (p, d) => { const s = induction.at(p, d, d.tMid); return [d.tMid, s.phi, 0, 0]; }, test: (s, p, d, t) => Math.abs(t - d.tMid) < 0.03 * d.T },
      { id: 'out', color: '#e8590c', name: 'Магнит выходит', vals: (p, d) => { const s = induction.at(p, d, d.tOut); return [d.tOut, s.phi, s.e, s.i]; }, test: (s, p, d, t) => Math.abs(t - d.tOut) < 0.03 * d.T },
    ],
    now: (s) => [s.t, s.phi, s.e, s.i],
    note: 'В центре катушки поток максимален, а ЭДС равна нулю: поток в этот момент не меняется. Максимумы ЭДС — там, где поток меняется быстрее всего. Знаки ЭДС при входе и выходе противоположны.',
  },
  readouts: (p, d) => [['Наибольшая ЭДС', 'ε_{max}', `${fmt(d.em, 2)} В`], ['Наибольший ток', 'I_{max} = ε/R', `${fmt(d.imax, 1)} мА`], ['Время пролёта', 't', `${fmt(d.T, 2)} с`], ['Сопротивление цепи', 'R', `${RLOAD} Ом`]],
  formulas: [
    { tag: 'Закон электромагнитной индукции', color: '#e8590c', tex: '\\varepsilon = -N\\dfrac{\\Delta\\Phi}{\\Delta t}' },
    { tag: 'Магнитный поток', color: '#7048e8', tex: '\\Phi = B S\\cos\\alpha' },
    { tag: 'Закон Ома', color: '#1f9d55', tex: 'I = \\dfrac{\\varepsilon}{R}' },
  ],

  mount(box, P0) {
    const bg = el('sm-sbg', 'canvas'), mag = el('sm-cart', 'canvas'), front = el('sm-sbg', 'canvas'), needle = el('sm-cart', 'canvas'), lenz = el('sm-lenz');
    front.style.zIndex = '4'; front.style.pointerEvents = 'none'; box.prepend(bg); box.append(mag, front, needle, lenz);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label); [bg, mag, front, needle].forEach((e) => e.setAttribute('aria-hidden', 'true'));
    let P = P0, d = induction.derive(P0), f = 1, k = 1, dprN = 1, lastTxt = '', lastAng = null;
    const setup = (cv) => {
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.2e6 / (cssW * ((cssW * SH) / SW)))));
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(((cssW * SH) / SW) * dpr);
      const g = cv.getContext('2d'); g.setTransform(cv.width / SW, 0, 0, cv.height / SH, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round'; return g;
    };
    const winding = (c, x, front_) => { c.beginPath(); c.ellipse(x, CY, 17, 52, 0, front_ ? 0 : Math.PI, front_ ? Math.PI : 2 * Math.PI); c.stroke(); };
    const paint = () => {
      const c = setup(bg); c.clearRect(0, 0, SW, SH);
      // шкала хода магнита
      c.strokeStyle = '#9aa5b8'; c.lineWidth = 1.2; c.setLineDash([4, 5]); c.beginPath(); c.moveTo(20, CY + 78); c.lineTo(SW - 20, CY + 78); c.stroke(); c.setLineDash([]);
      c.lineWidth = 3.4; c.strokeStyle = '#8a4a14'; for (let i = 0; i < 9; i++) winding(c, CX - 36 + i * 9, false);       // задние половины витков
      // провода к гальванометру
      c.strokeStyle = '#2a3140'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(CX - 36, CY + 52); c.lineTo(CX - 140, CY + 52); c.lineTo(CX - 140, GY - 8); c.lineTo(GX - GR, GY - 8); c.moveTo(CX + 36, CY + 52); c.lineTo(CX + 140, CY + 52); c.lineTo(CX + 140, GY - 8); c.lineTo(GX + GR, GY - 8); c.stroke();
      // гальванометр: шкала
      c.fillStyle = '#f4f6fa'; c.beginPath(); c.arc(GX, GY - 22, GR, Math.PI, 0); c.lineTo(GX + GR, GY + 6); c.lineTo(GX - GR, GY + 6); c.closePath(); c.fill(); c.strokeStyle = '#2a3140'; c.lineWidth = 2.4; c.stroke();
      const im = d.imax;
      for (let i = -4; i <= 4; i++) {
        const a = -Math.PI / 2 + (i / 4) * (Math.PI / 3.2), ca = Math.cos(a), sa = Math.sin(a);
        c.lineWidth = i % 2 ? 1.2 : 2; c.strokeStyle = '#2a3140'; c.beginPath(); c.moveTo(GX + GR * 0.86 * ca, GY - 22 + GR * 0.86 * sa); c.lineTo(GX + GR * 0.74 * ca, GY - 22 + GR * 0.74 * sa); c.stroke();
        if (i % 2 === 0) tex(c, fmt((i / 4) * im, im < 10 ? 1 : 0), GX + GR * 0.6 * ca, GY - 22 + GR * 0.6 * sa + 4, { size: 12, align: 'center', color: '#3b475c' });
      }
      tex(c, 'мА', GX, GY - 4, { size: 14, align: 'center', color: '#6b7a90' });
      c.beginPath(); c.arc(GX, GY - 22, 6, 0, 7); c.fillStyle = '#2a3140'; c.fill();
      tex(c, 'x, м', SW - 18, CY + 100, { size: 13, align: 'right', color: '#6b7a90' });
      for (const x of [-1, 0, 1]) { const px = CX + x * SCM; c.strokeStyle = '#2a3140'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(px, CY + 72); c.lineTo(px, CY + 84); c.stroke(); tex(c, fmt(x, 0), px, CY + 99, { size: 12, align: 'center', color: '#3b475c' }); }
      const g2 = setup(front); g2.clearRect(0, 0, SW, SH); g2.strokeStyle = '#a65a1c'; g2.lineWidth = 3.4; for (let i = 0; i < 9; i++) winding(g2, CX - 36 + i * 9, true);       // передние половины витков — поверх магнита
    };
    const api = {
      resize() {
        const cssW = box.clientWidth || SW; f = cssW / SW; dprN = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); const dpr = Math.max(1, Math.min(2, dprN, Math.sqrt(1.2e6 / (cssW * ((cssW * SH) / SW))))); k = (cssW * dpr) / SW;
        const sz = (cv, w, h, ax, ay) => { cv.style.width = `${(w / SW) * 100}%`; cv.style.height = `${(h / SH) * 100}%`; cv.style.left = `${(-ax / SW) * 100}%`; cv.style.top = `${(-ay / SH) * 100}%`; cv.style.transformOrigin = `${ax * f}px ${ay * f}px`; cv.width = Math.ceil(w * k); cv.height = Math.ceil(h * k); const g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); return g; };
        { const g = sz(mag, MW, MH, MW / 2, MH / 2); mrColor(g); }
        { const g = sz(needle, 4, GR * 0.8, 2, GR * 0.8); g.fillStyle = '#e03131'; g.beginPath(); g.moveTo(2, 0); g.lineTo(4, GR * 0.8); g.lineTo(0, GR * 0.8); g.closePath(); g.fill(); }
        paint(); lastAng = null;
      },
      params(p) { P = p; d = induction.derive(p); const g = mag.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); mrColor(g); paint(); lastAng = null; },
      update(s, dd, o) {
        const sn = (v) => Math.round(v * dprN) / dprN;
        mag.style.transform = `translate3d(${sn((CX + s.x * SCM) * f)}px,${sn(CY * f)}px,0)`;
        const ang = Math.max(-1, Math.min(1, s.i / d.imax)) * 52; if (ang !== lastAng) { lastAng = ang; needle.style.transform = `translate3d(${sn(GX * f)}px,${sn((GY - 22) * f)}px,0) rotate(${ang}deg)`; }
        const txt = !o.txt ? '' : Math.abs(s.e) < 0.03 * d.em ? 'Поток почти не меняется: ЭДС нет' : s.phi * s.dphi > 0 ? 'Модуль потока растёт: поле индукционного тока направлено против поля магнита' : 'Модуль потока убывает: поле индукционного тока направлено так же, как поле магнита';
        if (txt !== lastTxt) { lastTxt = txt; lenz.textContent = txt; lenz.style.display = txt ? '' : 'none'; }
      },
    };
    function mrColor(g) {                                                                       // магнит: «+» полюс слева или справа в зависимости от того, какой полюс впереди
      g.clearRect(0, 0, MW, MH); const lead = P.pole > 0;                                       // впереди (справа) северный — красный
      const left = lead ? '#2563eb' : '#e03131', right = lead ? '#e03131' : '#2563eb', lt = lead ? 'S' : 'N', rt = lead ? 'N' : 'S';
      rr(g, 0, 0, MW / 2, MH, 5); g.fillStyle = left; g.fill(); rr(g, MW / 2, 0, MW / 2, MH, 5); g.fillStyle = right; g.fill(); g.strokeStyle = '#1b2330'; g.lineWidth = 1.8; rr(g, 0, 0, MW, MH, 5); g.stroke();
      tex(g, lt, MW / 4, MH / 2 + 7, { size: 20, align: 'center', color: '#fff' }); tex(g, rt, (3 * MW) / 4, MH / 2 + 7, { size: 20, align: 'center', color: '#fff' });
    }
    return api;
  },
};
