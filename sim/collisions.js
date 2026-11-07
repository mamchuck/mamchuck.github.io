// Сцена «Столкновения и импульс»: две тележки на гладкой дороге. До удара они едут равномерно, в момент касания скорости меняются мгновенно.
// Закон сохранения импульса m₁v₁ + m₂v₂ = m₁v₁′ + m₂v₂′ выполняется всегда; кинетическая энергия сохраняется только при упругом ударе.
// Скорости после удара из коэффициента восстановления e: v₁′ = (m₁v₁ + m₂v₂ − m₂e(v₁ − v₂))/(m₁ + m₂), v₂′ = (m₁v₁ + m₂v₂ + m₁e(v₁ − v₂))/(m₁ + m₂).
import { fmt, tex, arrow, hatch, sprite, rr } from './tex.js?v=202611071149';

const el = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };
export const COLC = { c1: '#2563eb', c2: '#e8590c', tot: '#1b2330', v: '#1f9d55', p: '#7048e8' };
const SW = 520, SH = 400, GY = 258, LEFT = 22, RIGHT = SW - 22, CW = 76, CH = 62, VW = 230, VH = 200, GAP = 6.5, AFTER = 2.6;
const NICE = [1, 2, 5, 10, 20, 50, 100];

export const collisions = {
  id: 'collisions',
  title: 'Столкновения и импульс',
  lead: 'Две тележки сталкиваются. Подбери массы, скорости и тип удара и убедись: суммарный импульс не меняется никогда, а энергия сохраняется только при упругом ударе. Стрелки показывают скорости (зелёные) и импульсы (фиолетовые).',
  stage: { w: SW, h: SH, label: 'Две тележки сталкиваются на гладкой дороге' },
  speed: 0.5,
  hold: 1.2,
  params: [
    { id: 'm1', name: 'Масса синей тележки', tex: 'm_1', unit: 'кг', min: 0.5, max: 5, step: 0.5, def: 2, dec: 1 },
    { id: 'm2', name: 'Масса оранжевой тележки', tex: 'm_2', unit: 'кг', min: 0.5, max: 5, step: 0.5, def: 1, dec: 1 },
    { id: 'v1', name: 'Скорость синей', tex: 'v_1', unit: 'м/с', min: -6, max: 6, step: 0.5, def: 4, dec: 1 },
    { id: 'v2', name: 'Скорость оранжевой', tex: 'v_2', unit: 'м/с', min: -6, max: 6, step: 0.5, def: 0, dec: 1 },
    { id: 'e', name: 'Тип удара: коэффициент восстановления', tex: 'e', unit: '', dec: 1, def: 1, options: [{ label: 'Упругий', v: 1 }, { label: 'Частично', v: 0.5 }, { label: 'Слипаются', v: 0 }] },
  ],
  derive(p) {
    const { m1, m2, v1, v2, e } = p, M = m1 + m2, vr = v1 - v2, hit = vr > 1e-9, pt = m1 * v1 + m2 * v2;
    const u1 = hit ? (pt - m2 * e * vr) / M : v1, u2 = hit ? (pt + m1 * e * vr) / M : v2;
    const tc = hit ? Math.min(4, Math.max(0.8, 5 / vr)) : Infinity, T = hit ? tc + AFTER : 6;
    // положения центров относительно точки касания (она в x = 0); ширина тележки wm подбирается так, чтобы на экране она была ≈ CW пикселей
    let wm = 1.6, sc = 20, xmin = 0, xmax = 0, S0 = 0;
    for (let it = 0; it < 5; it++) {
      S0 = hit ? wm + vr * tc : GAP;
      const xs = hit
        ? [-wm / 2 - v1 * tc, wm / 2 - v2 * tc, -wm / 2 + u1 * (T - tc), wm / 2 + u2 * (T - tc), -wm / 2, wm / 2]
        : [-S0 / 2, S0 / 2, -S0 / 2 + v1 * T, S0 / 2 + v2 * T];
      xmin = Math.min(...xs); xmax = Math.max(...xs);
      sc = Math.min(60, (RIGHT - LEFT - CW) / Math.max(xmax - xmin, 5)); wm = CW / sc;
    }
    const E = (a, b, c, e2) => 0.5 * a * b * b + 0.5 * c * e2 * e2;
    return { M, hit, pt, vr, u1, u2, tc, T, wm, sc, xmin, xmax, S0, Eb: E(m1, v1, m2, v2), Ea: E(m1, u1, m2, u2),
      vmax: Math.max(Math.abs(v1), Math.abs(v2), Math.abs(u1), Math.abs(u2), 1), pmax: Math.max(Math.abs(m1 * v1), Math.abs(m2 * v2), Math.abs(m1 * u1), Math.abs(m2 * u2), 1) };
  },
  window: (d) => d.T,
  axisMarks: (d) => (d.hit ? [{ t: d.tc, tex: 't_\\text{уд}', canvas: 't_{уд}' }] : []),
  at(p, d, t) {
    const post = d.hit && t >= d.tc, v1 = post ? d.u1 : p.v1, v2 = post ? d.u2 : p.v2;
    let x1, x2;
    if (d.hit) { const dt = t - d.tc; x1 = -d.wm / 2 + v1 * dt; x2 = d.wm / 2 + v2 * dt; } else { x1 = -d.S0 / 2 + p.v1 * t; x2 = d.S0 / 2 + p.v2 * t; }
    const p1 = p.m1 * v1, p2 = p.m2 * v2, E1 = 0.5 * p.m1 * v1 * v1, E2 = 0.5 * p.m2 * v2 * v2;
    return { x1, x2, v1, v2, p1, p2, p: p1 + p2, E1, E2, E: E1 + E2, post };
  },
  marks: (p, d) => (d.hit ? [{ t: d.tc, kind: 'ext' }] : []),
  panels: [
    { id: 'v', tex: 'v', label: 'v', unit: 'м/с', signed: true, on: true, max: (p, d) => d.vmax, curves: (S_) => [{ f: (t) => S_.at(t).v1, color: COLC.c1, name: 'v_1' }, { f: (t) => S_.at(t).v2, color: COLC.c2, name: 'v_2' }] },
    { id: 'p', tex: 'p', label: 'p', unit: 'кг·м/с', signed: true, on: true, max: (p, d) => Math.max(d.pmax, Math.abs(d.pt), 1), curves: (S_) => [{ f: (t) => S_.at(t).p1, color: COLC.c1, name: 'p_1' }, { f: (t) => S_.at(t).p2, color: COLC.c2, name: 'p_2' }, { f: (t) => S_.at(t).p, color: COLC.tot, name: 'p', dash: [6, 4], alpha: 0.9 }] },
    { id: 'E', tex: 'E', label: 'E_к', unit: 'Дж', signed: false, on: false, max: (p, d) => Math.max(d.Eb, d.Ea, 1), curves: (S_) => [{ f: (t) => S_.at(t).E1, color: COLC.c1, name: 'E_1' }, { f: (t) => S_.at(t).E2, color: COLC.c2, name: 'E_2' }, { f: (t) => S_.at(t).E, color: COLC.tot, name: 'E', dash: [6, 4], alpha: 0.9 }] },
  ],
  toggles: [{ id: 'v', name: 'Скорости', color: COLC.v, on: true }, { id: 'p', name: 'Импульсы', color: COLC.p, on: true }],
  table: {
    cols: ['v_1', 'v_2', 'p', 'E_\\text{к}'],
    units: ['м/с', 'м/с', 'кг·м/с', 'Дж'],
    rows: [
      { id: 'before', color: '#1f9d55', name: 'До удара', vals: (p, d) => [p.v1, p.v2, d.pt, d.Eb], test: (s, p, d, t) => !d.hit || t < d.tc },
      { id: 'after', color: '#e8590c', name: 'После удара', vals: (p, d) => (d.hit ? [d.u1, d.u2, d.pt, d.Ea] : [null, null, null, null]), test: (s, p, d, t) => d.hit && t >= d.tc },
    ],
    now: (s) => [s.v1, s.v2, s.p, s.E],
    note: 'Столбец p — суммарный импульс, он в обеих строках одинаков. Знак скорости показывает направление: «+» вправо, «−» влево. Если синяя тележка не догоняет оранжевую, удара не будет.',
  },
  readouts: (p, d) => [['Суммарный импульс', 'p = m_1v_1 + m_2v_2', `${fmt(d.pt, 2)} кг·м/с`], ['Энергия до удара', 'E_1', `${fmt(d.Eb, 2)} Дж`], ['Энергия после удара', 'E_2', d.hit ? `${fmt(d.Ea, 2)} Дж` : '—'],
    ['Потеря энергии', 'Q = E_1 - E_2', d.hit ? `${fmt(d.Eb - d.Ea, 2)} Дж` : '—'], ['Скорость синей после', 'v_1\'', d.hit ? `${fmt(d.u1, 2)} м/с` : '—'], ['Скорость оранжевой после', 'v_2\'', d.hit ? `${fmt(d.u2, 2)} м/с` : '—']],
  formulas: [
    { tag: 'Закон сохранения импульса', color: '#7048e8', tex: 'm_1 v_1 + m_2 v_2 = m_1 v_1\' + m_2 v_2\'' },
    { tag: 'Неупругий удар (слипаются)', color: '#e8590c', tex: 'v\' = \\dfrac{m_1 v_1 + m_2 v_2}{m_1 + m_2}' },
    { tag: 'Упругий удар', color: '#2563eb', tex: '\\dfrac{m_1 v_1^2}{2} + \\dfrac{m_2 v_2^2}{2} = \\dfrac{m_1 v_1\'^2}{2} + \\dfrac{m_2 v_2\'^2}{2}' },
  ],

  mount(box, P0) {
    const bg = el('sm-sbg', 'canvas'), c1 = el('sm-cart', 'canvas'), c2 = el('sm-cart', 'canvas'), vec1 = el('sm-kvec', 'canvas'), vec2 = el('sm-kvec', 'canvas'), spark = el('sm-spark', 'canvas');
    box.prepend(bg, c1, c2, vec1, vec2, spark);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label);
    [bg, c1, c2, vec1, vec2, spark].forEach((e) => e.setAttribute('aria-hidden', 'true'));
    let P = P0, d = collisions.derive(P0), f = 1, k = 1, dprN = 1, v1c = null, v2c = null, labels = null, lastKey = ['', ''], lastOn = [null, null];
    const X = (x) => LEFT + CW / 2 + (x - d.xmin) * d.sc;
    const setup = (cv) => {
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.2e6 / (cssW * ((cssW * SH) / SW)))));
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(((cssW * SH) / SW) * dpr);
      const g = cv.getContext('2d'); g.setTransform(cv.width / SW, 0, 0, cv.height / SH, 0, 0); return g;
    };
    const paintBg = (c) => {
      c.clearRect(0, 0, SW, SH);
      c.fillStyle = 'rgba(160,172,192,.3)'; c.fillRect(LEFT - 12, GY, SW - 2 * LEFT + 24, 12); hatch(c, LEFT - 12, GY, SW - 2 * LEFT + 24, 12, 7, { color: '#9aa5b8', lw: 0.9 });
      c.strokeStyle = '#3b4658'; c.lineWidth = 2; c.beginPath(); c.moveTo(LEFT - 12, GY); c.lineTo(SW - LEFT + 12, GY); c.stroke();
      const st = NICE.find((n) => n * d.sc >= 46) || 100, x0 = Math.ceil((d.xmin - CW / 2 / d.sc) / st) * st;
      c.strokeStyle = '#2a3140'; c.lineWidth = 1.3; c.beginPath();
      for (let x = x0; X(x) <= SW - 34; x += st) { c.moveTo(X(x), GY - 4); c.lineTo(X(x), GY + 4); }
      c.stroke();
      for (let x = x0; X(x) <= SW - 34; x += st) tex(c, fmt(x, 0), X(x), GY + 28, { size: 12, align: 'center', color: '#3b475c' });
      tex(c, 'x, м', SW - 16, GY - 10, { size: 14, align: 'right' });
      if (!d.hit) tex(c, 'Синяя тележка не догоняет оранжевую: удара не будет', SW / 2, SH - 16, { size: 14, align: 'center', color: '#c2410c' });
      else { c.setLineDash([4, 4]); c.strokeStyle = 'rgba(232,89,12,.55)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(X(0), GY - 118); c.lineTo(X(0), GY); c.stroke(); c.setLineDash([]); tex(c, 'место удара', X(0), GY - 124, { size: 13, align: 'center', color: '#c2410c' }); }
    };
    const cartImg = (cv, top, bottom, edge, label, mass) => {
      cv.style.width = `${(CW / SW) * 100}%`; cv.style.height = `${(CH / SH) * 100}%`; cv.style.top = `${((GY - CH + 2) / SH) * 100}%`; cv.width = Math.ceil(CW * k); cv.height = Math.ceil(CH * k);
      const g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
      const gr = g.createLinearGradient(0, 4, 0, CH - 12); gr.addColorStop(0, top); gr.addColorStop(1, bottom);
      rr(g, 3, 4, CW - 6, CH - 16, 8); g.fillStyle = gr; g.fill(); g.strokeStyle = edge; g.lineWidth = 1.5; g.stroke();
      rr(g, 4.6, 5.6, CW - 9.2, CH - 19.2, 7); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.stroke();
      for (const wx of [18, CW - 18]) { g.beginPath(); g.arc(wx, CH - 8, 7, 0, 7); g.fillStyle = '#27303f'; g.fill(); g.beginPath(); g.arc(wx, CH - 8, 2.6, 0, 7); g.fillStyle = '#cbd5e1'; g.fill(); }
      tex(g, label, CW / 2 - 4, 26, { size: 17, color: '#fff', align: 'center' }); tex(g, `${fmt(mass, 1)} кг`, CW / 2, 45, { size: 14, color: '#fff', align: 'center' });
    };
    const api = {
      resize() {
        const cssW = box.clientWidth || SW; f = cssW / SW; dprN = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.2e6 / (cssW * ((cssW * SH) / SW))))); k = (cssW * dpr) / SW;
        cartImg(c1, '#5b9dff', '#2a62d9', '#1c47a8', 'm_1', P.m1); cartImg(c2, '#ff9a55', '#e8590c', '#a63b00', 'm_2', P.m2);
        for (const v of [vec1, vec2]) { v.style.width = `${(VW / SW) * 100}%`; v.style.height = `${(VH / SH) * 100}%`; v.style.top = `${((GY - 128) / SH) * 100}%`; v.width = Math.ceil(VW * k); v.height = Math.ceil(VH * k); }
        v1c = vec1.getContext('2d'); v1c.setTransform(k, 0, 0, k, 0, 0); v2c = vec2.getContext('2d'); v2c.setTransform(k, 0, 0, k, 0, 0);
        const lab = (src, color) => sprite(44, 30, k, (gg) => { tex(gg, src, 4, 21, { size: 18, color }); });
        labels = { v: lab('\\v{v}', COLC.v), p: lab('\\v{p}', COLC.p) };
        // искра в момент удара
        spark.style.width = `${(70 / SW) * 100}%`; spark.style.height = `${(70 / SH) * 100}%`; spark.width = Math.ceil(70 * k); spark.height = Math.ceil(70 * k);
        const sg = spark.getContext('2d'); sg.setTransform(k, 0, 0, k, 0, 0); sg.clearRect(0, 0, 70, 70); sg.translate(35, 35); sg.fillStyle = '#ffd43b'; sg.strokeStyle = '#e8590c'; sg.lineWidth = 1.6; sg.beginPath();
        for (let i = 0; i < 16; i++) { const r = i % 2 ? 11 : 31, a = (i * Math.PI) / 8; sg.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        sg.closePath(); sg.fill(); sg.stroke();
        paintBg(setup(bg)); lastKey = ['', '']; lastOn = [null, null];
      },
      params(p) {
        P = p; d = collisions.derive(p); paintBg(setup(bg)); lastKey = ['', ''];
        cartImg(c1, '#5b9dff', '#2a62d9', '#1c47a8', 'm_1', P.m1); cartImg(c2, '#ff9a55', '#e8590c', '#a63b00', 'm_2', P.m2);
        spark.style.left = `${((X(0) - 35) / SW) * 100}%`; spark.style.top = `${((GY - CH / 2 - 35) / SH) * 100}%`;
      },
      update(s, dd, o, t) {
        d = dd; const sn = (v) => Math.round(v * dprN) / dprN, xs = [X(s.x1), X(s.x2)];
        c1.style.transform = `translate3d(${sn((xs[0] - CW / 2) * f)}px,0,0)`; c2.style.transform = `translate3d(${sn((xs[1] - CW / 2) * f)}px,0,0)`;
        const near = d.hit ? Math.max(0, 1 - Math.abs(t - d.tc) / 0.32) : 0;
        spark.style.opacity = near.toFixed(2); spark.style.transform = `scale(${(0.5 + near).toFixed(2)})`;
        [[vec1, v1c, s.v1, s.p1, 0], [vec2, v2c, s.v2, s.p2, 1]].forEach(([cv, c, v, pp, i]) => {
          const any = o.v || o.p;
          if (any !== lastOn[i]) { lastOn[i] = any; cv.style.display = any ? '' : 'none'; lastKey[i] = ''; }
          if (!any) return;
          cv.style.transform = `translate3d(${sn((xs[i] - VW / 2) * f)}px,0,0)`;
          const key = `${v.toFixed(3)}|${o.v}|${o.p}|${d.vmax}|${d.pmax}`; if (key === lastKey[i]) return; lastKey[i] = key;
          const h = VW / 2, L = 78; c.clearRect(0, 0, VW, VH);
          if (o.v) { const l = (v / d.vmax) * L; arrow(c, h, 30, h + l, 30, { color: COLC.v, lw: 2.8, head: 10 }); c.drawImage(labels.v, l >= 0 ? h + l + 3 : h + l - 25, 14, 44, 30); }
          if (o.p) { const l = (pp / d.pmax) * L; arrow(c, h, 178, h + l, 178, { color: COLC.p, lw: 2.8, head: 10 }); c.drawImage(labels.p, l >= 0 ? h + l + 3 : h + l - 25, 162, 44, 30); }
        });
      },
    };
    vec1.style.display = vec2.style.display = '';
    spark.style.opacity = '0';
    return api;
  },
};
