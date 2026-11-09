// Сцена «Приборы и измерения» (задание №15 ОГЭ): линейка, мензурка, термометр, динамометр, вольтметр, амперметр.
// Случайная шкала: определи цену деления и считай показание. Шаги подсказки открываются по одному: цена деления c = (b − a)/n, показание, запись x = (x̄ ± c/2).
import { fmt, tex, rr, arrow, math as mathHtml } from './tex.js?v=202611091412';

const SW = 520, SH = 400, INK = '#2a3140';
const DEV = {
  1: { name: 'Линейка', unit: 'см', kind: 'ruler', sets: [{ lo: 0, hi: 12, step: 1, n: 10 }, { lo: 0, hi: 12, step: 1, n: 5 }, { lo: 0, hi: 10, step: 1, n: 2 }] },
  2: { name: 'Мензурка', unit: 'мл', kind: 'beaker', sets: [{ lo: 0, hi: 100, step: 20, n: 4 }, { lo: 0, hi: 200, step: 50, n: 5 }, { lo: 0, hi: 50, step: 10, n: 5 }, { lo: 0, hi: 250, step: 50, n: 5 }] },
  3: { name: 'Термометр', unit: '°C', kind: 'thermo', sets: [{ lo: -10, hi: 50, step: 10, n: 5 }, { lo: 0, hi: 100, step: 10, n: 10 }, { lo: -20, hi: 40, step: 10, n: 10 }] },
  4: { name: 'Динамометр', unit: 'Н', kind: 'spring', sets: [{ lo: 0, hi: 5, step: 1, n: 5 }, { lo: 0, hi: 10, step: 2, n: 4 }, { lo: 0, hi: 3, step: 1, n: 10 }] },
  5: { name: 'Вольтметр', unit: 'В', kind: 'dial', letter: 'V', sets: [{ lo: 0, hi: 6, step: 1, n: 5 }, { lo: 0, hi: 3, step: 1, n: 10 }, { lo: 0, hi: 15, step: 5, n: 5 }] },
  6: { name: 'Амперметр', unit: 'А', kind: 'dial', letter: 'A', sets: [{ lo: 0, hi: 2, step: 0.5, n: 5 }, { lo: 0, hi: 1, step: 0.2, n: 4 }, { lo: 0, hi: 3, step: 1, n: 10 }] },
};
// Число без лишних нулей: 0,20 → 0,2; 5,00 → 5
const nz = (v) => { const s = fmt(Math.round(v * 1e6) / 1e6, 3); return s.includes(',') ? s.replace(/0+$/, '').replace(/,$/, '') : s; };
const rng = (seed) => { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
let lastDev = null;

export const instruments = {
  id: 'instruments',
  mode: 'free',
  title: 'Приборы и измерения',
  lead: 'Задание №15 ОГЭ: определи цену деления шкалы и считай показание прибора. Нажимай «Следующий шаг» — подсказки открываются по одной. Когда справишься, бери «Новое задание».',
  stage: { w: SW, h: SH, label: 'Шкала измерительного прибора' },
  params: [{ id: 'dev', name: 'Прибор', tex: '', unit: '', dec: 0, def: 1, options: Object.entries(DEV).map(([v, o]) => ({ label: o.name, v: +v })), fmt: (v) => DEV[v].name }],
  actions: [
    { id: 'step', group: 'Задание', label: 'Следующий шаг', color: '#2563eb' },
    { id: 'all', group: 'Задание', label: 'Показать ответ', color: '#e8590c' },
    { id: 'new', group: 'Задание', label: 'Новое задание', color: '#1f9d55' },
  ],
  act(id, p) {
    const show = p.show ?? 0;
    if (id === 'step') return { set: { show: Math.min(3, show + 1) } };
    if (id === 'all') return { set: { show: 3 } };
    return { set: { seed: 1 + Math.floor(Math.random() * 1e6), show: 0 } };
  },
  derive(p) {
    if (lastDev !== p.dev) { lastDev = p.dev; p.seed = 1 + Math.floor(Math.random() * 1e6); p.show = 0; }                   // сменили прибор — новое задание
    const dv = DEV[p.dev], r = rng(p.seed ?? 7), s = dv.sets[Math.floor(r() * dv.sets.length)], c = s.step / s.n, N = Math.round((s.hi - s.lo) / c);
    let idx = Math.round(N * (0.12 + 0.8 * r())); for (let k = 0; k < 6 && idx % s.n === 0; k++) idx = Math.round(N * (0.12 + 0.8 * r()));      // показание не на подписанном штрихе
    idx = Math.max(1, Math.min(N - 1, idx));
    const a = s.lo + Math.floor(idx / s.n) * s.step, v = Math.round((s.lo + idx * c) * 1e6) / 1e6;
    return { dv, s, c, N, idx, v, a, b: a + s.step, show: p.show ?? 0, err: c / 2 };
  },
  readouts: (p, d) => [['Цена деления', 'c', d.show >= 1 ? `${nz(d.c)} ${d.dv.unit}` : '?'], ['Показание', 'x', d.show >= 2 ? `${nz(d.v)} ${d.dv.unit}` : '?'],
    ['Погрешность', '\\Delta x = c/2', d.show >= 3 ? `${nz(d.err)} ${d.dv.unit}` : '?']],
  formulas: [
    { tag: 'Цена деления', color: '#2563eb', tex: 'c = \\dfrac{b - a}{n}' },
    { tag: 'Погрешность прямого измерения', color: '#e8590c', tex: '\\Delta x = \\dfrac{c}{2}' },
    { tag: 'Запись результата', color: '#1f9d55', tex: 'x = (\\bar x \\pm \\Delta x)\\ \\text{ед.}' },
  ],
  note: 'Цена деления — это значение одного деления шкалы. Число делений n считают между двумя подписанными соседними штрихами (промежутков, а не штрихов). Показание — число делений от нуля, умноженное на цену деления.',
  info(p, d) {
    const u = d.dv.unit, row = (k, t, val) => `<tr><td>${t}</td><td>${d.show >= k ? val : '<span style="color:var(--sm-text2)">?</span>'}</td></tr>`;
    const hint = [
      'Найди два соседних подписанных штриха и посчитай, на сколько делений они разбиты.',
      `Между ${nz(d.a)} и ${nz(d.b)} ${u} — ${d.s.n} делений: c = (${nz(d.b)} − ${nz(d.a)})/${d.s.n} = ${nz(d.c)} ${u}.`,
      `Показание: ${d.idx} делений от нуля, умноженные на цену деления: ${d.idx} · ${nz(d.c)} = ${nz(d.v)} ${u}.`,
      `Погрешность равна половине цены деления: ${nz(d.c)}/2 = ${nz(d.err)} ${u}. Запись: x = (${nz(d.v)} ± ${nz(d.err)}) ${u}.`,
    ][d.show];
    return `<div class="sm-big" style="font-size:26px">${d.dv.name}</div>
      <div><span class="sm-chip">шаг ${d.show} из 3</span></div>
      <table class="sm-it"><tr><td>Цена деления c</td><td>${d.show >= 1 ? `${nz(d.c)} ${u}` : '<span style="color:var(--sm-text2)">?</span>'}</td></tr>
        ${row(2, 'Показание x', `${nz(d.v)} ${u}`)}${row(3, 'Запись', `(${nz(d.v)} ± ${nz(d.err)}) ${u}`)}</table>
      <div class="sm-eq">${hint}<small>${d.show === 0 ? 'Сначала подумай сам, потом открывай шаг.' : d.show < 3 ? 'Дальше — «Следующий шаг».' : 'Теперь бери «Новое задание».'}</small></div>`;
  },

  mount(box) {
    const bg = document.createElement('canvas'); bg.className = 'sm-sbg'; box.prepend(bg);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label); bg.setAttribute('aria-hidden', 'true');
    let d = null;
    const full = () => {
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.4e6 / (cssW * ((cssW * SH) / SW)))));
      bg.width = Math.round(cssW * dpr); bg.height = Math.round(((cssW * SH) / SW) * dpr);
      const g = bg.getContext('2d'); g.setTransform(bg.width / SW, 0, 0, bg.height / SH, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round'; return g;
    };
    // Шкала по геометрии прибора: pos(v) — точка на линии шкалы, t — направление штрихов от неё, lab — где поставить цифру
    const geo = () => {
      const { s, dv } = d, span = s.hi - s.lo, u = (v) => (v - s.lo) / span;
      switch (dv.kind) {
        case 'ruler': return { pos: (v) => [40 + u(v) * 440, 168], t: [0, 1], tl: [16, 11, 7], lab: (x, y, len) => [x, y + len + 17, 'center'] };
        case 'beaker': return { pos: (v) => [262, 340 - u(v) * 250], t: [-1, 0], tl: [26, 17, 11], lab: (x, y) => [x + 10, y + 5, 'left'] };
        case 'thermo': return { pos: (v) => [262, 330 - u(v) * 250], t: [1, 0], tl: [26, 17, 11], lab: (x, y, len) => [x + len + 8, y + 5, 'left'] };
        case 'spring': return { pos: (v) => [196, 100 + u(v) * 210], t: [-1, 0], tl: [24, 16, 10], lab: (x, y, len) => [x - len - 8, y + 5, 'right'] };
        default: { const th = (v) => ((-52 + u(v) * 104) * Math.PI) / 180; return { dial: true, th, pos: (v) => [260 + 188 * Math.sin(th(v)), 360 - 188 * Math.cos(th(v))], tl: [18, 12, 8] }; }
      }
    };
    const paint = () => {
      const c = full(); c.clearRect(0, 0, SW, SH); if (!d) return;
      const { s, dv, c: cd, N } = d, g = geo(), K = dv.kind;
      // корпус и содержимое
      if (K === 'ruler') {
        rr(c, 24, 150, 472, 62, 10); c.fillStyle = '#f7e9b6'; c.fill(); c.strokeStyle = '#a58a33'; c.lineWidth = 2; c.stroke();
        const x = g.pos(d.v)[0]; rr(c, 40, 82, x - 40, 40, 6); c.fillStyle = '#ff9a55'; c.fill(); c.strokeStyle = '#a63b00'; c.lineWidth = 2; c.stroke(); if (x - 40 > 76) tex(c, 'карандаш', (40 + x) / 2, 108, { size: 15, align: 'center', color: '#fff' });
        c.strokeStyle = 'rgba(40,40,40,.5)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, 124); c.lineTo(x, 150); c.stroke();
      } else if (K === 'beaker') {
        const Y0 = 340, Hh = 250, y = Y0 - ((d.v - s.lo) / (s.hi - s.lo)) * Hh;
        c.beginPath(); c.moveTo(190, 70); c.lineTo(190, Y0 + 10); c.quadraticCurveTo(190, Y0 + 22, 205, Y0 + 22); c.lineTo(247, Y0 + 22); c.quadraticCurveTo(262, Y0 + 22, 262, Y0 + 10); c.lineTo(262, 70);
        c.save(); c.lineTo(190, 70); c.clip(); c.fillStyle = 'rgba(80,160,255,.55)'; c.fillRect(190, y, 72, Y0 + 24 - y); c.fillStyle = 'rgba(255,255,255,.65)'; c.fillRect(190, y - 2, 72, 3); c.restore();
        c.strokeStyle = '#7d8fab'; c.lineWidth = 3; c.stroke(); tex(c, 'мл', 292, 342 - 250 - 14, { size: 16, color: '#3b475c' });
      } else if (K === 'thermo') {
        rr(c, 248, 62, 14, 280, 7); c.fillStyle = 'rgba(255,255,255,.8)'; c.fill(); c.strokeStyle = '#7d8fab'; c.lineWidth = 2.4; c.stroke();
        const y = g.pos(d.v)[1]; c.fillStyle = '#e03131'; c.fillRect(252, y, 6, 336 - y); c.beginPath(); c.arc(255, 350, 17, 0, 7); c.fill(); c.strokeStyle = '#a61e1e'; c.lineWidth = 2; c.stroke();
        tex(c, '°C', 262 + 70, 56, { size: 17, color: '#3b475c' });
      } else if (K === 'spring') {
        const y = g.pos(d.v)[1]; rr(c, 196, 84, 56, 244, 8); c.fillStyle = '#eef2f8'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.4; c.stroke();
        c.beginPath(); c.arc(224, 66, 14, 0, 7); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
        c.fillStyle = '#c5ccd8'; c.fillRect(220, 94, 8, 224);
        c.strokeStyle = '#e03131'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(208, y); c.lineTo(240, y); c.stroke();
        c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(224, 328); c.lineTo(224, 352); c.stroke(); c.beginPath(); c.arc(224, 362, 10, Math.PI * 1.1, Math.PI * 2.4); c.stroke();
        tex(c, 'Н', 292, 70, { size: 17, color: '#3b475c' });
      } else {
        rr(c, 70, 110, 380, 270, 26); c.fillStyle = '#f4f6fa'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.6; c.stroke();
        tex(c, dv.letter === 'V' ? 'V' : 'A', 260, 262, { size: 40, align: 'center' });
        const [px, py] = [260, 360], th = g.th(d.v), L = 176;
        c.strokeStyle = '#e03131'; c.lineWidth = 3; c.beginPath(); c.moveTo(px, py); c.lineTo(px + L * Math.sin(th), py - L * Math.cos(th)); c.stroke();
        c.fillStyle = INK; c.beginPath(); c.arc(px, py, 9, 0, 7); c.fill();
      }
      // штрихи и цифры шкалы
      c.strokeStyle = INK; c.fillStyle = INK;
      const font = { size: g.dial ? 17 : 15, color: '#1b2330' };
      for (let i = 0; i <= N; i++) {
        const v = s.lo + i * cd, major = i % s.n === 0, half = !major && s.n % 2 === 0 && i % s.n === s.n / 2, len = g.tl[major ? 0 : half ? 1 : 2], [x, y] = g.pos(v);
        c.lineWidth = major ? 2 : 1.3; c.beginPath();
        if (g.dial) { const th = g.th(v); c.moveTo(x, y); c.lineTo(x - len * Math.sin(th), y + len * Math.cos(th)); } else { c.moveTo(x, y); c.lineTo(x + g.t[0] * len, y + g.t[1] * len); }
        c.stroke();
        if (major) {
          if (g.dial) { const th = g.th(v); tex(c, nz(v), x - 40 * Math.sin(th), y + 40 * Math.cos(th) + 5, { ...font, align: 'center' }); }
          else { const [lx, ly, al] = g.lab(x, y, g.tl[0]); tex(c, nz(v), lx, ly, { ...font, align: al }); }
        }
      }
      c.lineWidth = 1.8; c.beginPath();
      if (g.dial) c.arc(260, 360, 188, (-90 - 52) * Math.PI / 180, (-90 + 52) * Math.PI / 180); else { const [x0, y0] = g.pos(s.lo), [x1, y1] = g.pos(s.hi); c.moveTo(x0, y0); c.lineTo(x1, y1); }
      c.stroke();
      // подсказки по шагам
      if (d.show >= 1) {                                                       // два соседних подписанных штриха и число делений между ними
        const [xa, ya] = g.pos(d.a), [xb, yb] = g.pos(d.b), col = '#2563eb'; c.strokeStyle = col; c.lineWidth = 3;
        const br = (x1, y1, x2, y2, tx, ty, al) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); tex(c, `${d.s.n} дел.`, tx, ty, { size: 16, align: al, color: col }); };
        if (g.dial) { const a0 = g.th(d.a) - Math.PI / 2, a1 = g.th(d.b) - Math.PI / 2, th = (g.th(d.a) + g.th(d.b)) / 2; c.beginPath(); c.arc(260, 360, 214, a0, a1); c.stroke(); tex(c, `${d.s.n} дел.`, 260 + 238 * Math.sin(th), 360 - 238 * Math.cos(th), { size: 16, align: 'center', color: col }); }
        else if (K === 'ruler') br(xa, 224, xb, 224, (xa + xb) / 2, 246, 'center');
        else if (K === 'spring') br(130, ya, 130, yb, 120, (ya + yb) / 2 + 5, 'right');
        else br(K === 'beaker' ? 322 : 340, ya, K === 'beaker' ? 322 : 340, yb, K === 'beaker' ? 332 : 350, (ya + yb) / 2 + 5, 'left');
      }
      if (d.show >= 2) {
        const [x, y] = g.pos(d.v), col = '#e8590c', txt = `${nz(d.v)} ${dv.unit}`; c.strokeStyle = col; c.lineWidth = 1.8; c.setLineDash([5, 4]);
        if (g.dial) tex(c, txt, 260, 300, { size: 22, align: 'center', color: col });
        else if (K === 'ruler') { c.beginPath(); c.moveTo(x, 124); c.lineTo(x, 216); c.stroke(); tex(c, txt, x, 278, { size: 21, align: 'center', color: col }); }
        else if (K === 'spring') { c.beginPath(); c.moveTo(252, y); c.lineTo(400, y); c.stroke(); tex(c, txt, 410, y + 7, { size: 21, align: 'left', color: col }); }
        else { const x1 = K === 'beaker' ? 190 : 248; c.beginPath(); c.moveTo(x1 - 62, y); c.lineTo(x1, y); c.stroke(); tex(c, txt, x1 - 70, y + 7, { size: 21, align: 'right', color: col }); }
        c.setLineDash([]);
      }
    };
    return { resize() {}, params(p, dd) { d = dd; paint(); }, update() {} };
  },
};
