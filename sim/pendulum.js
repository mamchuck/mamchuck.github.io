// Сцена «Математический маятник»: груз на нити длиной l качается в поле тяжести g.
// Уравнение φ'' = −(g/l)·sin φ решается числено (метод Рунге — Кутты 4-го порядка, шаг 1/480 с), поэтому большие углы считаются честно.
// Для сравнения на графике можно показать гармоническую модель φ = φ₀·cos(ωt) (она верна только для малых углов).
// Маятник — это обычный элемент с поворотом, его ведёт видеокарта; фон и векторы рисуются отдельно.
import { fmt, tex, arrow, hatch, sprite } from './tex.js?v=202611091430';

const PI = Math.PI;
const el = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };
export const COLM = { phi: '#1b2330', v: '#1f9d55', Ek: '#e8590c', Ep: '#7048e8', E: '#64748b', N: '#d6336c', model: '#64748b' };
const SW = 520, SH = 400, PX = 260, PY = 66, VS = 220, DT = 1 / 480;
const LP = (l) => 100 + 75 * l;                                   // длина нити на сцене: от 115 до 250 единиц, чтобы маятник занимал сцену, а изменение длины было видно
const deg = (r) => (r * 180) / PI;

// Точный период через среднее арифметико-геометрическое: T = 4·√(l/g)·K(sin(φ₀/2))
function exactPeriod(g, l, phi0) {
  const k = Math.sin(Math.abs(phi0) / 2); let a = 1, b = Math.sqrt(1 - k * k);
  for (let i = 0; i < 24; i++) { const a1 = (a + b) / 2; b = Math.sqrt(a * b); a = a1; }
  return 4 * Math.sqrt(l / g) * (PI / (2 * a));
}
function integrate(g, l, phi0, tmax) {
  const n = Math.ceil(tmax / DT) + 2, A = new Float64Array(n), W = new Float64Array(n), k = g / l, h = DT; let a = phi0, w = 0; A[0] = a;
  for (let i = 1; i < n; i++) {
    const k1a = w, k1w = -k * Math.sin(a), k2a = w + (h / 2) * k1w, k2w = -k * Math.sin(a + (h / 2) * k1a);
    const k3a = w + (h / 2) * k2w, k3w = -k * Math.sin(a + (h / 2) * k2a), k4a = w + h * k3w, k4w = -k * Math.sin(a + h * k3a);
    a += (h / 6) * (k1a + 2 * k2a + 2 * k3a + k4a); w += (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w); A[i] = a; W[i] = w;
  }
  return { A, W };
}

