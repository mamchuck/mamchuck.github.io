// Сцена «Закон Ома и электрические цепи»: источник, один или два резистора (последовательно / параллельно), амперметр.
// Точки на проводах — заряды: они текут от «+» к «−» (так принято направление тока), скорость пропорциональна силе тока на этом участке.
// Всё считается точно: R общее → I = ε/(R + r) → напряжение на зажимах U = ε − I·r → токи и напряжения на резисторах; нагрев резистора показан цветом.
import { fmt, tex, math as mathHtml, rr } from './tex.js?v=202611071251';

const el = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };
const SW = 520, SH = 400, BX = 56, YP = 185, YM = 215, RW = 88, RH = 30, XR = 460, YT = 70, YB = 330;
const INK = '#2a3140', COL = { I: '#e8590c', U: '#2563eb', R: '#1f9d55' };
const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Число без лишних нулей: 4,50 → 4,5; 10,00 → 10
const nz = (v, d = 2) => { const s = fmt(v, d); return s.includes(',') ? s.replace(/0+$/, '').replace(/,$/, '') : s; };
const NAMES = ['', 'Один резистор', 'Последовательное соединение', 'Параллельное соединение'];

// Схемы: провода (ломаные), резисторы, ветки для движения зарядов (key — какой ток течёт в ветке), место амперметра
const loop = [[BX, YP], [BX, YT], [XR, YT], [XR, YB], [BX, YB], [BX, YM]];
const LAYOUT = {
  1: { wires: [loop], res: [{ n: 1, x: 260, y: YT }], br: [{ key: 'I', pts: loop }], nodes: [] },
  2: { wires: [loop], res: [{ n: 1, x: 190, y: YT }, { n: 2, x: 340, y: YT }], br: [{ key: 'I', pts: loop }], nodes: [] },
  3: {
    wires: [[[BX, YP], [BX, 162], [130, 162]], [[130, 95], [130, 230]], [[430, 95], [430, 230]], [[130, 95], [430, 95]], [[130, 230], [430, 230]], [[430, 162], [480, 162], [480, YB], [BX, YB], [BX, YM]]],
    res: [{ n: 1, x: 280, y: 95 }, { n: 2, x: 280, y: 230 }],
    br: [{ key: 'I', pts: [[BX, YP], [BX, 162], [130, 162]] }, { key: 'I1', pts: [[130, 162], [130, 95], [430, 95], [430, 162]] }, { key: 'I2', pts: [[130, 162], [130, 230], [430, 230], [430, 162]] }, { key: 'I', pts: [[430, 162], [480, 162], [480, YB], [BX, YB], [BX, YM]] }],
    nodes: [[130, 162], [430, 162]],
  },
};
const AMM = { x: 270, y: YB };

