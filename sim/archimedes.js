// Сцена «Плавание и сила Архимеда»: тело (куб) отпускают над жидкостью. Оно входит в жидкость, и сила Архимеда растёт вместе с погружением,
// пока не сравняется с силой тяжести (тело плавает) или не станет предельной, когда тело погружено полностью (тонет или висит).
// Модель: m·z'' = m·g − ρж·g·V_погр(z) − b·z' (вязкое сопротивление b подобрано так, чтобы колебания затухали за пару секунд); решается числено,
// уровень жидкости поднимается на V_погр / S_бака (вытесненный объём). g = 10 м/с².
import { fmt, tex, arrow, sprite, rr } from './tex.js?v=202611010210';

const el = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };
export const COLA = { Ft: '#d6336c', FA: '#2563eb', y: '#0b7285', v: '#1f9d55' };
const G = 10, SW = 520, SH = 400, PXM = 700, TX0 = 130, TX1 = 390, TB = 340, HF = 0.21, TW = 6, DT = 1 / 500, ATANK = 0.37 * 0.2, VS = 190;
const LIQ = { 800: ['Керосин', '#f1c15a'], 1000: ['Вода', '#4aa8ff'], 1260: ['Глицерин', '#9ad7a6'], 13600: ['Ртуть', '#98a3b5'] };
const zy = (z) => TB - (HF - z) * PXM;                                   // координата y нижней грани тела по глубине погружения z (м от исходного уровня)