export const pendulum = {
  id: 'pendulum',
  title: 'Математический маятник',
  lead: 'Оттяни груз и отпусти. Период зависит от длины нити и от g, но не от массы груза. Поменяй массу и убедись. Пунктир на графике — упрощённая гармоническая модель: при больших углах она расходится с расчётом.',
  stage: { w: SW, h: SH, label: 'Груз на нити качается как маятник' },
  speed: 0.5,
  params: [
    { id: 'l', name: 'Длина нити', tex: 'l', unit: 'м', min: 0.2, max: 2, step: 0.1, def: 1, dec: 1 },
    { id: 'm', name: 'Масса груза', tex: 'm', unit: 'кг', min: 0.1, max: 2, step: 0.1, def: 0.5, dec: 1 },
    { id: 'phi0', name: 'Начальный угол', tex: '\\varphi_0', unit: '°', min: -80, max: 80, step: 1, def: 30, dec: 0 },
    { id: 'g', name: 'Планета', tex: 'g', unit: 'м/с²', dec: 1, def: 10, options: [{ label: 'Луна', v: 1.6 }, { label: 'Марс', v: 3.7 }, { label: 'Земля', v: 10 }, { label: 'Юпитер', v: 25 }] },
  ],
  derive(p) {
    const phi0 = ((Math.abs(p.phi0) < 3 ? 3 * (p.phi0 < 0 ? -1 : 1) : p.phi0) * PI) / 180, g = p.g, l = p.l, m = p.m;
    const T = exactPeriod(g, l, phi0), T0 = 2 * PI * Math.sqrt(l / g), w0 = Math.sqrt(g / l), T4 = 4 * T, sim = integrate(g, l, phi0, T4);
    const c0 = Math.cos(phi0);
    return { phi0, T, T0, w0, T4, sim, vmax: Math.sqrt(2 * g * l * (1 - c0)), E: m * g * l * (1 - c0), Nmax: m * g * (3 - 2 * c0), Nmin: m * g * c0, ph0deg: Math.abs(deg(phi0)) };
  },
  window: (d) => d.T4,
  axisMarks: (d) => [1, 2, 3, 4].map((k) => ({ t: k * d.T, tex: k === 1 ? 'T' : `${k}T`, canvas: k === 1 ? 'T' : `${k}T` })),
  at(p, d, t) {
    const x = Math.min(Math.max(t, 0), d.T4) / DT, i = Math.min(Math.floor(x), d.sim.A.length - 2), fr = x - i;
    const phi = d.sim.A[i] + (d.sim.A[i + 1] - d.sim.A[i]) * fr, w = d.sim.W[i] + (d.sim.W[i + 1] - d.sim.W[i]) * fr, v = p.l * w;
    return { phi, w, v, deg: deg(phi), Ek: 0.5 * p.m * v * v, Ep: p.m * p.g * p.l * (1 - Math.cos(phi)), N: p.m * (p.g * Math.cos(phi) + p.l * w * w), model: deg(d.phi0 * Math.cos(d.w0 * t)) };
  },
  marks(p, d) {
    const out = [];
    for (let j = 0; j <= 8; j++) { const te = (j * d.T) / 2, tq = d.T / 4 + (j * d.T) / 2; if (te <= d.T4 + 1e-9) out.push({ t: te, kind: 'ext' }); if (tq <= d.T4 + 1e-9) out.push({ t: tq, kind: 'eq' }); }
    return out;
  },
  panels: [
    { id: 'phi', tex: '\\varphi', label: 'φ', unit: '°', signed: true, on: true, max: (p, d) => d.ph0deg,
      curves: (S_, fl) => [{ f: (t) => S_.at(t).deg, color: COLM.phi, name: 'расчёт' }, ...(fl.model ? [{ f: (t) => S_.at(t).model, color: COLM.model, dash: [5, 4], alpha: 0.95, name: 'гарм.' }] : [])] },
    { id: 'v', tex: 'v', label: 'v', unit: 'м/с', signed: true, on: true, max: (p, d) => Math.max(d.vmax, 0.1), curves: (S_) => [{ f: (t) => S_.at(t).v, color: COLM.v }] },
    { id: 'E', tex: 'E', label: 'E', unit: 'Дж', signed: false, on: true, max: (p, d) => Math.max(d.E, 1e-3),
      curves: (S_, fl) => [{ f: (t) => S_.at(t).Ek, color: COLM.Ek, name: 'E_к' }, { f: (t) => S_.at(t).Ep, color: COLM.Ep, name: 'E_п' }, { f: () => S_.d.E, color: COLM.E, dash: [5, 4], name: 'E' }] },
    { id: 'N', tex: 'N', label: 'N', unit: 'Н', signed: false, on: false, max: (p, d) => Math.max(d.Nmax, 0.1), curves: (S_) => [{ f: (t) => S_.at(t).N, color: COLM.N }] },
  ],
  toggles: [{ id: 'f', name: 'Силы', color: '#d6336c' }, { id: 'v', name: 'Скорость', color: '#1f9d55' }, { id: 'model', name: 'Гармоническая модель', color: '#64748b', on: true, graphs: true }],
  table: {
    cols: ['|\\varphi|', '|v|', 'E_\\text{к}', 'E_\\text{п}', 'N'],
    units: ['°', 'м/с', 'Дж', 'Дж', 'Н'],
    rows: [
      { id: 'ext', color: '#f08a00', name: 'Крайнее', vals: (p, d) => [d.ph0deg, 0, 0, d.E, d.Nmin], test: (s, p, d) => Math.abs(s.deg) > 0.97 * d.ph0deg },
      { id: 'low', color: '#2563eb', name: 'Нижняя точка', vals: (p, d) => [0, d.vmax, d.E, 0, d.Nmax], test: (s, p, d) => Math.abs(s.v) > 0.985 * d.vmax },
    ],
    now: (s) => [Math.abs(s.deg), Math.abs(s.v), s.Ek, s.Ep, s.N],
    note: 'Строка подсвечивается, когда груз проходит это положение. Оранжевые вертикали на графиках — крайние положения, синие — нижняя точка. Нить натянута сильнее всего внизу: там к весу добавляется сила, меняющая направление скорости.',
  },
  readouts: (p, d) => [['Период (расчёт)', 'T', `${fmt(d.T, 3)} с`], ['Малые углы 2π√(l/g)', 'T_0', `${fmt(d.T0, 3)} с`], ['Разница', '\\delta', `${fmt(((d.T / d.T0) - 1) * 100, 1)} %`],
    ['Частота', '\\nu', `${fmt(1 / d.T, 2)} Гц`], ['Скорость внизу', 'v_{\\max}', `${fmt(d.vmax, 2)} м/с`], ['Полная энергия', 'E', `${fmt(d.E * 1000, 0)} мДж`]],
  formulas: [
    { tag: 'Период (малые углы)', color: '#1b2330', tex: 'T = 2\\pi\\sqrt{\\dfrac{l}{g}}' },
    { tag: 'Скорость в нижней точке', color: '#1f9d55', tex: 'v_{\\max} = \\sqrt{2gl\\,(1-\\cos\\varphi_0)}' },
    { tag: 'Энергия', color: '#7048e8', tex: 'E = mgl\\,(1-\\cos\\varphi_0) = E_\\text{к} + E_\\text{п}' },
  ],

  mount(box, P0) {
    const bg = el('sm-sbg', 'canvas'), pend = el('sm-pend'), rod = el('sm-rod'), bob = el('sm-bob', 'canvas'), vec = el('sm-pvec2', 'canvas');
    pend.append(rod, bob); box.prepend(bg, pend, vec);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label);
    [bg, bob, vec].forEach((e) => e.setAttribute('aria-hidden', 'true'));
    let P = P0, d = pendulum.derive(P0), f = 1, k = 1, dprN = 1, vecC = null, labels = null, vecOn = false, lastKey = '', R = 14, Lpx = 175;
    const radius = () => 11 + (7 * (P.m - 0.1)) / 1.9;
    const full = (cv) => {
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.2e6 / (cssW * ((cssW * SH) / SW)))));
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(((cssW * SH) / SW) * dpr);
      const g = cv.getContext('2d'); g.setTransform(cv.width / SW, 0, 0, cv.height / SH, 0, 0); return g;
    };
    const paintBg = (c) => {
      c.clearRect(0, 0, SW, SH); Lpx = LP(P.l); const a0 = d.phi0;
      // потолок и подвес
      c.fillStyle = 'rgba(160,172,192,.35)'; c.fillRect(PX - 90, PY - 22, 180, 22); hatch(c, PX - 90, PY - 22, 180, 22, 7, { color: '#8793a8', lw: 1 });
      c.strokeStyle = '#3b4658'; c.lineWidth = 2; c.beginPath(); c.moveTo(PX - 90, PY); c.lineTo(PX + 90, PY); c.stroke();
      // вертикаль равновесия, дуга движения, крайние положения
      c.setLineDash([3, 4]); c.strokeStyle = '#8a97ad'; c.lineWidth = 1; c.beginPath(); c.moveTo(PX, PY); c.lineTo(PX, PY + Lpx + 34); c.stroke(); c.setLineDash([]);
      c.strokeStyle = 'rgba(100,116,139,.5)'; c.lineWidth = 1.4; c.setLineDash([5, 4]); c.beginPath();
      const A = Math.abs(a0); c.arc(PX, PY, Lpx, PI / 2 - A, PI / 2 + A); c.stroke(); c.setLineDash([]);
      for (const sgn of [-1, 1]) { const ex = PX + Lpx * Math.sin(sgn * A), ey = PY + Lpx * Math.cos(A); c.strokeStyle = '#f08a00'; c.lineWidth = 1.2; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(PX, PY); c.lineTo(ex, ey); c.stroke(); c.setLineDash([]); }
      // угол φ₀: дуга между вертикалью и нитью в крайнем положении
      const r0 = Math.min(46, Lpx * 0.45), mid = PI / 2 - a0 / 2;
      c.strokeStyle = '#2a3140'; c.lineWidth = 1.4; c.beginPath(); if (a0 >= 0) c.arc(PX, PY, r0, PI / 2 - a0, PI / 2); else c.arc(PX, PY, r0, PI / 2, PI / 2 - a0); c.stroke();
      tex(c, 'φ_0', PX + (r0 + 24) * Math.cos(mid) - 9, PY + (r0 + 24) * Math.sin(mid) + 5, { size: 15 });
      // шарнир
      c.fillStyle = '#27303f'; c.beginPath(); c.arc(PX, PY, 4.5, 0, 7); c.fill();
    };

    const api = {
      resize() {
        const cssW = box.clientWidth || SW; f = cssW / SW; dprN = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.2e6 / (cssW * ((cssW * SH) / SW))))); k = (cssW * dpr) / SW;
        api.layoutPend(); paintBg(full(bg)); lastKey = '';
        vec.style.width = `${(VS / SW) * 100}%`; vec.style.height = `${(VS / SH) * 100}%`; vec.width = Math.ceil(VS * k); vec.height = Math.ceil(VS * k); vecC = vec.getContext('2d'); vecC.setTransform(k, 0, 0, k, 0, 0);
        const lab = (src, color) => sprite(70, 28, k, (g) => { tex(g, src, 6, 20, { size: 16, color }); });
        labels = { mg: lab('\\v{mg}', COLM.N), T: lab('\\v{T}', '#2563eb'), v: lab('\\v{v}', COLM.v) };
      },
      layoutPend() {                                                // длина нити и размер груза зависят от параметров
        R = radius(); Lpx = LP(P.l);
        rod.style.height = `${Lpx * f}px`; rod.style.width = `${Math.max(1.6, 1.8 * f)}px`; rod.style.left = `${-Math.max(1.6, 1.8 * f) / 2}px`;
        const bw = (2 * R + 6) * f; bob.style.width = `${bw}px`; bob.style.height = `${bw}px`; bob.style.left = `${-bw / 2}px`; bob.style.top = `${Lpx * f - bw / 2}px`;
        bob.width = Math.ceil((2 * R + 6) * k); bob.height = bob.width;
        const g = bob.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); const c = R + 3;
        const rg = g.createRadialGradient(c - R * 0.35, c - R * 0.4, 1, c, c, R); rg.addColorStop(0, '#a9c9ff'); rg.addColorStop(1, '#2a62d9');
        g.beginPath(); g.arc(c, c, R, 0, 7); g.fillStyle = rg; g.fill(); g.strokeStyle = '#1c47a8'; g.lineWidth = 1.5; g.stroke();
      },
      params(p) { P = p; d = pendulum.derive(p); api.layoutPend(); paintBg(full(bg)); lastKey = ''; },
      update(s, dd, o) {
        const sn = (v) => Math.round(v * dprN) / dprN;
        pend.style.transform = `translate3d(${sn(PX * f)}px,${sn(PY * f)}px,0) rotate(${-s.deg}deg)`;
        const any = o.f || o.v;
        if (any !== vecOn) { vecOn = any; vec.style.display = any ? '' : 'none'; lastKey = ''; }
        if (!any) return;
        const bx = PX + Lpx * Math.sin(s.phi), by = PY + Lpx * Math.cos(s.phi);
        vec.style.transform = `translate3d(${sn((bx - VS / 2) * f)}px,${sn((by - VS / 2) * f)}px,0)`;
        const key = `${s.deg.toFixed(2)}|${s.v.toFixed(3)}|${o.f}|${o.v}`; if (key === lastKey) return; lastKey = key;
        const c = vecC, h = VS / 2, kF = 66 / Math.max(d.Nmax, P.m * P.g), sp = Math.sin(s.phi), cp = Math.cos(s.phi);
        c.clearRect(0, 0, VS, VS);
        if (o.f) {
          const mg = P.m * P.g * kF, N = s.N * kF;
          arrow(c, h, h, h, h + mg, { color: COLM.N, lw: 2.4, head: 9 }); c.drawImage(labels.mg, h + 4, h + mg - 20, 70, 28);
          arrow(c, h, h, h - N * sp, h - N * cp, { color: '#2563eb', lw: 2.4, head: 9 }); c.drawImage(labels.T, h - N * sp + 6, h - N * cp - 22, 70, 28);
        }
        if (o.v) { const l = (s.v / Math.max(d.vmax, 0.1)) * 58, tx = l * cp, ty = -l * sp; arrow(c, h, h, h + tx, h + ty, { color: COLM.v, lw: 2.6, head: 10 }); c.drawImage(labels.v, h + tx + (tx >= 0 ? 4 : -22), h + ty - 6, 70, 28); }
      },
    };
    vec.style.display = 'none';
    return api;
  },
};

// Оттянуть груз: по положению указателя считаем угол
pendulum.grab = {
  hit: (p, d, s, lx, ly) => { const bx = PX + LP(p.l) * Math.sin(s.phi), by = PY + LP(p.l) * Math.cos(s.phi); return Math.hypot(lx - bx, ly - by) < 30; },
  to: (p, lx, ly) => { let a = (Math.atan2(lx - PX, Math.max(ly - PY, 8)) * 180) / PI; a = Math.max(-80, Math.min(80, a)); if (Math.abs(a) < 3) a = a < 0 ? -3 : 3; return { phi0: Math.round(a) }; },
};
