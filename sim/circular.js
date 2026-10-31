// Сцена «Движение по окружности»: тело равномерно движется по окружности радиуса R со скоростью v (вид сверху).
// Скорость v⃗ направлена по касательной, ускорение a⃗ = v²/R направлено к центру. Проекции на оси — гармонические колебания:
// так вращение связано с колебаниями. Таблица показывает разницу между путём и перемещением за четверть, половину и целый оборот.
import { fmt, tex, arrow, sprite } from './tex.js?v=202611010236';

const el = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };
export const COLR = { x: '#1b2330', y: '#7048e8', v: '#1f9d55', a: '#2563eb', r: '#e8590c' };
const SW = 520, SH = 400, CX = 260, CY = 196, RMAXPX = 150, RMAX = 2, LV = 11, LA = 4.5, LAMAX = 120;
const SC = RMAXPX / RMAX;

export const circular = {
  id: 'circular',
  title: 'Движение по окружности',
  lead: 'Тело равномерно движется по окружности. Скорость всё время меняет направление, поэтому ускорение есть, хотя модуль скорости постоянен: оно направлено к центру. Измени радиус и скорость и смотри на период, частоту и ускорение.',
  stage: { w: SW, h: SH, label: 'Тело движется по окружности: векторы скорости и центростремительного ускорения' },
  speed: 0.5,
  hold: 0.4,
  params: [
    { id: 'R', name: 'Радиус окружности', tex: 'R', unit: 'м', min: 0.2, max: RMAX, step: 0.1, def: 1, dec: 1 },
    { id: 'v', name: 'Скорость', tex: 'v', unit: 'м/с', min: 0.5, max: 6, step: 0.1, def: 3, dec: 1 },
  ],
  derive(p) {
    const T = (2 * Math.PI * p.R) / p.v, w = p.v / p.R, a = (p.v * p.v) / p.R, win = Math.min(12, Math.max(3, 3 * T));
    return { T, w, a, nu: 1 / T, win, ak: Math.min(1, LAMAX / (a * LA)) };
  },
  window: (d) => d.win,
  axisMarks: (d) => [1, 2, 3].filter((n) => n * d.T <= d.win + 1e-9).map((n) => ({ t: n * d.T, tex: n === 1 ? 'T' : `${n}T`, canvas: n === 1 ? 'T' : `${n}T` })),
  at(p, d, t) {
    const ph = d.w * t, c = Math.cos(ph), s = Math.sin(ph);
    return { t, x: p.R * c, y: p.R * s, vx: -p.v * s, vy: p.v * c, ax: -d.a * c, ay: -d.a * s, ph, s: p.v * t, dr: 2 * p.R * Math.abs(Math.sin(ph / 2)), n: ph / (2 * Math.PI) };
  },
  marks: (p, d) => [1, 2, 3].filter((n) => n * d.T <= d.win + 1e-9).map((n) => ({ t: n * d.T, kind: 'ext' })),
  panels: [
    { id: 'x', tex: 'x', label: 'x', unit: 'м', signed: true, on: true, max: (p) => p.R, curves: (S_) => [{ f: (t) => S_.at(t).x, color: COLR.x }] },
    { id: 'y', tex: 'y', label: 'y', unit: 'м', signed: true, on: true, max: (p) => p.R, curves: (S_) => [{ f: (t) => S_.at(t).y, color: COLR.y }] },
    { id: 'vx', tex: 'v_x', label: 'v_x', unit: 'м/с', signed: true, on: false, max: (p) => p.v, curves: (S_) => [{ f: (t) => S_.at(t).vx, color: COLR.v }] },
    { id: 'ax', tex: 'a_x', label: 'a_x', unit: 'м/с²', signed: true, on: false, max: (p, d) => d.a, curves: (S_) => [{ f: (t) => S_.at(t).ax, color: COLR.a }] },
  ],
  toggles: [{ id: 'v', name: 'Скорость', color: COLR.v, on: true }, { id: 'a', name: 'Ускорение', color: COLR.a, on: true }, { id: 'r', name: 'Радиус', color: COLR.r, on: true }],
  table: {
    cols: ['t', 's', '|\\Delta\\vec r|', 'N'],
    units: ['с', 'м', 'м', ''],
    rows: [
      { id: 'q', color: '#1f9d55', name: '¼ оборота', vals: (p, d) => [d.T / 4, (Math.PI * p.R) / 2, Math.SQRT2 * p.R, 0.25], test: (s, p, d, t) => Math.abs(t - d.T / 4) < 0.03 * d.win },
      { id: 'h', color: '#2563eb', name: '½ оборота', vals: (p, d) => [d.T / 2, Math.PI * p.R, 2 * p.R, 0.5], test: (s, p, d, t) => Math.abs(t - d.T / 2) < 0.03 * d.win },
      { id: 'f', color: '#e8590c', name: 'Оборот', vals: (p, d) => [d.T, 2 * Math.PI * p.R, 0, 1], test: (s, p, d, t) => Math.abs(t - d.T) < 0.03 * d.win },
    ],
    now: (s) => [s.t, s.s, s.dr, s.n],
    note: 'Путь s растёт всё время, а модуль перемещения |Δr| после целого оборота равен нулю: тело вернулось в начальную точку. N — число оборотов.',
  },
  readouts: (p, d) => [['Период', 'T = 2\\pi R/v', `${fmt(d.T, 2)} с`], ['Частота', '\\nu = 1/T', `${fmt(d.nu, 2)} Гц`], ['Угловая скорость', '\\omega = v/R', `${fmt(d.w, 2)} рад/с`],
    ['Ускорение', 'a = v^2/R', `${fmt(d.a, 2)} м/с²`], ['Путь за оборот', 's = 2\\pi R', `${fmt(2 * Math.PI * p.R, 2)} м`]],
  formulas: [
    { tag: 'Период и частота', color: '#e8590c', tex: 'T = \\dfrac{2\\pi R}{v},\\qquad \\nu = \\dfrac{1}{T}' },
    { tag: 'Угловая скорость', color: '#7048e8', tex: '\\omega = \\dfrac{2\\pi}{T} = \\dfrac{v}{R},\\qquad v = \\omega R' },
    { tag: 'Центростремительное ускорение', color: '#2563eb', tex: 'a = \\dfrac{v^2}{R} = \\omega^2 R' },
  ],

  mount(box, P0) {
    const bg = el('sm-sbg', 'canvas'), ball = el('sm-cart', 'canvas'), rad = el('sm-cart', 'canvas'), av = el('sm-cart', 'canvas'), aa = el('sm-cart', 'canvas'), lv = el('sm-kvec', 'canvas'), la = el('sm-kvec', 'canvas');
    box.prepend(bg, rad, ball, av, aa, lv, la);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label); [bg, ball, rad, av, aa, lv, la].forEach((e) => e.setAttribute('aria-hidden', 'true'));
    let P = P0, d = circular.derive(P0), f = 1, k = 1, dprN = 1, shown = { v: true, a: true, r: true };
    const setup = (cv) => {
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.2e6 / (cssW * ((cssW * SH) / SW)))));
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(((cssW * SH) / SW) * dpr);
      const g = cv.getContext('2d'); g.setTransform(cv.width / SW, 0, 0, cv.height / SH, 0, 0); return g;
    };
    const place = (cv, w, h, ax = 0, ay = 0) => { cv.style.width = `${(w / SW) * 100}%`; cv.style.height = `${(h / SH) * 100}%`; cv.style.left = `${(-ax / SW) * 100}%`; cv.style.top = `${(-ay / SH) * 100}%`; cv.style.transformOrigin = `${ax * f}px ${ay * f}px`; cv.width = Math.ceil(w * k); cv.height = Math.ceil(h * k); const g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); return g; };
    const paintBg = () => {
      const c = setup(bg); c.clearRect(0, 0, SW, SH);
      const r = P.R * SC; c.strokeStyle = '#2a3140'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(CX - RMAXPX - 20, CY); c.lineTo(CX + RMAXPX + 24, CY); c.moveTo(CX, CY + RMAXPX + 20); c.lineTo(CX, CY - RMAXPX - 24); c.stroke();
      tex(c, 'x', CX + RMAXPX + 26, CY + 22, { size: 15 }); tex(c, 'y', CX + 10, CY - RMAXPX - 20, { size: 15 });
      c.setLineDash([6, 5]); c.strokeStyle = '#7a8aa5'; c.lineWidth = 2; c.beginPath(); c.arc(CX, CY, r, 0, 7); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#2a3140'; c.beginPath(); c.arc(CX, CY, 4, 0, 7); c.fill(); tex(c, 'O', CX - 18, CY + 20, { size: 15 });
      tex(c, `R = ${fmt(P.R, 1)} м`, CX, SH - 16, { size: 15, align: 'center', color: '#3b475c' });
    };
    const build = () => {
      const bs = 28; place(ball, bs, bs, bs / 2, bs / 2); { const g = ball.getContext('2d'); const gr = g.createRadialGradient(10, 9, 2, 14, 14, 14); gr.addColorStop(0, '#ffb47a'); gr.addColorStop(1, '#e8590c'); g.beginPath(); g.arc(14, 14, 12, 0, 7); g.fillStyle = gr; g.fill(); g.strokeStyle = '#a63b00'; g.lineWidth = 1.4; g.stroke(); }
      const Lr = P.R * SC, Lv = P.v * LV, La = Math.max(10, d.a * LA * d.ak);
      { const g = place(rad, Lr + 4, 6, 0, 3); g.strokeStyle = COLR.r; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(0, 3); g.lineTo(Lr, 3); g.stroke(); g.setLineDash([]); }
      { const g = place(av, Lv + 16, 24, 0, 12); arrow(g, 0, 12, Lv, 12, { color: COLR.v, lw: 3, head: 11 }); }
      { const g = place(aa, La + 16, 24, 0, 12); arrow(g, 0, 12, La, 12, { color: COLR.a, lw: 3, head: 11 }); }
      for (const [cv, s, col] of [[lv, '\\v{v}', COLR.v], [la, '\\v{a}', COLR.a]]) { const g = place(cv, 44, 30); g.clearRect(0, 0, 44, 30); const sp = sprite(44, 30, k, (gg) => tex(gg, s, 4, 22, { size: 19, color: col })); g.drawImage(sp, 0, 0, 44, 30); }
      d.La = La; d.Lv = Lv;
    };
    const api = {
      resize() { f = (box.clientWidth || SW) / SW; dprN = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); const dpr = Math.max(1, Math.min(2, dprN, Math.sqrt(1.2e6 / ((box.clientWidth || SW) * (((box.clientWidth || SW) * SH) / SW))))); k = ((box.clientWidth || SW) * dpr) / SW; paintBg(); build(); },
      params(p) { P = p; d = circular.derive(p); paintBg(); build(); },
      update(s, dd, o) {
        const sn = (v) => Math.round(v * dprN) / dprN, bx = CX + s.x * SC, by = CY - s.y * SC, th = -(s.ph % (2 * Math.PI)), thv = th - Math.PI / 2, tha = th + Math.PI;
        ball.style.transform = `translate3d(${sn(bx * f)}px,${sn(by * f)}px,0)`;
        const vis = (e, on, key) => { if (shown[key] !== on) { shown[key] = on; } e.style.visibility = on ? 'visible' : 'hidden'; };
        vis(rad, o.r, 'r'); rad.style.transform = `translate3d(${sn(CX * f)}px,${sn(CY * f)}px,0) rotate(${th}rad)`;
        vis(av, o.v, 'v'); av.style.transform = `translate3d(${sn(bx * f)}px,${sn(by * f)}px,0) rotate(${thv}rad)`;
        vis(aa, o.a, 'a'); aa.style.transform = `translate3d(${sn(bx * f)}px,${sn(by * f)}px,0) rotate(${tha}rad)`;
        const tip = (L, ang, off) => [bx + (L + off) * Math.cos(ang), by + (L + off) * Math.sin(ang)];
        const [lx, ly] = tip(d.Lv, thv, 14), [mx, my] = tip(d.La, tha, 14);
        vis(lv, o.v, 'v'); lv.style.transform = `translate3d(${sn((lx - 12) * f)}px,${sn((ly - 20) * f)}px,0)`;
        vis(la, o.a, 'a'); la.style.transform = `translate3d(${sn((mx - 12) * f)}px,${sn((my - 20) * f)}px,0)`;
      },
    };
    return api;
  },
};
