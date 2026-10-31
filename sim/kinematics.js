// Сцена «Равноускоренное движение»: тележка с начальной скоростью v₀ и постоянным ускорением a на прямой.
// Решение точное: x = x₀ + v₀t + at²/2, v = v₀ + at. Метки показывают положение тележки через каждую секунду (как стробоскопический снимок):
// при равноускоренном движении расстояния между соседними метками растут (или убывают) поровну.
import { fmt, tex, arrow, hatch, sprite, rr } from './tex.js?v=202610311615';

const el = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };
export const COLK = { x: '#1b2330', v: '#1f9d55', a: '#2563eb', s: '#7048e8' };
const SW = 520, SH = 400, GY = 262, LEFT = 40, RIGHT = SW - 30, CW = 76, VW = 240, VH = 120, TW = 8;
const NICE = [1, 2, 5, 10, 20, 50, 100];
const step = (sc) => NICE.find((n) => n * sc >= 46) || 100;

export const kinematics = {
  id: 'kinematics',
  title: 'Равноускоренное движение',
  lead: 'Тележка едет с начальной скоростью и постоянным ускорением. Метки на дороге показывают, где она была через каждую секунду. Измени ускорение и смотри, как меняются графики x(t), v(t) и a(t).',
  stage: { w: SW, h: SH, label: 'Тележка едет вдоль оси x с постоянным ускорением' },
  speed: 1,
  hold: 0.9,
  params: [
    { id: 'x0', name: 'Начальное положение', tex: 'x_0', unit: 'м', min: -10, max: 10, step: 1, def: 0, dec: 0 },
    { id: 'v0', name: 'Начальная скорость', tex: 'v_0', unit: 'м/с', min: -10, max: 10, step: 0.5, def: 6, dec: 1 },
    { id: 'a', name: 'Ускорение', tex: 'a', unit: 'м/с²', min: -5, max: 5, step: 0.5, def: -2, dec: 1 },
  ],
  derive(p) {
    const tStop = p.a !== 0 && -p.v0 / p.a > 0 && -p.v0 / p.a < TW ? -p.v0 / p.a : null;
    const xAt = (t) => p.x0 + p.v0 * t + (p.a * t * t) / 2;
    const pts = [0, TW, ...(tStop != null ? [tStop] : [])].map(xAt), xmin = Math.min(...pts), xmax = Math.max(...pts);
    const vEnd = p.v0 + p.a * TW, sAt = (t) => (tStop != null && t > tStop ? Math.abs(xAt(tStop) - p.x0) + Math.abs(xAt(t) - xAt(tStop)) : Math.abs(xAt(t) - p.x0));
    return { tStop, xmin, xmax, vEnd, xEnd: xAt(TW), sEnd: sAt(TW), sAt, vmaxAbs: Math.max(Math.abs(p.v0), Math.abs(vEnd), 1), xabs: Math.max(Math.abs(xmin), Math.abs(xmax), 1) };
  },
  window: () => TW,
  axisMarks: (d) => (d.tStop != null ? [{ t: d.tStop, tex: 't_\\text{ост}', canvas: 't_{ост}' }] : []),
  at(p, d, t) { return { x: p.x0 + p.v0 * t + (p.a * t * t) / 2, v: p.v0 + p.a * t, a: p.a, s: d.sAt(t) }; },
  marks: (p, d) => (d.tStop != null ? [{ t: d.tStop, kind: 'ext' }] : []),
  panels: [
    { id: 'x', tex: 'x', label: 'x', unit: 'м', signed: true, on: true, max: (p, d) => d.xabs, curves: (S_) => [{ f: (t) => S_.at(t).x, color: COLK.x }] },
    { id: 'v', tex: 'v', label: 'v_x', unit: 'м/с', signed: true, on: true, max: (p, d) => d.vmaxAbs, curves: (S_) => [{ f: (t) => S_.at(t).v, color: COLK.v }] },
    { id: 'a', tex: 'a', label: 'a_x', unit: 'м/с²', signed: true, on: true, max: (p) => Math.max(Math.abs(p.a), 1), curves: (S_) => [{ f: (t) => S_.at(t).a, color: COLK.a }] },
    { id: 's', tex: 's', label: 's', unit: 'м', signed: false, on: false, max: (p, d) => Math.max(d.sEnd, 1), curves: (S_) => [{ f: (t) => S_.at(t).s, color: COLK.s }] },
  ],
  toggles: [{ id: 'v', name: 'Скорость', color: COLK.v }, { id: 'a', name: 'Ускорение', color: COLK.a }, { id: 'g', name: 'Метки времени', color: '#e8590c', on: true }],
  table: {
    cols: ['x', 'v', 'a', 's'],
    units: ['м', 'м/с', 'м/с²', 'м'],
    rows: [
      { id: 'start', color: '#1f9d55', name: 'Старт', vals: (p) => [p.x0, p.v0, p.a, 0], test: (s, p, d, t) => t < 0.02 * TW },
      { id: 'stop', color: '#f08a00', name: 'Остановка', vals: (p, d) => (d.tStop == null ? [null, null, null, null] : [p.x0 + p.v0 * d.tStop + (p.a * d.tStop * d.tStop) / 2, 0, p.a, d.sAt(d.tStop)]), test: (s, p, d, t) => d.tStop != null && Math.abs(t - d.tStop) < 0.03 * TW },
      { id: 'end', color: '#2563eb', name: 'Конец (8 с)', vals: (p, d) => [d.xEnd, d.vEnd, p.a, d.sEnd], test: (s, p, d, t) => t > 0.985 * TW },
    ],
    now: (s) => [s.x, s.v, s.a, s.s],
    note: 'Строка подсвечивается, когда тележка проходит этот момент. Остановка бывает, только если скорость и ускорение направлены в разные стороны. Путь s считается по всей дороге, а перемещение — по разности координат.',
  },
  readouts: (p, d) => [['Время остановки', 't_\\text{ост}', d.tStop == null ? '—' : `${fmt(d.tStop, 2)} с`], ['Положение в конце', 'x_\\text{к}', `${fmt(d.xEnd, 1)} м`],
    ['Перемещение за 8 с', '\\Delta x', `${fmt(d.xEnd - p.x0, 1)} м`], ['Путь за 8 с', 's', `${fmt(d.sEnd, 1)} м`], ['Скорость в конце', 'v_\\text{к}', `${fmt(d.vEnd, 1)} м/с`],
    ['Средняя скорость', 'v_\\text{ср}', `${fmt((d.xEnd - p.x0) / TW, 2)} м/с`]],
  formulas: [
    { tag: 'Координата', color: '#1b2330', tex: 'x = x_0 + v_0 t + \\dfrac{a t^2}{2}' },
    { tag: 'Скорость', color: '#1f9d55', tex: 'v = v_0 + a t' },
    { tag: 'Перемещение без времени', color: '#2563eb', tex: 'v^2 - v_0^2 = 2a\\,\\Delta x' },
  ],

  mount(box, P0) {
    const bg = el('sm-sbg', 'canvas'), cart = el('sm-cart', 'canvas'), vec = el('sm-kvec', 'canvas');
    box.prepend(bg, cart, vec);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label);
    [bg, cart, vec].forEach((e) => e.setAttribute('aria-hidden', 'true'));
    let P = P0, d = kinematics.derive(P0), f = 1, k = 1, dprN = 1, vecC = null, labels = null, sc = 1, vecOn = false, lastKey = '', ghosts = true, lastG = null;
    const span = () => Math.max(d.xmax - d.xmin, 4);
    const X = (x) => LEFT + CW / 2 + (x - d.xmin - (span() - (d.xmax - d.xmin)) / 2) * sc;

    const setup = (cv) => {
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.2e6 / (cssW * ((cssW * SH) / SW)))));
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(((cssW * SH) / SW) * dpr);
      const g = cv.getContext('2d'); g.setTransform(cv.width / SW, 0, 0, cv.height / SH, 0, 0); return g;
    };
    const paintBg = (c) => {
      sc = (RIGHT - LEFT - CW) / span();
      c.clearRect(0, 0, SW, SH);
      // дорога и ось x
      c.fillStyle = 'rgba(160,172,192,.3)'; c.fillRect(LEFT - 14, GY, SW - 16 - LEFT + 14, 12); hatch(c, LEFT - 14, GY, SW - 16 - LEFT + 14, 12, 7, { color: '#9aa5b8', lw: 0.9 });
      c.strokeStyle = '#3b4658'; c.lineWidth = 2; c.beginPath(); c.moveTo(LEFT - 14, GY); c.lineTo(SW - 16, GY); c.stroke();
      const st = step(sc), x0t = Math.ceil((d.xmin - 0.2) / st) * st;
      c.strokeStyle = '#2a3140'; c.lineWidth = 1.3; c.beginPath();
      for (let x = x0t; X(x) <= SW - 36; x += st) { c.moveTo(X(x), GY - 4); c.lineTo(X(x), GY + 4); }
      c.stroke();
      for (let x = x0t; X(x) <= SW - 36; x += st) tex(c, fmt(x, 0), X(x), GY + 28, { size: 12, align: 'center', color: '#3b475c' });
      tex(c, 'x, м', SW - 18, GY - 10, { size: 14, align: 'right' });
      // метки положения через каждую секунду
      if (ghosts) {
        const placed = [];                                               // где метки уже стоят: если тележка вернулась на то же место, номера ставим стопкой, а не друг на друга
        for (let s = 0; s <= TW; s++) {
          const xs = P.x0 + P.v0 * s + (P.a * s * s) / 2, gx = X(xs), row = placed.filter((q) => Math.abs(q - gx) < 30).length;
          if (!row) { c.strokeStyle = 'rgba(232,89,12,.55)'; c.lineWidth = 1.2; c.setLineDash([3, 3]); rr(c, gx - 32, GY - 38, 64, 28, 6); c.stroke(); c.setLineDash([]); }
          c.fillStyle = '#e8590c'; c.beginPath(); c.arc(gx, GY, 3.2, 0, 7); c.fill();
          tex(c, `${s}`, gx, GY - 44 - row * 15, { size: 12, align: 'center', color: '#c2410c' });
          placed.push(gx);
        }
      }
      tex(c, ghosts ? 'Оранжевые метки: где тележка была через 0, 1, 2, … с' : '', SW / 2, SH - 14, { size: 12.5, align: 'center', color: '#6b7a90' });
    };

    const api = {
      resize() {
        const cssW = box.clientWidth || SW; f = cssW / SW; dprN = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.2e6 / (cssW * ((cssW * SH) / SW))))); k = (cssW * dpr) / SW;
        const sz = (cv, w, h) => { cv.style.width = `${(w / SW) * 100}%`; cv.style.height = `${(h / SH) * 100}%`; };
        // тележка: кузов и два колеса, готовая картинка
        const cw = CW, ch = 48; sz(cart, cw, ch); cart.style.top = `${((GY - 47) / SH) * 100}%`; cart.width = Math.ceil(cw * k); cart.height = Math.ceil(ch * k);
        const g = cart.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
        const gr = g.createLinearGradient(0, 8, 0, 36); gr.addColorStop(0, '#5b9dff'); gr.addColorStop(1, '#2a62d9');
        rr(g, 6, 8, 64, 28, 7); g.fillStyle = gr; g.fill(); g.strokeStyle = '#1c47a8'; g.lineWidth = 1.3; g.stroke();
        rr(g, 7.5, 9.5, 61, 25, 6); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.stroke();
        for (const wx of [22, 54]) { g.beginPath(); g.arc(wx, 40, 7, 0, 7); g.fillStyle = '#27303f'; g.fill(); g.beginPath(); g.arc(wx, 40, 2.6, 0, 7); g.fillStyle = '#cbd5e1'; g.fill(); }
        // векторы: небольшой холст, который едет вместе с тележкой
        sz(vec, VW, VH); vec.style.top = `${((GY - 150) / SH) * 100}%`; vec.width = Math.ceil(VW * k); vec.height = Math.ceil(VH * k); vecC = vec.getContext('2d'); vecC.setTransform(k, 0, 0, k, 0, 0);
        const lab = (src, color) => sprite(40, 28, k, (gg) => { tex(gg, src, 4, 20, { size: 17, color }); });
        labels = { v: lab('\\v{v}', COLK.v), a: lab('\\v{a}', COLK.a) };
        paintBg(setup(bg)); lastKey = ''; lastG = ghosts;
      },
      params(p) { P = p; d = kinematics.derive(p); paintBg(setup(bg)); lastKey = ''; },
      update(s, dd, o) {
        const sn = (v) => Math.round(v * dprN) / dprN, cx = X(s.x);
        if (!!o.g !== lastG) { ghosts = !!o.g; lastG = ghosts; paintBg(setup(bg)); }
        cart.style.transform = `translate3d(${sn((cx - CW / 2) * f)}px,0,0)`;
        const any = o.v || o.a;
        if (any !== vecOn) { vecOn = any; vec.style.display = any ? '' : 'none'; lastKey = ''; }
        if (!any) return;
        vec.style.transform = `translate3d(${sn((cx - VW / 2) * f)}px,0,0)`;
        const key = `${s.v.toFixed(2)}|${s.a}|${o.v}|${o.a}`; if (key === lastKey) return; lastKey = key;
        const c = vecC, h = VW / 2, L = 82;
        c.clearRect(0, 0, VW, VH);
        if (o.v) { const l = (s.v / d.vmaxAbs) * L; arrow(c, h, 84, h + l, 84, { color: COLK.v, lw: 2.5, head: 10 }); c.drawImage(labels.v, l >= 0 ? h + l + 2 : h + l - 24, 70, 40, 28); }
        if (o.a) { const l = (s.a / Math.max(Math.abs(P.a), 1)) * L * 0.8; arrow(c, h, 44, h + l, 44, { color: COLK.a, lw: 2.5, head: 10 }); c.drawImage(labels.a, l >= 0 ? h + l + 2 : h + l - 24, 30, 40, 28); }
      },
    };
    vec.style.display = 'none';
    return api;
  },
};
