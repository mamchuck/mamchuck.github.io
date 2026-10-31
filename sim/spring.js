// Сцена «Пружинный маятник»: груз на гладкой горизонтальной поверхности, идеальная пружина (без трения).
// Решение точное (аналитическое), поэтому время можно перематывать и ничего не накапливается: x = A·cos(ωt + φ₀).
// Рисунок собран из лёгких слоёв: фон (стена, пол, ось) рисуется один раз; груз, линия-указатель и точка на оси — обычные элементы,
// которые только сдвигаются (их ведёт видеокарта); пружина и векторы рисуются в узких полосках, а не на всей сцене.
import { fmt, tex, arrow, hatch, zigzag, sprite, rr } from './tex.js?v=202610311518';

const el = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };

const PI = Math.PI;
export const COL = { x: '#1b2330', v: '#1f9d55', a: '#2563eb', F: '#d6336c', Ek: '#e8590c', Ep: '#7048e8', E: '#64748b' };

// Геометрия сцены (логические единицы 520×400: почти квадрат, чтобы рядом поместились графики)
const SW = 520, SH = 400, WALL = 34, EDGE = 14, X0 = (34 + 520 - 14) / 2, PXM = 900, S = 58, FLOOR = 286, SPY = FLOOR - S / 2, AXY = 338;
let FS = 1;                                              // на узких экранах рисунок уменьшается целиком, поэтому подписи увеличиваем

