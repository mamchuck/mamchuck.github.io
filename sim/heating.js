// Сцена «Нагревание и плавление»: нагреватель постоянной мощности P греёт лёд (или воду) в стакане до кипения и дальше.
// Модель без потерь: Q = P·t. Этапы: нагрев льда (Q = c_л·m·Δt) → плавление при 0 °C (Q = λ·m) → нагрев воды (Q = c_в·m·Δt) → кипение при 100 °C (Q = L·m) → нагрев пара.
// На графике t(время) наклонные участки — нагревание, площадки — плавление и кипение: теплота идёт на изменение связей между молекулами, а средняя кинетическая энергия не растёт.
import { fmt, tex, rr, sprite } from './tex.js?v=202611010231';

const el = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };
export const COLH = { T: '#e8590c', ice: '#339af0', water: '#1864ab', steam: '#868e96', Q: '#7048e8' };
// Вода: удельные теплоёмкости льда, воды, пара [Дж/(кг·°C)], теплоты плавления и парообразования [Дж/кг], температуры [°C]
const M = { ci: 2100, cw: 4200, cs: 2000, lam: 3.3e5, L: 2.3e6, tm: 0, tb: 100, tend: 120 };
const SW = 520, SH = 400, BX0 = 130, BX1 = 350, BYB = 292, BH = 176, HV = 140, TMIN = -40, TMAX = 130, THX = 424, THY0 = 300, THY1 = 96;
const lamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const heating = {
  id: 'heating',
  title: 'Нагревание и плавление',
  lead: 'Нагреватель постоянной мощности греет лёд в стакане. Смотри на график: наклонные участки — нагревание, горизонтальные площадки — плавление и кипение, там температура не меняется, потому что вся теплота идёт на разрушение связей между молекулами.',
  stage: { w: SW, h: SH, label: 'Стакан со льдом на нагревателе, рядом термометр' },
  speed: 1,
  hold: 1.6,
  clockDec: 0,
  axisLabel: 'τ, с',
  params: [
    { id: 'm', name: 'Масса вещества', tex: 'm', unit: 'кг', min: 0.1, max: 1, step: 0.1, def: 0.5, dec: 1 },
    { id: 'P', name: 'Мощность нагревателя', tex: 'P', unit: 'Вт', min: 500, max: 3000, step: 100, def: 1000, dec: 0 },
    { id: 't0', name: 'Начальная температура', tex: 't_0', unit: '°C', min: -40, max: 90, step: 5, def: -20, dec: 0 },
  ],
  derive(p) {
    const m = p.m, P = p.P, segs = []; let t = 0, T = p.t0;
    const heat = (id, T1, c, name) => { const Q = c * m * (T1 - T), dur = Q / P; segs.push({ k: 'heat', id, name, ts: t, te: t + dur, T0: T, T1, Q }); t += dur; T = T1; };
    const plat = (id, Tp, H, name) => { const Q = H * m, dur = Q / P; segs.push({ k: 'plat', id, name, ts: t, te: t + dur, T0: Tp, T1: Tp, Q }); t += dur; };
    if (p.t0 <= M.tm) { if (p.t0 < M.tm) heat('ice', M.tm, M.ci, 'Нагревание льда'); plat('melt', M.tm, M.lam, 'Плавление'); }
    heat('water', M.tb, M.cw, 'Нагревание воды'); plat('boil', M.tb, M.L, 'Кипение'); heat('steam', M.tend, M.cs, 'Нагревание пара');
    const get = (id) => segs.find((s) => s.id === id), melt = get('melt'), boil = get('boil');
    return { segs, total: t, Qtot: P * t, melt, boil, ice: get('ice'), water: get('water'), steam: get('steam'), m, P, lo: p.t0 < 0 ? Math.floor((p.t0 - 5) / 10) * 10 : 0 };
  },
  window: (d) => d.total,
  pace: (d) => d.total / 20,
  axisMarks(d) {
    const out = []; let n = 1;
    for (const s of [d.melt, d.boil]) if (s) { out.push({ t: s.ts, tex: `\\tau_${n}`, canvas: `τ_${n}` }, { t: s.te, tex: `\\tau_${n + 1}`, canvas: `τ_${n + 1}` }); n += 2; }
    return out;
  },
  at(p, d, t) {
    const tt = lamp(t, 0, d.total), m = d.m; let s = d.segs.find((x) => tt <= x.te + 1e-9) || d.segs[d.segs.length - 1];
    const u = s.te > s.ts ? lamp((tt - s.ts) / (s.te - s.ts), 0, 1) : 1, T = s.T0 + (s.T1 - s.T0) * u;
    let mi = 0, mw = 0, ms = 0;
    if (s.id === 'ice') mi = m; else if (s.id === 'melt') { mi = m * (1 - u); mw = m * u; } else if (s.id === 'water') mw = m; else if (s.id === 'boil') { mw = m * (1 - u); ms = m * u; } else ms = m;
    return { t: tt, T, Q: d.P * tt, mi: mi * 1000, mw: mw * 1000, ms: ms * 1000, id: s.id, name: s.name };
  },
  marks: (p, d) => [d.melt, d.boil].filter(Boolean).flatMap((s) => [{ t: s.ts, kind: 'ext' }, { t: s.te, kind: 'ext' }]),
  panels: [
    { id: 'T', tex: 't', label: 't', unit: '°C', signed: false, on: true, lo: (p, d) => d.lo, max: () => 130, curves: (S_) => [{ f: (t) => S_.at(t).T, color: COLH.T }] },
    { id: 'm', tex: 'm', label: 'm', unit: 'г', signed: false, on: true, max: (p) => p.m * 1000, curves: (S_) => [{ f: (t) => S_.at(t).mi, color: COLH.ice, name: 'лёд' }, { f: (t) => S_.at(t).mw, color: COLH.water, name: 'вода' }, { f: (t) => S_.at(t).ms, color: COLH.steam, name: 'пар' }] },
    { id: 'Q', tex: 'Q', label: 'Q', unit: 'кДж', signed: false, on: false, max: (p, d) => d.Qtot / 1000, curves: (S_) => [{ f: (t) => S_.at(t).Q / 1000, color: COLH.Q }] },
  ],
  toggles: [{ id: 'fx', name: 'Пузырьки и пар', color: '#868e96', on: true }],
  table: {
    cols: ['\\tau', 't', 'Q'],
    units: ['с', '°C', 'кДж'],
    rows: [
      { id: 'start', color: '#1f9d55', name: 'Старт', vals: (p, d) => [0, p.t0, 0], test: (s, p, d, t) => t < 0.012 * d.total },
      { id: 'm1', color: '#339af0', name: 'Начало плавления', vals: (p, d) => (d.melt ? [d.melt.ts, 0, (d.P * d.melt.ts) / 1000] : [null, null, null]), test: (s, p, d) => d.melt && s.id === 'melt' && s.t - d.melt.ts < 0.03 * d.total },
      { id: 'm2', color: '#1971c2', name: 'Конец плавления', vals: (p, d) => (d.melt ? [d.melt.te, 0, (d.P * d.melt.te) / 1000] : [null, null, null]), test: (s, p, d) => d.melt && Math.abs(s.t - d.melt.te) < 0.015 * d.total },
      { id: 'b1', color: '#e8590c', name: 'Начало кипения', vals: (p, d) => [d.boil.ts, 100, (d.P * d.boil.ts) / 1000], test: (s, p, d) => s.id === 'boil' && s.t - d.boil.ts < 0.03 * d.total },
      { id: 'b2', color: '#868e96', name: 'Всё испарилось', vals: (p, d) => [d.boil.te, 100, (d.P * d.boil.te) / 1000], test: (s, p, d) => Math.abs(s.t - d.boil.te) < 0.015 * d.total },
    ],
    now: (s) => [s.t, s.T, s.Q / 1000],
    note: 'Строка подсвечивается, когда процесс на этом этапе. Время на площадках: τ = Q/P, где Q = λm при плавлении и Q = Lm при кипении.',
  },
  readouts: (p, d) => [
    ['Плавление льда', 'Q_\\text{пл} = \\lambda m', d.melt ? `${fmt(d.melt.Q / 1000, 0)} кДж · ${fmt(d.melt.te - d.melt.ts, 0)} с` : '—'],
    ['Кипение', 'Q_\\text{п} = L m', `${fmt(d.boil.Q / 1000, 0)} кДж · ${fmt(d.boil.te - d.boil.ts, 0)} с`],
    ['Нагревание воды', 'c_\\text{в} m \\Delta t', `${fmt(d.water.Q / 1000, 0)} кДж`],
    ['Нагревание льда', 'c_\\text{л} m \\Delta t', d.ice ? `${fmt(d.ice.Q / 1000, 0)} кДж` : '—'],
    ['Вся теплота до пара 120 °C', 'Q', `${fmt(d.Qtot / 1000, 0)} кДж`],
    ['Время', '\\tau = Q/P', `${fmt(d.total, 0)} с`],
  ],
  formulas: [
    { tag: 'Нагревание и охлаждение', color: '#e8590c', tex: 'Q = c\\,m\\,(t_2 - t_1)' },
    { tag: 'Плавление', color: '#339af0', tex: 'Q = \\lambda\\, m' },
    { tag: 'Парообразование', color: '#868e96', tex: 'Q = L\\, m' },
    { tag: 'Нагреватель', color: '#7048e8', tex: 'Q = P\\,\\tau' },
  ],

  mount(box, P0) {
    const bg = el('sm-sbg', 'canvas'); box.prepend(bg); bg.setAttribute('aria-hidden', 'true');
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label);
    const pc = (v, tot) => `${(v / tot) * 100}%`, put = (e, x, y, w, h) => { Object.assign(e.style, { left: pc(x, SW), top: pc(y, SH), width: pc(w, SW), height: pc(h, SH) }); return e; };
    const glow = put(el('sm-hv-glow'), BX0 - 20, BYB + 8, BX1 - BX0 + 40, 54), liq = put(el('sm-hv-w'), BX0 + 3, BYB - 150, BX1 - BX0 - 6, 150), ice = put(el('sm-hv-i'), BX0 + 12, BYB - 150, BX1 - BX0 - 24, 150);
    const hg = put(el('sm-hv-hg'), THX - 4, THY1, 8, THY0 - THY1), chip = el('sm-hv-state'), tval = el('sm-hv-t');
    const fxEl = el('sm-hv-fx'), steam = Array.from({ length: 14 }, () => el('sm-hv-puff')), bub = Array.from({ length: 12 }, () => el('sm-hv-bub'));
    fxEl.append(...bub, ...steam); box.append(glow, liq, ice, fxEl, hg, tval, chip);
    let P = P0, d = heating.derive(P0), f = 1, lastState = '', lastT = '', lastFx = null; const rnd = steam.map((_, i) => ((i * 0.6180339) % 1));
    const setup = (cv) => {
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.2e6 / (cssW * ((cssW * SH) / SW)))));
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(((cssW * SH) / SW) * dpr);
      const g = cv.getContext('2d'); g.setTransform(cv.width / SW, 0, 0, cv.height / SH, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round'; return g;
    };
    const paintBg = () => {
      const c = setup(bg); c.clearRect(0, 0, SW, SH);
      // нагреватель: плита, спираль, ножки
      rr(c, BX0 - 24, BYB + 8, BX1 - BX0 + 48, 22, 8); c.fillStyle = '#4a5365'; c.fill(); c.strokeStyle = '#2a3140'; c.lineWidth = 2; c.stroke();
      c.strokeStyle = '#ff6b3d'; c.lineWidth = 3; c.beginPath(); c.moveTo(BX0 - 6, BYB + 19); for (let i = 0; i <= 16; i++) c.lineTo(BX0 - 6 + ((BX1 - BX0 + 12) * i) / 16, BYB + 19 + (i % 2 ? -3.5 : 3.5)); c.stroke();
      c.strokeStyle = '#2a3140'; c.lineWidth = 6; c.beginPath(); c.moveTo(BX0 - 8, BYB + 32); c.lineTo(BX0 - 8, BYB + 50); c.moveTo(BX1 + 8, BYB + 32); c.lineTo(BX1 + 8, BYB + 50); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.moveTo(BX0 - 50, BYB + 50); c.lineTo(BX1 + 50, BYB + 50); c.stroke();
      tex(c, `P = ${fmt(P.P, 0)} Вт`, (BX0 + BX1) / 2, BYB + 78, { size: 16, align: 'center', color: '#3b475c' });
      // стакан: стенки и деления
      c.beginPath(); c.moveTo(BX0, BYB - BH); c.lineTo(BX0, BYB - 12); c.quadraticCurveTo(BX0, BYB, BX0 + 12, BYB); c.lineTo(BX1 - 12, BYB); c.quadraticCurveTo(BX1, BYB, BX1, BYB - 12); c.lineTo(BX1, BYB - BH);
      c.fillStyle = 'rgba(255,255,255,.28)'; c.fill(); c.strokeStyle = '#7d8fab'; c.lineWidth = 3.2; c.stroke();
      c.strokeStyle = 'rgba(125,143,171,.9)'; c.lineWidth = 1.6; for (let i = 1; i <= 4; i++) { const y = BYB - 150 * (i / 4) * (140 / 150) - 4; c.beginPath(); c.moveTo(BX0 + 3, y); c.lineTo(BX0 + (i % 2 ? 14 : 22), y); c.stroke(); }
      // термометр: трубка, шкала, шарик
      rr(c, THX - 7, THY1 - 6, 14, THY0 - THY1 + 6, 7); c.fillStyle = 'rgba(255,255,255,.75)'; c.fill(); c.strokeStyle = '#7d8fab'; c.lineWidth = 2.2; c.stroke();
      c.beginPath(); c.arc(THX, THY0 + 4, 13, 0, 7); c.fillStyle = '#e03131'; c.fill(); c.strokeStyle = '#a61e1e'; c.lineWidth = 2; c.stroke();
      const ty = (T) => THY0 - ((T - TMIN) / (TMAX - TMIN)) * (THY0 - THY1);
      for (let T = -40; T <= 120; T += 20) { const y = ty(T); c.strokeStyle = '#2a3140'; c.lineWidth = T % 40 === 0 ? 1.8 : 1.2; c.beginPath(); c.moveTo(THX + 8, y); c.lineTo(THX + (T % 40 === 0 ? 17 : 13), y); c.stroke(); if (T % 40 === 0) tex(c, fmt(T, 0), THX + 21, y + 4, { size: 12, color: '#3b475c' }); }
      c.strokeStyle = 'rgba(232,89,12,.55)'; c.setLineDash([4, 4]); c.lineWidth = 1.2; for (const T of [0, 100]) { const y = ty(T); c.beginPath(); c.moveTo(THX - 90, y); c.lineTo(THX - 8, y); c.stroke(); }
      c.setLineDash([]); tex(c, '0 °C', THX - 94, ty(0) + 4, { size: 12.5, align: 'right', color: '#c2410c' }); tex(c, '100 °C', THX - 94, ty(100) + 4, { size: 12.5, align: 'right', color: '#c2410c' });
    };
    const sn = (v) => Math.round(v * Math.max(1, Math.min(2, window.devicePixelRatio || 1))) / Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const api = {
      resize() { f = (box.clientWidth || SW) / SW; fxEl.style.setProperty('--f', f); paintBg(); },
      params(p) { P = p; d = heating.derive(p); paintBg(); glow.style.opacity = String(0.25 + 0.55 * ((p.P - 500) / 2500)); },
      update(s, dd, o) {
        d = dd; const m = d.m * 1000, wall = performance.now() / 1000;
        const Hw = (HV * s.mw) / m, Hi = (HV * 1.09 * s.mi) / m, b = Math.max(0, Hw - 0.917 * Hi);
        liq.style.transform = `scaleY(${(Hw / 150).toFixed(4)})`; ice.style.transform = `translate3d(0,${-sn(b * f)}px,0) scaleY(${(Hi / 150).toFixed(4)})`; ice.style.visibility = Hi > 0.5 ? 'visible' : 'hidden';
        hg.style.transform = `scaleY(${lamp((s.T - TMIN) / (TMAX - TMIN), 0.02, 1).toFixed(4)})`;
        const stName = s.id === 'melt' ? 'Лёд плавится: t = 0 °C' : s.id === 'boil' ? 'Вода кипит: t = 100 °C' : s.id === 'ice' ? 'Лёд' : s.id === 'water' ? 'Вода' : 'Пар';
        if (stName !== lastState) { lastState = stName; chip.textContent = stName; chip.dataset.k = s.id; }
        const tt = `${fmt(s.T, 0)} °C`; if (tt !== lastT) { lastT = tt; tval.textContent = tt; }
        // пузырьки в воде и пар над стаканом (скрыты, если выключены или нечему кипеть)
        const near = lamp((s.T - 85) / 15, 0, 1) * (s.id === 'steam' ? 0 : 1), boiling = s.id === 'boil' ? 1 : 0, showFx = !!o.fx;
        const bI = showFx && Hw > 6 ? Math.max(near * 0.4, boiling) : 0, sI = showFx ? (s.id === 'steam' ? 1 : boiling ? 1 : near * 0.35) : 0, ys = BYB - Math.max(Hw, 14);
        bub.forEach((e, i) => {
          if (i >= Math.round(bI * bub.length)) { if (e.style.opacity !== '0') e.style.opacity = '0'; return; }
          const ph = (wall * 0.9 + rnd[i]) % 1, x = BX0 + 18 + ((rnd[i] * 7.3) % 1) * (BX1 - BX0 - 36), y = BYB - 6 - ph * Math.max(4, Hw - 8);
          e.style.transform = `translate3d(${sn(x * f)}px,${sn(y * f)}px,0)`; e.style.opacity = String(0.35 + 0.5 * (1 - ph) * bI);
        });
        steam.forEach((e, i) => {
          if (i >= Math.round(sI * steam.length)) { if (e.style.opacity !== '0') e.style.opacity = '0'; return; }
          const ph = (wall * 0.32 + rnd[i]) % 1, x = BX0 + 22 + ((rnd[i] * 11.7) % 1) * (BX1 - BX0 - 44) + Math.sin(wall * 1.3 + i) * 7, y = (s.id === 'steam' ? BYB - 40 : ys) - ph * (ys - 44);
          e.style.transform = `translate3d(${sn(x * f)}px,${sn(y * f)}px,0) scale(${(0.6 + ph * 0.9).toFixed(2)})`; e.style.opacity = String(Math.max(0, 0.62 * (1 - ph) * Math.min(1, sI + 0.25)));
        });
      },
    };
    return api;
  },
};

heating.table.rows.forEach((r) => { const f0 = r.test; r.test = (...a) => !!f0(...a); });