export const archimedes = {
  id: 'archimedes',
  title: 'Плавание и сила Архимеда',
  lead: 'Отпусти тело над жидкостью. Пока оно погружается, сила Архимеда растёт. Если её хватает, чтобы уравновесить силу тяжести, тело плавает, а если нет, тонет. Меняй плотность тела, объём и жидкость (в ртути плавает даже сталь).',
  stage: { w: SW, h: SH, label: 'Тело погружается в жидкость в баке' },
  speed: 0.5,
  hold: 1.2,
  params: [
    { id: 'rho', name: 'Плотность тела', tex: '\\rho_\\text{т}', unit: 'кг/м³', min: 100, max: 8000, step: 50, def: 600, dec: 0 },
    { id: 'V', name: 'Объём тела', tex: 'V', unit: 'см³', min: 100, max: 1000, step: 50, def: 500, dec: 0 },
    { id: 'rl', name: 'Жидкость', tex: '\\rho_\\text{ж}', unit: 'кг/м³', dec: 0, def: 1000, options: [{ label: 'Керосин', v: 800 }, { label: 'Вода', v: 1000 }, { label: 'Глицерин', v: 1260 }, { label: 'Ртуть', v: 13600 }] },
  ],
  derive(p) {
    const V = p.V * 1e-6, m = p.rho * V, a = Math.cbrt(V), A = a * a, Ft = m * G, FAfull = p.rl * G * V, kap = 1 / (1 - A / ATANK);
    const k = p.rl * G * A, b = 2 * 0.45 * Math.sqrt(k * m), sub = (z) => Math.min(a, Math.max(0, z * kap));
    // численное решение (RK4) — тело отпускают за 2 см над поверхностью
    const n = Math.ceil(TW / DT) + 2, Z = new Float64Array(n), W = new Float64Array(n); let z = -0.02, v = 0; Z[0] = z;
    const acc = (zz, vv) => (m * G - p.rl * G * A * sub(zz) - b * vv) / m;
    for (let i = 1; i < n; i++) {
      const h = DT, k1z = v, k1v = acc(z, v), k2z = v + (h / 2) * k1v, k2v = acc(z + (h / 2) * k1z, v + (h / 2) * k1v);
      const k3z = v + (h / 2) * k2v, k3v = acc(z + (h / 2) * k2z, v + (h / 2) * k2v), k4z = v + h * k3v, k4v = acc(z + h * k3z, v + h * k3v);
      z += (h / 6) * (k1z + 2 * k2z + 2 * k3z + k4z); v += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
      if (z > HF - a + 0) { z = HF - 0; }                                   // дно: нижняя грань на глубине HF
      if (z >= HF) { z = HF; if (v > 0) v = 0; }
      Z[i] = z; W[i] = v;
    }
    const regime = p.rho < p.rl - 1e-9 ? 'float' : Math.abs(p.rho - p.rl) < 1e-9 ? 'neutral' : 'sink';
    return { V, m, a, A, Ft, FAfull, kap, regime, sub, Z, W, fEq: Math.min(1, p.rho / p.rl), zEq: regime === 'float' ? (p.rho / p.rl) * a / kap : null };
  },
  window: () => TW,
  axisMarks: () => [],
  at(p, d, t) {
    const x = Math.min(Math.max(t, 0), TW) / DT, i = Math.min(Math.floor(x), d.Z.length - 2), fr = x - i;
    const z = d.Z[i] + (d.Z[i + 1] - d.Z[i]) * fr, v = d.W[i] + (d.W[i + 1] - d.W[i]) * fr, s = d.sub(z), Vs = d.A * s, FA = p.rl * G * Vs;
    return { z, v, s, Vs, FA, Ft: d.Ft, yb: (HF - z) * 100, net: d.Ft - FA, rise: Vs / ATANK };
  },
  marks: () => [],
  panels: [
    { id: 'y', tex: 'y', label: 'y', unit: 'см', signed: false, on: true, max: () => HF * 100 + 2, curves: (S_) => [{ f: (t) => S_.at(t).yb, color: COLA.y }] },
    { id: 'F', tex: 'F', label: 'F', unit: 'Н', signed: false, on: true, max: (p, d) => Math.max(d.Ft, d.FAfull, 0.01), curves: (S_) => [{ f: (t) => S_.at(t).Ft, color: COLA.Ft, name: 'F_т' }, { f: (t) => S_.at(t).FA, color: COLA.FA, name: 'F_А' }] },
    { id: 'v', tex: 'v', label: 'v', unit: 'м/с', signed: true, on: false, max: (p, d) => { let m = 0.1; for (let q = 0; q < d.W.length; q += 25) m = Math.max(m, Math.abs(d.W[q])); return m; }, curves: (S_) => [{ f: (t) => S_.at(t).v, color: COLA.v }] },
  ],
  toggles: [{ id: 'f', name: 'Силы', color: '#d6336c', on: true }],
  table: {
    cols: ['F_\\text{т}', 'F_\\text{А}', 'V_\\text{погр}', 's'],
    units: ['Н', 'Н', 'см³', 'см'],
    rows: [
      { id: 'start', color: '#1f9d55', name: 'В воздухе', vals: (p, d) => [d.Ft, 0, 0, 0], test: (s, p, d, t) => s.s <= 0 && t < 0.4 },
      { id: 'end', color: '#2563eb', name: 'Итог', vals: (p, d) => { const f = d.regime === 'float' ? d.fEq : 1; return [d.Ft, d.regime === 'float' ? d.Ft : d.FAfull, f * d.V * 1e6, f * d.a * 100]; }, test: (s, p, d, t) => t > 0.9 * TW },
    ],
    now: (s) => [s.Ft, s.FA, s.Vs * 1e6, s.s * 100],
    note: 'Строка подсвечивается, когда тело в воздухе (сила Архимеда равна нулю) и когда оно успокоилось. У плавающего тела в конце F_А = F_т, у утонувшего F_А меньше F_т (у зависшего в толще — равно).',
  },
  readouts: (p, d) => [['Масса тела', 'm', `${fmt(d.m * 1000, 0)} г`], ['Сила тяжести', 'F_\\text{т}', `${fmt(d.Ft, 2)} Н`], ['Макс. сила Архимеда', 'F_\\text{А max}', `${fmt(d.FAfull, 2)} Н`],
    ['Итог', '', d.regime === 'float' ? 'плавает' : d.regime === 'neutral' ? 'взвешено в толще' : 'тонет'], ['Погружено при плавании', '\\dfrac{V_\\text{погр}}{V}', d.regime === 'float' ? `${fmt(d.fEq * 100, 0)} %` : '100 %'],
    ['Доля плотностей', '\\dfrac{\\rho_\\text{т}}{\\rho_\\text{ж}}', fmt(p.rho / p.rl, 2)]],
  formulas: [
    { tag: 'Сила Архимеда', color: '#2563eb', tex: 'F_\\text{А} = \\rho_\\text{ж}\\, g\\, V_\\text{погр}' },
    { tag: 'Сила тяжести', color: '#d6336c', tex: 'F_\\text{т} = mg = \\rho_\\text{т}\\, g\\, V' },
    { tag: 'Плавание', color: '#1b2330', tex: '\\dfrac{V_\\text{погр}}{V} = \\dfrac{\\rho_\\text{т}}{\\rho_\\text{ж}}\\quad(\\rho_\\text{т} \\le \\rho_\\text{ж})' },
  ],

  mount(box, P0) {
    const bg = el('sm-sbg', 'canvas'), body = el('sm-abody', 'canvas'), water = el('sm-water'), vec = el('sm-avec', 'canvas');
    box.prepend(bg, body, water, vec);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label);
    [bg, body, vec].forEach((e) => e.setAttribute('aria-hidden', 'true'));
    let P = P0, d = archimedes.derive(P0), f = 1, k = 1, dprN = 1, vecC = null, labels = null, vecOn = false, lastKey = '', sidePx = 56;
    const full = (cv) => {
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.2e6 / (cssW * ((cssW * SH) / SW)))));
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(((cssW * SH) / SW) * dpr);
      const g = cv.getContext('2d'); g.setTransform(cv.width / SW, 0, 0, cv.height / SH, 0, 0); return g;
    };
    const paintBg = (c) => {
      c.clearRect(0, 0, SW, SH);
      // стол и бак (стекло): задняя стенка слегка светлее, толстые стенки
      c.fillStyle = 'rgba(160,172,192,.3)'; c.fillRect(70, TB + 10, 380, 12);
      c.strokeStyle = '#3b4658'; c.lineWidth = 2; c.beginPath(); c.moveTo(70, TB + 10); c.lineTo(450, TB + 10); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(TX0, 120, TX1 - TX0, TB - 120);
      c.strokeStyle = '#51607a'; c.lineWidth = 3; c.lineJoin = 'round'; c.beginPath(); c.moveTo(TX0, 120); c.lineTo(TX0, TB + 10); c.lineTo(TX1, TB + 10); c.lineTo(TX1, 120); c.stroke();
      // линейка справа от бака: сантиметры от дна
      c.strokeStyle = '#2a3140'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(TX1 + 16, TB); c.lineTo(TX1 + 16, TB - 24 * 7); c.stroke();
      for (let cm = 0; cm <= 24; cm++) { const y = TB - cm * 7, big = cm % 5 === 0; c.beginPath(); c.moveTo(TX1 + 16, y); c.lineTo(TX1 + (big ? 28 : 23), y); c.stroke(); if (big) tex(c, `${cm}`, TX1 + 32, y + 4, { size: 12, color: '#3b475c' }); }
      tex(c, 'см', TX1 + 34, TB - 24 * 7 - 8, { size: 12, color: '#6b7a90' });
      tex(c, LIQ[P.rl]?.[0] || '', (TX0 + TX1) / 2, TB + 40, { size: 14, align: 'center', color: '#3b475c' });
    };
    const paintBody = () => {
      const a = d.a * 100 * 7;                                     // сторона куба в пикселях (7 px на сантиметр)
      sidePx = a; const w = Math.ceil((a + 8) * k);
      body.width = w; body.height = w; body.style.width = `${((a + 8) / SW) * 100}%`; body.style.height = `${((a + 8) / SH) * 100}%`;
      const g = body.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
      const t = Math.min(1, Math.log(P.rho / 100) / Math.log(80)), L = (x, y) => Math.round(x + (y - x) * t);          // цвет по плотности: от светлого дерева к тёмной стали
      const top = `rgb(${L(238, 140)},${L(205, 150)},${L(150, 165)})`, bot = `rgb(${L(205, 70)},${L(160, 80)},${L(100, 95)})`;
      const gr = g.createLinearGradient(0, 4, 0, a + 4); gr.addColorStop(0, top); gr.addColorStop(1, bot);
      rr(g, 4, 4, a, a, 5); g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(40,50,70,.8)'; g.lineWidth = 1.4; g.stroke();
      tex(g, 'ρ', 4 + a / 2, 4 + a / 2 + 6, { size: Math.min(24, a * 0.45), align: 'center', color: 'rgba(30,40,60,.85)' });
    };
    const api = {
      resize() {
        const cssW = box.clientWidth || SW; f = cssW / SW; dprN = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.2e6 / (cssW * ((cssW * SH) / SW))))); k = (cssW * dpr) / SW;
        paintBg(full(bg)); paintBody(); api.layoutWater();
        vec.style.width = `${(VS / SW) * 100}%`; vec.style.height = `${(VS / SH) * 100}%`; vec.width = Math.ceil(VS * k); vec.height = Math.ceil(VS * k); vecC = vec.getContext('2d'); vecC.setTransform(k, 0, 0, k, 0, 0);
        const lab = (src, color) => sprite(64, 28, k, (g) => { tex(g, src, 6, 20, { size: 16, color }); });
        labels = { Ft: lab('\\v{F}_{т}', COLA.Ft), FA: lab('\\v{F}_{А}', COLA.FA) }; lastKey = '';
      },
      layoutWater() {                                            // жидкость: цветной слой, поднимается и опускается масштабом по вертикали
        const col = LIQ[P.rl]?.[1] || '#4aa8ff';
        water.style.left = `${(TX0 / SW) * 100}%`; water.style.width = `${((TX1 - TX0) / SW) * 100}%`; water.style.top = `${((TB - HF * PXM) / SH) * 100}%`; water.style.height = `${((HF * PXM) / SH) * 100}%`;
        water.style.background = `linear-gradient(180deg, ${col}99 0%, ${col}73 100%)`; water.style.borderTop = `2px solid ${col}`;
      },
      params(p) { P = p; d = archimedes.derive(p); paintBg(full(bg)); paintBody(); api.layoutWater(); lastKey = ''; },
      update(s, dd, o) {
        const sn = (v) => Math.round(v * dprN) / dprN, cx = (TX0 + TX1) / 2, yb = zy(s.z), top = yb - sidePx;
        body.style.transform = `translate3d(${sn((cx - sidePx / 2 - 4) * f)}px,${sn((top - 4) * f)}px,0)`;
        const lv = 1 + (s.rise * PXM) / (HF * PXM);              // уровень растёт на V_погр / S_бака
        water.style.transform = `scaleY(${lv})`; water.style.transformOrigin = '50% 100%';
        if (!!o.f !== vecOn) { vecOn = !!o.f; vec.style.display = vecOn ? '' : 'none'; lastKey = ''; }
        if (!vecOn) return;
        const cyc = top + sidePx / 2;
        vec.style.transform = `translate3d(${sn((cx - VS / 2) * f)}px,${sn((cyc - VS / 2) * f)}px,0)`;
        const key = `${s.FA.toFixed(3)}`; if (key === lastKey) return; lastKey = key;
        const c = vecC, h = VS / 2, kF = 66 / Math.max(dd.Ft, dd.FAfull, 0.01), lt = dd.Ft * kF, la = s.FA * kF;
        c.clearRect(0, 0, VS, VS);
        arrow(c, h - 10, h, h - 10, h + lt, { color: COLA.Ft, lw: 2.6, head: 10 }); c.drawImage(labels.Ft, h - 4, h + lt - 22, 64, 28);
        if (la > 1) { arrow(c, h + 10, h, h + 10, h - la, { color: COLA.FA, lw: 2.6, head: 10 }); c.drawImage(labels.FA, h + 22, h - la - 2, 64, 28); }
      },
    };
    vec.style.display = 'none';
    return api;
  },
};