export const spring = {
  id: 'spring',
  title: 'Пружинный маятник',
  lead: 'Оттяни груз и отпусти. Графики идут друг под другом с общей осью времени: в крайнем положении видно, что равно нулю, а что максимально.',
  stage: { w: SW, h: SH, label: 'Груз на пружине колеблется вдоль горизонтальной оси' },
  fit(cssW) { FS = Math.max(1, Math.min(1.5, 480 / cssW)); return FS; },
  params: [
    { id: 'm', name: 'Масса груза', tex: 'm', unit: 'кг', min: 0.1, max: 2, step: 0.1, def: 0.5, dec: 1 },
    { id: 'k', name: 'Жёсткость пружины', tex: 'k', unit: 'Н/м', min: 5, max: 80, step: 1, def: 20, dec: 0 },
    { id: 'A', name: 'Амплитуда', tex: 'A', unit: 'м', min: 0.02, max: 0.15, step: 0.01, def: 0.1, dec: 2 },
    { id: 'phi', name: 'Начальная фаза', tex: '\\varphi_0', unit: 'π', min: 0, max: 2, step: 0.05, def: 0, dec: 2 },
  ],
  derive(p) { const w = Math.sqrt(p.k / p.m), T = 2 * PI / w; return { w, T, nu: 1 / T, vmax: p.A * w, amax: p.A * w * w, E: 0.5 * p.k * p.A * p.A }; },
  window: (d) => 4 * d.T,
  at(p, d, t) {
    const ph = d.w * t + p.phi * PI, x = p.A * Math.cos(ph), v = -p.A * d.w * Math.sin(ph), a = -d.w * d.w * x;
    return { x, v, a, Ek: 0.5 * p.m * v * v, Ep: 0.5 * p.k * x * x };
  },
  marks(p, d, T4) {                                       // моменты крайних положений и прохождения равновесия
    const out = [];
    for (let n = 0; n < 12; n++) {
      const te = (n * PI - p.phi * PI) / d.w, tq = ((n + 0.5) * PI - p.phi * PI) / d.w;
      if (te >= 0 && te <= T4 + 1e-9) out.push({ t: te, kind: 'ext' });
      if (tq >= 0 && tq <= T4 + 1e-9) out.push({ t: tq, kind: 'eq' });
    }
    return out;
  },
  panels: [
    { id: 'x', tex: 'x', label: 'x', unit: 'м', signed: true, on: true, max: (p) => p.A, curves: (S_) => [{ f: (t) => S_.at(t).x, color: COL.x }] },
    { id: 'v', tex: 'v', label: 'v_x', unit: 'м/с', signed: true, on: true, max: (p, d) => d.vmax, curves: (S_) => [{ f: (t) => S_.at(t).v, color: COL.v }] },
    { id: 'a', tex: 'a', label: 'a_x', unit: 'м/с²', signed: true, on: true, max: (p, d) => d.amax, curves: (S_) => [{ f: (t) => S_.at(t).a, color: COL.a }] },
    { id: 'E', tex: 'E', label: 'E', unit: 'Дж', signed: false, on: false, max: (p, d) => d.E,
      curves: (S_) => [{ f: (t) => S_.at(t).Ek, color: COL.Ek, name: 'E_к' }, { f: (t) => S_.at(t).Ep, color: COL.Ep, name: 'E_п' }, { f: () => S_.d.E, color: COL.E, dash: [5, 4], name: 'E' }] },
  ],
  toggles: [{ id: 'v', name: 'Скорость', color: COL.v }, { id: 'a', name: 'Ускорение', color: COL.a }, { id: 'F', name: 'Силы', color: COL.F }],
  table: {                                                  // строки «Положения»: что чему равно в характерных точках
    cols: ['|x|', '|v|', '|a|', 'E_\\text{к}', 'E_\\text{п}'],
    units: ['м', 'м/с', 'м/с²', 'Дж', 'Дж'],
    rows: [
      { id: 'eq', name: 'Равновесие', vals: (p, d) => [0, d.vmax, 0, d.E, 0], test: (s, p) => Math.abs(s.x) < 0.04 * p.A },
      { id: 'ext', name: 'Крайнее', vals: (p, d) => [p.A, 0, d.amax, 0, d.E], test: (s, p) => Math.abs(s.x) > 0.96 * p.A },
    ],
    now: (s) => [Math.abs(s.x), Math.abs(s.v), Math.abs(s.a), s.Ek, s.Ep],
  },
  readouts: (p, d) => [['Период', 'T', `${fmt(d.T, 2)} с`], ['Частота', '\\nu', `${fmt(d.nu, 2)} Гц`], ['Циклическая частота', '\\omega', `${fmt(d.w, 2)} рад/с`],
    ['Макс. скорость', 'v_{\\max}', `${fmt(d.vmax, 2)} м/с`], ['Макс. ускорение', 'a_{\\max}', `${fmt(d.amax, 1)} м/с²`], ['Полная энергия', 'E', `${fmt(d.E * 1000, 0)} мДж`]],
  formulas: [
    { tag: 'Период', color: '#1b2330', tex: 'T = 2\\pi\\sqrt{\\dfrac{m}{k}}' },
    { tag: 'Закон колебаний', color: '#1f9d55', tex: 'x = A\\cos(\\omega t + \\varphi_0),\\quad \\omega = \\sqrt{\\dfrac{k}{m}}' },
    { tag: 'Энергия', color: '#7048e8', tex: 'E = \\dfrac{kA^2}{2} = E_\\text{к} + E_\\text{п}' },
  ],

  // ---------- Сборка сцены в контейнере: возвращает объект с resize / params / update ----------
  mount(box, P0, d0) {
    const bg = el('sm-sbg', 'canvas'), spr = el('sm-spr', 'canvas'), vec = el('sm-vec', 'canvas'), blk = el('sm-blk', 'canvas'), guide = el('sm-guide'), dot = el('sm-pos');
    box.prepend(bg, guide, spr, blk, dot, vec);
    bg.setAttribute('aria-hidden', 'true'); spr.setAttribute('aria-hidden', 'true'); vec.setAttribute('aria-hidden', 'true'); blk.setAttribute('aria-hidden', 'true');
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', 'Груз на пружине колеблется вдоль горизонтальной оси');
    const SPR = { top: SPY - 20, h: 40 }, VEC = { top: 120, h: 180 }, pct = (v, tot) => `${(v / tot) * 100}%`;
    let f = 1, k = 1, dprN = 1, sprC = null, vecC = null, labels = null, P = P0, vecOn = false;

    // холст-полоска: пиксели по её размеру, а координаты — как у всей сцены (со сдвигом)
    const band = (cv, top, h) => {
      const cssW = box.clientWidth || SW, cssH = h * f, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.1e6 / (cssW * SH))));
      cv.style.top = pct(top, SH); cv.style.height = pct(h, SH);
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
      const g = cv.getContext('2d'); g.setTransform(cv.width / SW, 0, 0, cv.height / h, 0, -(top * cv.height) / h); return g;
    };
    const api = {
      resize() {
        const cssW = box.clientWidth || SW; f = cssW / SW; dprN = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); FS = Math.max(1, Math.min(1.7, 700 / cssW));
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.1e6 / (cssW * SH)))); k = (cssW * dpr) / SW;
        // фон
        bg.width = Math.round(cssW * dpr); bg.height = Math.round(cssW * SH / SW * dpr);
        const bc = bg.getContext('2d'); bc.setTransform(bg.width / SW, 0, 0, bg.height / SH, 0, 0); api.paintBg(bc);
        sprC = band(spr, SPR.top, SPR.h); vecC = band(vec, VEC.top, VEC.h);
        // груз: готовая картинка, дальше только сдвигается
        const bw = S + 32, bh = S + 24; blk.style.width = pct(bw, SW); blk.style.height = pct(bh, SH); blk.style.top = pct(FLOOR - S - 6, SH);
        blk.width = Math.ceil(bw * k); blk.height = Math.ceil(bh * k);
        const g = blk.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); api.paintBlock(g);
        guide.style.top = pct(FLOOR + 18, SH); guide.style.height = pct(AXY - 6 - (FLOOR + 18), SH); dot.style.top = pct(AXY, SH);
        const lab = (src, color) => sprite(80, 30, k, (gg) => { tex(gg, src, 6, 21, { size: 17 * FS, color }); });
        labels = { v: lab('\\v{v}', COL.v), a: lab('\\v{a}', COL.a), F: lab('\\v{F}_{упр}', COL.F) };
      },
      params(p) { P = p; const bc = bg.getContext('2d'); bc.setTransform(bg.width / SW, 0, 0, bg.height / SH, 0, 0); api.paintBg(bc); },
      paintBg(c) {
        c.clearRect(0, 0, SW, SH);
        // стена слева и пол: одна цельная опора, линия стены заканчивается ровно на полу, без выступов
        c.fillStyle = 'rgba(160,172,192,.35)';
        c.fillRect(EDGE, 96, WALL - EDGE, FLOOR + 14 - 96); c.fillRect(WALL, FLOOR, SW - EDGE - WALL, 14);
        hatch(c, EDGE, 96, WALL - EDGE, FLOOR + 14 - 96, 7, { color: '#8793a8', lw: 1 });
        hatch(c, WALL, FLOOR, SW - EDGE - WALL, 14, 7, { color: '#9aa5b8', lw: 0.9 });
        c.strokeStyle = '#3b4658'; c.lineWidth = 2; c.lineJoin = 'miter'; c.lineCap = 'butt';
        c.beginPath(); c.moveTo(WALL, 96); c.lineTo(WALL, FLOOR); c.lineTo(SW - EDGE, FLOOR); c.stroke();
        const xa = X0 - P.A * PXM, xb = X0 + P.A * PXM;                    // ось x: стрелка и деления −A, 0, A
        arrow(c, X0 - 200, AXY, X0 + 200, AXY, { lw: 1.4, head: 8, color: '#2a3140' });
        c.strokeStyle = '#2a3140'; c.lineWidth = 1.4;
        for (const [x, lab] of [[xa, '−A'], [X0, '0'], [xb, 'A']]) { c.beginPath(); c.moveTo(x, AXY - 4); c.lineTo(x, AXY + 4); c.stroke(); tex(c, lab, x, AXY + 19 * FS, { size: 15 * FS, align: 'center' }); }
        tex(c, 'x', X0 + 206, AXY + 19 * FS, { size: 15 * FS });
        c.setLineDash([3, 4]); c.lineWidth = 1; c.strokeStyle = '#8a97ad'; c.beginPath(); c.moveTo(X0, FLOOR + 18); c.lineTo(X0, AXY - 6); c.stroke(); c.setLineDash([]);
      },
      paintBlock(g) {
        const sh = g.createRadialGradient(S / 2 + 16, S + 8, 2, S / 2 + 16, S + 8, S * 0.78);     // мягкая тень на полу
        sh.addColorStop(0, 'rgba(25,35,55,.30)'); sh.addColorStop(1, 'rgba(25,35,55,0)');
        g.save(); g.translate(0, S + 8); g.scale(1, 0.14); g.translate(0, -(S + 8)); g.fillStyle = sh; g.fillRect(0, S - 30, S + 32, 90); g.restore();
        const gr = g.createLinearGradient(0, 6, 0, S + 6); gr.addColorStop(0, '#5b9dff'); gr.addColorStop(1, '#2a62d9');
        rr(g, 16, 6, S, S, 9); g.fillStyle = gr; g.fill(); g.strokeStyle = '#1c47a8'; g.lineWidth = 1.3; g.stroke();
        rr(g, 17.5, 7.5, S - 3, S - 3, 8); g.strokeStyle = 'rgba(255,255,255,.38)'; g.lineWidth = 1; g.stroke();
        tex(g, 'm', 16 + S / 2, 6 + S / 2 + 9, { size: 28, align: 'center', color: '#ffffff' });
      },
      // кадр: сдвигаем груз, указатель и точку; перерисовываем только пружину и (если включены) векторы
      update(s, d, o) {
        const xc = X0 + s.x * PXM, left = xc - S / 2;
        const sn = (v) => Math.round(v * dprN) / dprN;                  // сдвиг по целым пикселям экрана: картинка груза не «мылится» и не дрожит на дробных позициях
        blk.style.transform = `translate3d(${sn((left - 16) * f)}px,0,0)`;
        const gx = sn(xc * f); guide.style.transform = `translate3d(${gx}px,0,0)`; dot.style.transform = `translate3d(${gx}px,0,0)`;
        sprC.clearRect(0, SPR.top, SW, SPR.h); zigzag(sprC, WALL, left, SPY, { peaks: 10, amp: 13, lead: 0 });
        const any = o.v || o.a || o.F;
        if (any !== vecOn) { vecOn = any; vec.style.display = any ? '' : 'none'; if (!any) vecC.clearRect(0, VEC.top, SW, VEC.h); }
        if (!any) return;
        vecC.clearRect(0, VEC.top, SW, VEC.h);
        const top = FLOOR - S - 12, L = 80, lw = 2.3;
        const draw = (val, max, y, color, img, w) => { const l = (val / max) * L; arrow(vecC, xc, y, xc + l, y, { color, lw, head: 10 }); vecC.drawImage(img, l >= 0 ? xc + l + 3 : xc + l - w - 9, y - 18, 80, 30); };   // w — ширина надписи, чтобы она не налезала на стрелку
        if (o.v) draw(s.v, d.vmax, top - 22, COL.v, labels.v, 10);
        if (o.a) draw(s.a, d.amax, top - 48, COL.a, labels.a, 10);
        if (o.F) draw(s.a, d.amax, top - 74, COL.F, labels.F, 36 * FS);
      },
    };
    vec.style.display = 'none';
    return api;
  },
};

// Оттянуть груз мышью: попадание в груз и перевод положения указателя в амплитуду и фазу
spring.grab = {
  hit: (p, d, s, lx, ly) => { const xc = X0 + s.x * PXM; return Math.abs(lx - xc) < S / 2 + 16 && ly > FLOOR - S - 24 && ly < FLOOR + 10; },
  to: (p, lx) => { const x = Math.max(-0.15, Math.min(0.15, (lx - X0) / PXM)), A = Math.max(0.02, Math.abs(x)); return { A: Math.round(A * 100) / 100, phi: x < 0 ? 1 : 0 }; },
};