export const circuit = {
  id: 'circuit',
  mode: 'free',
  title: 'Закон Ома и электрические цепи',
  lead: 'Собери цепь и смотри, как ток и напряжение делятся между резисторами. Точки — заряды: чем больше ток, тем быстрее они бегут. Резистор, на котором выделяется больше мощности, краснеет сильнее.',
  stage: { w: SW, h: SH, label: 'Электрическая цепь: источник, резисторы, амперметр' },
  get animated() { return !reduce; },
  params: [
    { id: 'top', name: 'Схема', tex: '', unit: '', dec: 0, def: 2, options: [{ label: 'Один резистор', v: 1 }, { label: 'Последовательно', v: 2 }, { label: 'Параллельно', v: 3 }], fmt: (v) => ['', '1 резистор', 'последовательно', 'параллельно'][v] },
    { id: 'E', name: 'ЭДС источника', tex: '\\varepsilon', unit: 'В', min: 1, max: 24, step: 1, def: 12, dec: 0 },
    { id: 'r', name: 'Внутреннее сопротивление', tex: 'r', unit: 'Ом', min: 0, max: 5, step: 0.5, def: 0, dec: 1 },
    { id: 'R1', name: 'Первый резистор', tex: 'R_1', unit: 'Ом', min: 1, max: 50, step: 1, def: 10, dec: 0 },
    { id: 'R2', name: 'Второй резистор', tex: 'R_2', unit: 'Ом', min: 1, max: 50, step: 1, def: 20, dec: 0 },
  ],
  toggles: [{ id: 'dots', name: 'Заряды', color: '#e8590c', on: true }, { id: 'vals', name: 'Показания', color: '#2563eb', on: true }],
  actions: [
    { id: 'eq', group: 'Примеры', label: 'Одинаковые R', color: '#2563eb' },
    { id: 'dbl', group: 'Примеры', label: 'R₂ = 2R₁', color: '#1f9d55' },
    { id: 'real', group: 'Примеры', label: 'Реальный источник', color: '#e8590c' },
    { id: 'short', group: 'Примеры', label: 'Почти замыкание', color: '#d6336c' },
  ],
  act(id) {
    const sets = { eq: { R1: 10, R2: 10 }, dbl: { R1: 10, R2: 20 }, real: { r: 2, E: 12, R1: 10, R2: 10, top: 1 }, short: { top: 3, R1: 1, R2: 1, r: 2, E: 12 } };
    return { set: sets[id] };
  },
  derive(p) {
    const t = p.top, R1 = p.R1, R2 = p.R2, r = p.r, E = p.E;
    const R = t === 1 ? R1 : t === 2 ? R1 + R2 : (R1 * R2) / (R1 + R2);
    const I = E / (R + r), U = E - I * r;
    let U1, I1, U2 = 0, I2 = 0;
    if (t === 1) { U1 = U; I1 = I; } else if (t === 2) { I1 = I2 = I; U1 = I * R1; U2 = I * R2; } else { U1 = U2 = U; I1 = U / R1; I2 = U / R2; }
    return { t, R, I, U, U1, I1, U2, I2, P1: U1 * I1, P2: U2 * I2, P: U * I, Pr: I * I * r, Pe: E * I, eta: U / E, R1, R2, r, E };
  },
  readouts: (p, d) => [['Общее сопротивление', 'R', `${nz(d.R)} Ом`], ['Сила тока в источнике', 'I', `${nz(d.I, d.I < 0.1 ? 3 : 2)} А`], ['Напряжение на зажимах', 'U', `${nz(d.U)} В`],
    ['Мощность во внешней цепи', 'P', `${nz(d.P)} Вт`], ['КПД источника', '\\eta = U/\\varepsilon', `${fmt(d.eta * 100, 0)} %`]],
  formulas: [
    { tag: 'Закон Ома для участка', color: '#e8590c', tex: 'I = \\dfrac{U}{R}' },
    { tag: 'Последовательно', color: '#2563eb', tex: '\\begin{gathered} I = I_1 = I_2 \\\\ U = U_1 + U_2 \\\\ R = R_1 + R_2 \\end{gathered}' },
    { tag: 'Параллельно', color: '#1f9d55', tex: '\\begin{gathered} U = U_1 = U_2 \\\\ I = I_1 + I_2 \\\\ \\dfrac{1}{R} = \\dfrac{1}{R_1} + \\dfrac{1}{R_2} \\end{gathered}' },
    { tag: 'Полная цепь', color: '#7048e8', tex: 'I = \\dfrac{\\varepsilon}{R + r},\\quad U = \\varepsilon - Ir' },
    { tag: 'Мощность', color: '#d6336c', tex: 'P = UI = I^2R = \\dfrac{U^2}{R}' },
  ],
  note: 'При параллельном соединении общее сопротивление всегда меньше меньшего из резисторов, при последовательном — больше большего. Если r > 0, напряжение на зажимах меньше ЭДС на Ir.',
  info(p, d) {
    const A = (v) => nz(v, v < 0.1 ? 3 : 2), rules = { 1: ['I = \\dfrac{U}{R}'], 2: ['I = I_1 = I_2', 'U = U_1 + U_2', 'R = R_1 + R_2'], 3: ['U = U_1 = U_2', 'I = I_1 + I_2', '\\dfrac{1}{R} = \\dfrac{1}{R_1} + \\dfrac{1}{R_2}'] }[d.t];
    const row = (n, R, I, U, P) => `<tr><td>${mathHtml('R_' + n)}</td><td>${nz(R)}</td><td>${A(I)}</td><td>${nz(U)}</td><td>${nz(P)}</td></tr>`;
    return `<div class="sm-big" style="font-size:24px">${NAMES[d.t]}</div>
      <div><span class="sm-chip">${d.t === 2 ? 'ток один, напряжения складываются' : d.t === 3 ? 'напряжение одно, токи складываются' : 'один резистор'}</span></div>
      <table class="sm-it sm-it4"><tr><th></th><th>R, Ом</th><th>I, А</th><th>U, В</th><th>P, Вт</th></tr>
        ${row(1, d.R1, d.I1, d.U1, d.P1)}${d.t === 1 ? '' : row(2, d.R2, d.I2, d.U2, d.P2)}
        <tr class="sm-itt"><td>Всего</td><td>${nz(d.R)}</td><td>${A(d.I)}</td><td>${nz(d.U)}</td><td>${nz(d.P)}</td></tr></table>
      <h4 style="margin-top:12px">Правила</h4>
      ${rules.map((x) => `<div class="sm-eq">${mathHtml(x)}</div>`).join('')}
      ${d.r > 0 ? `<div class="sm-eq"><b>Источник</b>: ${mathHtml(`\\varepsilon = ${p.E}\\text{ В}`)}, на внутреннем сопротивлении теряется ${mathHtml('Ir = ')} ${nz(d.I * d.r)} В и ${nz(d.Pr)} Вт<small>КПД = U/ε = ${fmt(d.eta * 100, 0)} %</small></div>` : ''}`;
  },

  mount(box) {
    const bg = document.createElement('canvas'), fg = document.createElement('canvas'), dotsEl = el('sm-edots');
    bg.className = 'sm-sbg'; fg.className = 'sm-sbg'; fg.style.zIndex = '3'; fg.style.pointerEvents = 'none'; bg.setAttribute('aria-hidden', 'true'); fg.setAttribute('aria-hidden', 'true');
    box.prepend(bg); box.append(dotsEl, fg);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label);
    let P = null, d = null, f = 1, built = '', branches = [], lastT = null, lastVals = null, lastDots = null;
    const full = (cv) => {
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.4e6 / (cssW * ((cssW * SH) / SW)))));
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(((cssW * SH) / SW) * dpr);
      const g = cv.getContext('2d'); g.setTransform(cv.width / SW, 0, 0, cv.height / SH, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round'; return g;
    };
    const poly = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
    const L = LAYOUT; let lay;

    const paintBg = () => {                                                                       // провода и источник
      const c = full(bg); c.clearRect(0, 0, SW, SH);
      c.strokeStyle = INK; c.lineWidth = 3.2; for (const w of lay.wires) poly(c, w);
      c.fillStyle = INK; for (const [x, y] of lay.nodes) { c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); }
      c.lineWidth = 3.4; poly(c, [[BX - 24, YP], [BX + 24, YP]]); c.lineWidth = 6; poly(c, [[BX - 12, YM], [BX + 12, YM]]);        // длинная пластина «+», короткая и толстая «−»
      tex(c, '+', BX + 38, YP + 4, { size: 20, color: '#c2410c' }); tex(c, '−', BX + 38, YM + 6, { size: 20, color: '#2563eb' });
    };
    const resistor = (c, r, Pw, vals) => {
      const R = r.n === 1 ? d.R1 : d.R2, I = r.n === 1 ? d.I1 : d.I2, U = r.n === 1 ? d.U1 : d.U2, heat = Math.min(0.9, 0.08 + 0.95 * Math.sqrt(Pw / 70));
      rr(c, r.x - RW / 2, r.y - RH / 2, RW, RH, 6); c.fillStyle = '#fff'; c.fill(); c.fillStyle = `rgba(255,112,40,${heat.toFixed(3)})`; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.6; c.stroke();
      tex(c, `R_${r.n} = ${nz(R)} Ом`, r.x, r.y - RH / 2 - 9, { size: 17, align: 'center', color: COL.R });
      if (vals) { tex(c, `I_${r.n} = ${nz(I, I < 0.1 ? 3 : 2)} А`, r.x, r.y + RH / 2 + 19, { size: 16, align: 'center', color: COL.I }); tex(c, `U_${r.n} = ${nz(U)} В`, r.x, r.y + RH / 2 + 38, { size: 16, align: 'center', color: COL.U }); }
    };
    const paintFg = (vals) => {                                                                   // детали поверх зарядов: резисторы, амперметр, подписи
      const c = full(fg); c.clearRect(0, 0, SW, SH);
      for (const r of lay.res) resistor(c, r, r.n === 1 ? d.P1 : d.P2, vals);
      if (d.r > 0) { rr(c, BX - 9, 252, 18, 40, 4); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.4; c.stroke(); tex(c, 'r', BX + 17, 276, { size: 15, color: '#6b7a90' }); }
      c.beginPath(); c.arc(AMM.x, AMM.y, 17, 0, 7); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.6; c.stroke();
      tex(c, 'A', AMM.x, AMM.y + 7, { size: 20, align: 'center' });
      if (vals) tex(c, `I = ${nz(d.I, d.I < 0.1 ? 3 : 2)} А`, AMM.x, AMM.y + 42, { size: 16, align: 'center', color: COL.I });
      tex(c, `ε = ${P.E} В${d.r > 0 ? `, r = ${nz(d.r, 1)} Ом` : ''}`, 14, 374, { size: 16, color: '#3b475c' });
    };
    const build = () => {                                                                         // заряды: по несколько штук на каждой ветке
      dotsEl.replaceChildren(); branches = [];
      for (const b of lay.br) {
        const seg = []; let len = 0;
        for (let i = 1; i < b.pts.length; i++) { const [x0, y0] = b.pts[i - 1], [x1, y1] = b.pts[i], l = Math.hypot(x1 - x0, y1 - y0); seg.push({ x0, y0, x1, y1, l, s0: len }); len += l; }
        const n = Math.max(2, Math.round(len / 26)), dots = [];
        for (let i = 0; i < n; i++) { const e = el('sm-edot'); dotsEl.append(e); dots.push(e); }
        branches.push({ key: b.key, seg, len, n, dots, off: 0 });
      }
      dotsEl.style.setProperty('--ds', `${Math.max(7, 9 * f)}px`);
    };
    const place = (b) => {
      for (let i = 0; i < b.n; i++) {
        const s = (((b.off + (i * b.len) / b.n) % b.len) + b.len) % b.len;
        let k = 0; while (k < b.seg.length - 1 && s > b.seg[k].s0 + b.seg[k].l) k++;
        const g = b.seg[k], u = (s - g.s0) / g.l, x = (g.x0 + (g.x1 - g.x0) * u) * f, y = (g.y0 + (g.y1 - g.y0) * u) * f;
        b.dots[i].style.transform = `translate3d(${x}px,${y}px,0)`;
      }
    };
    const paint = (vals = lastVals ?? true) => {
      lay = L[d.t]; f = (box.clientWidth || SW) / SW;
      const key = `${d.t}:${f.toFixed(3)}`; paintBg(); paintFg(vals); lastVals = vals;
      if (key !== built) { built = key; build(); }
      branches.forEach(place);
    };
    return {
      resize() { built = ''; if (d) paint(); },
      params(p, dd) { P = p; d = dd; paint(); },
      update(dd, flags, t) {
        d = dd; if (!P) return;
        const dt = lastT === null ? 0 : Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
        if (!!flags.vals !== lastVals) paint(!!flags.vals);
        if (flags.dots !== lastDots) { lastDots = flags.dots; dotsEl.style.visibility = flags.dots ? 'visible' : 'hidden'; }
        if (!flags.dots || reduce) return;
        for (const b of branches) { const I = d[b.key]; b.off += Math.min(320, 26 + 72 * Math.sqrt(I)) * dt; place(b); }
      },
    };
  },
};
