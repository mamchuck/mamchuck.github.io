// Сцена «Газ в сосуде (МКТ)»: молекулы идеального газа летают в сосуде с поршнем и упруго отражаются от стенок.
// Давление — это удары о поршень: p = (импульс, переданный за время) / (площадь · время). Температура задаёт среднюю скорость: ⟨v²⟩ ∝ T.
// Показано, что давление, измеренное по ударам, совпадает с pV ∝ NT (в относительных единицах, за 1 принято состояние по умолчанию).
import { fmt, tex, rr, math as mathHtml } from './tex.js?v=202611010223';

const el = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };
const SW = 520, SH = 400, X0 = 40, YT = 78, YB = 330, WMAX = 380, HB = YB - YT, R = 4.2, VR0 = 150, NMAX = 90, N0 = 40, T0 = 300;
const REF = (N0 * (VR0 * VR0) / 2) / ((WMAX - 2 * R) * (HB - 2 * R));                       // p_ref = N·m·⟨vx²⟩/(W·H) при N = 40, T = 300 К, V = 1 (m = 1)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const mkt = {
  id: 'mkt',
  mode: 'free',
  title: 'Газ в сосуде: молекулы, давление, температура',
  lead: 'Молекулы газа летают и упруго отскакивают от стенок. Давление — это удары о поршень. Нагрей газ — молекулы побегут быстрее, удары станут сильнее и чаще. Сожми газ — ударов о поршень станет больше.',
  stage: { w: SW, h: SH, label: 'Молекулы газа в сосуде с подвижным поршнем' },
  animated: true,
  params: [
    { id: 'T', name: 'Температура', tex: 'T', unit: 'К', min: 100, max: 600, step: 10, def: 300, dec: 0 },
    { id: 'V', name: 'Объём (положение поршня)', tex: 'V', unit: '%', min: 30, max: 100, step: 5, def: 100, dec: 0 },
    { id: 'N', name: 'Число молекул', tex: 'N', unit: '', min: 10, max: NMAX, step: 5, def: N0, dec: 0 },
  ],
  toggles: [{ id: 'col', name: 'Цвет по скорости', color: '#e8590c', on: true }],
  actions: [
    { id: 'squeeze', group: 'Опыты', label: 'Сжать газ', color: '#2563eb' },
    { id: 'heat', group: 'Опыты', label: 'Нагреть', color: '#e8590c' },
    { id: 'cool', group: 'Опыты', label: 'Охладить', color: '#339af0' },
    { id: 'reset', group: 'Опыты', label: 'Исходное', color: '#868e96' },
  ],
  act(id) { return { set: { squeeze: { V: 40 }, heat: { T: 600 }, cool: { T: 150 }, reset: { T: 300, V: 100, N: N0 } }[id] }; },
  derive(p) {
    const Vf = p.V / 100, pth = (p.N / N0) * (p.T / T0) / Vf, vr = VR0 * Math.sqrt(p.T / T0), n = p.N / Vf;
    return { Vf, pth, vr, n, vmean: Math.sqrt(p.T / T0), pV: pth * Vf, ek: p.T / T0 };
  },
  readouts: (p, d) => [['Давление (по формуле)', 'p \\propto \\dfrac{NT}{V}', `${fmt(d.pth, 2)} от исходного`], ['Концентрация молекул', 'n = N/V', `${fmt(d.n / N0, 2)} от исходной`],
    ['Средняя кинетическая энергия', '\\bar E_\\text{к} = \\tfrac{3}{2}kT', `${fmt(d.ek, 2)} от исходной`], ['Средняя скорость', 'v \\propto \\sqrt{T}', `${fmt(d.vmean, 2)} от исходной`], ['Произведение', 'pV/(NT)', 'постоянно']],
  formulas: [
    { tag: 'Основное уравнение МКТ', color: '#2563eb', tex: 'p = \\dfrac{2}{3}\\,n\\,\\bar E_\\text{к} = n k T' },
    { tag: 'Уравнение состояния', color: '#e8590c', tex: 'pV = \\nu R T' },
    { tag: 'Средняя энергия', color: '#7048e8', tex: '\\bar E_\\text{к} = \\dfrac{3}{2} k T,\\qquad v_\\text{кв} = \\sqrt{\\dfrac{3kT}{m_0}}' },
  ],
  note: 'Время и числа в сцене условные: для удобства все величины показаны в долях от исходного состояния (T = 300 К, V = 100 %, N = 40).',
  info(p, d) {
    const rel = (x) => (x > 1.0005 ? 'больше' : x < 0.9995 ? 'меньше' : 'как было');
    return `<div class="sm-big" style="font-size:24px">Ударов о поршень: <span id="sm-mkt-rate">…</span></div>
      <div><span class="sm-chip">давление по ударам: <b id="sm-mkt-pm">…</b> от исходного</span></div>
      <table class="sm-it"><tr><td>Температура</td><td>${rel(d.ek)} (${fmt(p.T, 0)} К)</td></tr><tr><td>Объём</td><td>${rel(d.Vf)} (${fmt(p.V, 0)} %)</td></tr><tr><td>Концентрация</td><td>${rel(d.n / N0)}</td></tr><tr><td>Давление (формула)</td><td>${rel(d.pth)} (${fmt(d.pth, 2)})</td></tr></table>
      <div class="sm-eq">Нагрей газ при постоянном объёме — давление растёт прямо пропорционально T (закон Шарля).<small>Сожми газ при постоянной температуре — давление растёт обратно пропорционально V (закон Бойля — Мариотта).</small></div>`;
  },

  mount(box, P0) {
    const bg = el('sm-sbg', 'canvas'), gas = el('sm-gascv', 'canvas'); box.prepend(bg); box.append(gas);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label); bg.setAttribute('aria-hidden', 'true'); gas.setAttribute('aria-hidden', 'true');
    let P = P0, d = mkt.derive(P0), f = 1, gc = null, gk = 1, colOn = true;
    const px = new Float32Array(NMAX), py = new Float32Array(NMAX), pvx = new Float32Array(NMAX), pvy = new Float32Array(NMAX);
    let n = 0, lastT = P0.T, lastTime = null, xw = X0 + WMAX * (P0.V / 100), tgt = xw, imp = 0, win = 0, pm = 1, rate = 0, hits = 0, lastUi = 0, repaint = true;
    const rnd = (() => { let a = 12345; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
    const spawn = (i) => { const s = d.vr * Math.sqrt(-Math.log(1 - rnd() * 0.999)), a = rnd() * 2 * Math.PI; px[i] = X0 + R + rnd() * (xw - X0 - 2 * R); py[i] = YT + R + rnd() * (HB - 2 * R); pvx[i] = s * Math.cos(a); pvy[i] = s * Math.sin(a); };
    const norm = () => { let s2 = 0; for (let i = 0; i < n; i++) s2 += pvx[i] * pvx[i] + pvy[i] * pvy[i]; if (!n || !s2) return; const k = d.vr / Math.sqrt(s2 / n); for (let i = 0; i < n; i++) { pvx[i] *= k; pvy[i] *= k; } };      // средняя энергия строго соответствует температуре
    const setN = (m) => { for (let i = n; i < m; i++) spawn(i); n = m; };
    const setup = (cv, w, h, cap) => {
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(cap / ((cssW * h) / SW * (cssW * w) / SW)))), pw = Math.round(((cssW * w) / SW) * dpr), ph = Math.round(((cssW * h) / SW) * dpr);
      cv.width = pw; cv.height = ph; const g = cv.getContext('2d'); g.setTransform(pw / w, 0, 0, ph / h, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round'; return g;
    };
    const paintBg = () => {
      const c = setup(bg, SW, SH, 1.3e6); c.clearRect(0, 0, SW, SH);
      c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(X0, YT, xw - X0, HB);
      c.strokeStyle = '#2a3140'; c.lineWidth = 4; c.beginPath(); c.moveTo(X0 + WMAX + 24, YT - 2); c.lineTo(X0, YT - 2); c.lineTo(X0, YB + 2); c.lineTo(X0 + WMAX + 24, YB + 2); c.stroke();
      // поршень: пластина и шток
      rr(c, xw, YT - 4, 14, HB + 8, 4); c.fillStyle = '#7d8fab'; c.fill(); c.strokeStyle = '#2a3140'; c.lineWidth = 2.4; c.stroke();
      c.strokeStyle = '#2a3140'; c.lineWidth = 6; c.beginPath(); c.moveTo(xw + 14, (YT + YB) / 2); c.lineTo(xw + 14 + 40, (YT + YB) / 2); c.stroke(); rr(c, xw + 54, (YT + YB) / 2 - 20, 12, 40, 4); c.fillStyle = '#4a5365'; c.fill();
      // шкала объёма
      c.strokeStyle = '#6b7a90'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(X0, YB + 22); c.lineTo(xw, YB + 22); c.moveTo(X0, YB + 16); c.lineTo(X0, YB + 28); c.moveTo(xw, YB + 16); c.lineTo(xw, YB + 28); c.stroke();
      tex(c, `V = ${fmt(P.V, 0)} %`, (X0 + xw) / 2, YB + 44, { size: 16, align: 'center', color: '#3b475c' });
      tex(c, `T = ${fmt(P.T, 0)} К`, X0, 52, { size: 18, color: '#c2410c' }); tex(c, `N = ${P.N}`, X0 + 130, 52, { size: 18, color: '#1d3f9c' });
    };
    const layout = () => { f = (box.clientWidth || SW) / SW; gc = setup(gas, WMAX + 20, HB, 1.0e6); gk = gas.width / (WMAX + 20); gas.style.cssText = `position:absolute;z-index:3;pointer-events:none;left:${((X0 - 2) / SW) * 100}%;top:${(YT / SH) * 100}%;width:${((WMAX + 20) / SW) * 100}%;height:${(HB / SH) * 100}%;display:block`; };
    const draw = () => {
      const c = gc; c.clearRect(0, 0, WMAX + 20, HB); const sc = 1 / (d.vr * 1.9);
      for (let i = 0; i < n; i++) {
        const sp = Math.hypot(pvx[i], pvy[i]) * sc, u = clamp(sp, 0, 1);
        c.fillStyle = colOn ? `rgb(${Math.round(60 + 190 * u)},${Math.round(130 - 70 * u)},${Math.round(235 - 190 * u)})` : '#2f62c9';
        c.beginPath(); c.arc(px[i] - X0 + 2, py[i] - YT, R, 0, 7); c.fill();
      }
    };
    const ui = (ts) => { if (ts - lastUi < 250) return; lastUi = ts; const a = document.getElementById('sm-mkt-rate'), b = document.getElementById('sm-mkt-pm'); if (a) a.textContent = `${Math.round(rate)} в секунду`; if (b) b.textContent = fmt(pm, 2); };
    const api = {
      resize() { layout(); paintBg(); draw(); },
      params(p, dd) {
        d = dd; if (p.T !== lastT) { const k = Math.sqrt(p.T / lastT); for (let i = 0; i < n; i++) { pvx[i] *= k; pvy[i] *= k; } lastT = p.T; }
        P = p; setN(p.N); n = p.N; norm(); tgt = X0 + WMAX * (p.V / 100); repaint = true; paintBg(); imp = 0; win = 0; hits = 0;
      },
      update(dd, flags, t) {
        d = dd; colOn = !!flags.col; const now = performance.now(); const dt = lastTime === null ? 0 : clamp((t - lastTime), 0, 0.04); lastTime = t;
        if (Math.abs(tgt - xw) > 0.3) { xw += (tgt - xw) * Math.min(1, dt * 7); if (Math.abs(tgt - xw) <= 0.3) xw = tgt; paintBg(); for (let i = 0; i < n; i++) if (px[i] > xw - R) px[i] = xw - R; }
        for (let i = 0; i < n; i++) {
          let x = px[i] + pvx[i] * dt, y = py[i] + pvy[i] * dt;
          if (x < X0 + R) { x = X0 + R; imp += 2 * Math.abs(pvx[i]); pvx[i] = Math.abs(pvx[i]); } else if (x > xw - R) { x = xw - R; imp += 2 * Math.abs(pvx[i]); hits++; pvx[i] = -Math.abs(pvx[i]); }
          if (y < YT + R) { y = YT + R; imp += 2 * Math.abs(pvy[i]); pvy[i] = Math.abs(pvy[i]); } else if (y > YB - R) { y = YB - R; imp += 2 * Math.abs(pvy[i]); pvy[i] = -Math.abs(pvy[i]); }
          px[i] = x; py[i] = y;
        }
        win += dt; if (win >= 2) { const pi = imp / (win * 2 * ((xw - X0 - 2 * R) + (HB - 2 * R))) / REF; pm = pm * 0.45 + pi * 0.55; rate = hits / win; imp = 0; win = 0; hits = 0; }      // давление считаем по всем четырём стенкам: так точнее
        draw(); ui(now);
      },
      busy: () => false,
      animate() {},
    };
    layout(); setN(P0.N); norm(); return api;
  },
};
