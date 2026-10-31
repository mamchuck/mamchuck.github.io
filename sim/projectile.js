// Сцена «Бросок под углом»: тело брошено с высоты h₀ со скоростью v₀ под углом α к горизонту, сопротивления воздуха нет, g = 10 м/с².
// Решение точное: x = v₀cosα·t, y = h₀ + v₀sinα·t − gt²/2. Масштаб подгоняется под траекторию, чтобы она всегда занимала сцену.
// Слои: фон (сетка, оси, пунктир траектории), сплошная траектория (открывается обрезкой), шарик и векторы (сдвигаются).
import { fmt, tex, arrow, hatch, sprite } from './tex.js?v=202610311615';

const PI = Math.PI, G = 10;
const el = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };
export const COLP = { x: '#1b2330', y: '#0b7285', vx: '#e8590c', vy: '#2563eb', v: '#1f9d55', g: '#d6336c' };

// Геометрия сцены (логические единицы 520×400)
const SW = 520, SH = 400, AXX = 40, ORX = 72, GY = 326, PW = 404, PHT = 246, TOPY = 54, VS = 200;
const NICE = [1, 2, 5, 10, 20, 50, 100, 200];
const step = (sc) => NICE.find((n) => n * sc >= 44) || 200;

export const projectile = {
  id: 'projectile',
  title: 'Бросок под углом',
  lead: 'Меняй скорость, угол и высоту броска и смотри траекторию. По горизонтали тело летит равномерно, по вертикали — с ускорением g = 10 м/с². Включи составляющие скорости, чтобы увидеть это.',
  stage: { w: SW, h: SH, label: 'Тело летит по параболе под действием силы тяжести' },
  speed: 1,
  hold: 0.9,
  params: [
    { id: 'v0', name: 'Начальная скорость', tex: 'v_0', unit: 'м/с', min: 5, max: 30, step: 1, def: 20, dec: 0 },
    { id: 'alpha', name: 'Угол к горизонту', tex: '\\alpha', unit: '°', min: 5, max: 89, step: 1, def: 45, dec: 0 },
    { id: 'h0', name: 'Начальная высота', tex: 'h_0', unit: 'м', min: 0, max: 20, step: 1, def: 0, dec: 0 },
  ],
  derive(p) {
    const a = (p.alpha * PI) / 180, vx = p.v0 * Math.cos(a), vy0 = p.v0 * Math.sin(a), h0 = p.h0;
    const tUp = vy0 / G, H = h0 + (vy0 * vy0) / (2 * G), Tf = (vy0 + Math.sqrt(vy0 * vy0 + 2 * G * h0)) / G, L = vx * Tf;
    const vyEnd = vy0 - G * Tf, vEnd = Math.hypot(vx, vyEnd);
    return { vx, vy0, tUp, H, Tf, L, vyEnd, vEnd, v0: p.v0, h0, beta: (Math.atan2(Math.abs(vyEnd), vx) * 180) / PI, ymax: Math.max(Math.abs(vy0), Math.abs(vyEnd)) };
  },
  window: (d) => d.Tf,
  axisMarks: (d) => [
    ...(d.tUp > 0.04 * d.Tf && d.tUp < 0.96 * d.Tf ? [{ t: d.tUp, tex: 't_\\text{в}', canvas: 't_{в}' }] : []),
    { t: d.Tf, tex: 't_\\text{п}', canvas: 't_{п}' },
  ],
  at(p, d, t) {
    const tt = Math.min(Math.max(t, 0), d.Tf), x = d.vx * tt, y = Math.max(0, d.h0 + d.vy0 * tt - (G * tt * tt) / 2), vy = d.vy0 - G * tt;
    return { x, y, vx: d.vx, vy, speed: Math.hypot(d.vx, vy) };
  },
  marks: (p, d) => [...(d.tUp > 0.04 * d.Tf && d.tUp < 0.96 * d.Tf ? [{ t: d.tUp, kind: 'ext' }] : []), { t: d.Tf, kind: 'eq' }],
  panels: [
    { id: 'x', tex: 'x', label: 'x', unit: 'м', signed: false, on: true, max: (p, d) => Math.max(d.L, 1), curves: (S_) => [{ f: (t) => S_.at(t).x, color: COLP.x }] },
    { id: 'y', tex: 'y', label: 'y', unit: 'м', signed: false, on: true, max: (p, d) => Math.max(d.H, 1), curves: (S_) => [{ f: (t) => S_.at(t).y, color: COLP.y }] },
    { id: 'vx', tex: 'v_x', label: 'v_x', unit: 'м/с', signed: false, on: false, max: (p, d) => Math.max(d.vx, 1), curves: (S_) => [{ f: (t) => S_.at(t).vx, color: COLP.vx }] },
    { id: 'vy', tex: 'v_y', label: 'v_y', unit: 'м/с', signed: true, on: true, max: (p, d) => Math.max(d.ymax, 1), curves: (S_) => [{ f: (t) => S_.at(t).vy, color: COLP.vy }] },
    { id: 'v', tex: 'v', label: 'v', unit: 'м/с', signed: false, on: false, max: (p, d) => Math.max(p.v0, d.vEnd), curves: (S_) => [{ f: (t) => S_.at(t).speed, color: COLP.v }] },
  ],
  toggles: [{ id: 'v', name: 'Скорость', color: COLP.v }, { id: 'c', name: 'Составляющие', color: COLP.vx }, { id: 'g', name: 'Сила тяжести', color: COLP.g }],
  table: {
    cols: ['x', 'y', 'v_x', 'v_y', '|v|'],
    units: ['м', 'м', 'м/с', 'м/с', 'м/с'],
    rows: [
      { id: 'start', color: '#1f9d55', name: 'Старт', vals: (p, d) => [0, d.h0, d.vx, d.vy0, p.v0], test: (s, p, d, t) => t < 0.02 * d.Tf },
      { id: 'apex', color: '#f08a00', name: 'Вершина', vals: (p, d) => [d.vx * d.tUp, d.H, d.vx, 0, d.vx], test: (s, p, d, t) => d.tUp > 0.04 * d.Tf && Math.abs(t - d.tUp) < 0.03 * d.Tf },
      { id: 'land', color: '#2563eb', name: 'Падение', vals: (p, d) => [d.L, 0, d.vx, d.vyEnd, d.vEnd], test: (s, p, d, t) => t > 0.985 * d.Tf },
    ],
    now: (s) => [s.x, s.y, s.vx, s.vy, s.speed],
    note: 'Строка подсвечивается, когда тело проходит это положение. На графиках такие моменты отмечены вертикалями: оранжевая — вершина, синяя — падение. В вершине вертикальная скорость равна нулю, а горизонтальная не меняется никогда.',
  },
  readouts: (p, d) => [['Время подъёма', 't_\\text{в}', `${fmt(d.tUp, 2)} с`], ['Время полёта', 't_\\text{п}', `${fmt(d.Tf, 2)} с`], ['Наибольшая высота', 'H', `${fmt(d.H, 1)} м`],
    ['Дальность', 'L', `${fmt(d.L, 1)} м`], ['Скорость при падении', 'v_\\text{к}', `${fmt(d.vEnd, 1)} м/с`], ['Угол падения', '\\beta', `${fmt(d.beta, 0)}°`]],
  formulas: [
    { tag: 'Координаты', color: '#1b2330', tex: 'x = v_0\\cos\\alpha\\cdot t,\\qquad y = h_0 + v_0\\sin\\alpha\\cdot t - \\dfrac{gt^2}{2}' },
    { tag: 'Скорость', color: '#2563eb', tex: 'v_x = v_0\\cos\\alpha,\\qquad v_y = v_0\\sin\\alpha - gt' },
    { tag: 'Дальность и высота при h₀ = 0', color: '#f08a00', tex: 'L = \\dfrac{v_0^2\\sin 2\\alpha}{g},\\qquad H = \\dfrac{v_0^2\\sin^2\\alpha}{2g}' },
  ],

  mount(box, P0) {
    const bg = el('sm-sbg', 'canvas'), traj = el('sm-traj', 'canvas'), ball = el('sm-ball', 'canvas'), vec = el('sm-pvec', 'canvas');
    box.prepend(bg, traj, ball, vec);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label);
    [bg, traj, ball, vec].forEach((e) => e.setAttribute('aria-hidden', 'true'));
    let P = P0, d = projectile.derive(P0), f = 1, k = 1, dprN = 1, vecC = null, labels = null, sc = 1, vecOn = false, lastKey = '';
    const X = (x) => ORX + x * sc, Y = (y) => GY - y * sc;
    const setup = (cv) => {                                          // холст на всю сцену: пиксели по размеру, координаты — логические
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.2e6 / (cssW * (cssW * SH / SW)))));
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(((cssW * SH) / SW) * dpr);
      const g = cv.getContext('2d'); g.setTransform(cv.width / SW, 0, 0, cv.height / SH, 0, 0); return g;
    };
    const path = (g, t1) => { g.beginPath(); const n = 160; for (let i = 0; i <= n; i++) { const t = (t1 * i) / n, s = projectile.at(P, d, t); i ? g.lineTo(X(s.x), Y(s.y)) : g.moveTo(X(s.x), Y(s.y)); } };

    const paintBg = (c) => {
      sc = Math.min(PW / Math.max(d.L, 1), PHT / Math.max(d.H, 1)) * 0.96;
      c.clearRect(0, 0, SW, SH);
      const st = step(sc), xmax = (SW - 16 - ORX) / sc, ymax = (GY - TOPY) / sc;
      c.lineWidth = 1; c.strokeStyle = '#e1e7f1'; c.beginPath();
      for (let x = st; x <= xmax; x += st) { c.moveTo(X(x) + 0.5, GY); c.lineTo(X(x) + 0.5, TOPY); }
      for (let y = st; y <= ymax; y += st) { c.moveTo(AXX, Y(y) + 0.5); c.lineTo(SW - 16, Y(y) + 0.5); }
      c.stroke();
      // опора, если бросок с высоты
      if (d.h0 > 0) { const top = Y(d.h0); c.fillStyle = 'rgba(160,172,192,.35)'; c.fillRect(ORX - 26, top, 26, GY - top); hatch(c, ORX - 26, top, 26, GY - top, 7, { color: '#8793a8', lw: 1 }); c.strokeStyle = '#3b4658'; c.lineWidth = 2; c.beginPath(); c.moveTo(ORX - 26, top); c.lineTo(ORX, top); c.stroke(); }
      // земля
      c.fillStyle = 'rgba(160,172,192,.3)'; c.fillRect(AXX, GY, SW - 16 - AXX, 12); hatch(c, AXX, GY, SW - 16 - AXX, 12, 7, { color: '#9aa5b8', lw: 0.9 });
      c.strokeStyle = '#3b4658'; c.lineWidth = 2; c.beginPath(); c.moveTo(AXX, GY); c.lineTo(SW - 16, GY); c.stroke();
      // ось y со стрелкой, деления и подписи
      arrow(c, AXX, GY, AXX, TOPY - 8, { lw: 1.4, head: 8, color: '#2a3140' });
      c.strokeStyle = '#2a3140'; c.lineWidth = 1.3; c.beginPath();
      for (let y = st; y <= ymax - 4 / sc; y += st) { c.moveTo(AXX - 4, Y(y)); c.lineTo(AXX + 4, Y(y)); }
      for (let x = 0; x <= xmax; x += st) { c.moveTo(X(x), GY - 4); c.lineTo(X(x), GY + 4); }
      c.stroke();
      for (let y = 0; y <= ymax - 4 / sc; y += st) tex(c, fmt(y, 0), AXX - 8, Y(y) + 4, { size: 12, align: 'right', color: '#3b475c' });
      for (let x = 0; x <= xmax; x += st) tex(c, fmt(x, 0), X(x), GY + 27, { size: 12, align: 'center', color: '#3b475c' });
      tex(c, 'y, м', AXX + 8, TOPY - 2, { size: 14 }); tex(c, 'x, м', SW - 18, GY - 10, { size: 14, align: 'right' });
      // пунктир всей траектории, вершина и точка падения
      c.setLineDash([5, 4]); c.strokeStyle = '#94a3b8'; c.lineWidth = 1.6; path(c, d.Tf); c.stroke(); c.setLineDash([]);
      const ax = X(d.vx * d.tUp), ay = Y(d.H);
      if (d.tUp > 0.04 * d.Tf && d.tUp < 0.96 * d.Tf) {
        c.setLineDash([3, 4]); c.strokeStyle = '#f08a00'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax, GY); c.stroke(); c.setLineDash([]);
        c.fillStyle = '#f08a00'; c.beginPath(); c.arc(ax, ay, 4, 0, 7); c.fill(); tex(c, 'H', ax + 8, (ay + GY) / 2, { size: 15, color: '#c2410c' });
      }
      const lx = X(d.L); c.fillStyle = '#2563eb'; c.beginPath(); c.arc(lx, GY, 4, 0, 7); c.fill(); tex(c, 'L', lx - 4, GY - 10, { size: 15, color: '#1d4ed8', align: 'right' });
    };
    const paintTraj = (g) => { g.clearRect(0, 0, SW, SH); g.strokeStyle = COLP.y; g.lineWidth = 2.8; g.lineJoin = g.lineCap = 'round'; path(g, d.Tf); g.stroke(); };

    const api = {
      resize() {
        const cssW = box.clientWidth || SW; f = cssW / SW; dprN = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.2e6 / (cssW * ((cssW * SH) / SW))))); k = (cssW * dpr) / SW;
        const sz = (cv, w, h) => { cv.style.width = `${(w / SW) * 100}%`; cv.style.height = `${(h / SH) * 100}%`; };
        // шарик
        sz(ball, 28, 28); ball.width = Math.ceil(28 * k); ball.height = Math.ceil(28 * k);
        const g = ball.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
        const rg = g.createRadialGradient(11, 10, 1, 14, 14, 11); rg.addColorStop(0, '#9cc2ff'); rg.addColorStop(1, '#2a62d9');
        g.beginPath(); g.arc(14, 14, 10.5, 0, 7); g.fillStyle = rg; g.fill(); g.strokeStyle = '#1c47a8'; g.lineWidth = 1.4; g.stroke();
        // векторы: небольшой холст вокруг шарика, он едет вместе с ним
        sz(vec, VS, VS); vec.width = Math.ceil(VS * k); vec.height = Math.ceil(VS * k); vecC = vec.getContext('2d'); vecC.setTransform(k, 0, 0, k, 0, 0);
        const lab = (src, color) => sprite(60, 28, k, (gg) => { tex(gg, src, 6, 20, { size: 16, color }); });
        labels = { v: lab('\\v{v}', COLP.v), vx: lab('\\v{v}_x', COLP.vx), vy: lab('\\v{v}_y', COLP.vy), g: lab('\\v{g}', COLP.g) };
        const a = setup(bg), b = setup(traj); paintBg(a); paintTraj(b); lastKey = '';
      },
      params(p) { P = p; d = projectile.derive(p); const a = setup(bg), b = setup(traj); paintBg(a); paintTraj(b); lastKey = ''; },
      update(s, dd, o) {
        const sn = (v) => Math.round(v * dprN) / dprN, bx = X(s.x), by = Y(s.y);
        ball.style.transform = `translate3d(${sn((bx - 14) * f)}px,${sn((by - 14) * f)}px,0)`;
        traj.style.clipPath = `inset(0 ${Math.max(0, (SW - bx - 4) * f)}px 0 0)`;
        const any = o.v || o.c || o.g;
        if (any !== vecOn) { vecOn = any; vec.style.display = any ? '' : 'none'; lastKey = ''; }
        if (!any) return;
        vec.style.transform = `translate3d(${sn((bx - VS / 2) * f)}px,${sn((by - VS / 2) * f)}px,0)`;
        const key = `${s.vx.toFixed(2)}|${s.vy.toFixed(2)}|${o.v}|${o.c}|${o.g}`; if (key === lastKey) return; lastKey = key;
        const c = vecC, h = VS / 2, kv = 70 / Math.max(P.v0, d.vEnd), ex = h + s.vx * kv, ey = h - s.vy * kv;
        c.clearRect(0, 0, VS, VS);
        if (o.c) {
          c.setLineDash([3, 3]); c.strokeStyle = 'rgba(100,116,139,.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex, h); c.moveTo(ex, ey); c.lineTo(h, ey); c.stroke(); c.setLineDash([]);
          arrow(c, h, h, ex, h, { color: COLP.vx, lw: 2.2, head: 9 }); c.drawImage(labels.vx, ex - 20, h + 6, 60, 28);
          arrow(c, h, h, h, ey, { color: COLP.vy, lw: 2.2, head: 9 }); c.drawImage(labels.vy, h - 38, ey - 14, 60, 28);
        }
        if (o.v) { arrow(c, h, h, ex, ey, { color: COLP.v, lw: 2.6, head: 10 }); c.drawImage(labels.v, ex + 4, ey - 24, 60, 28); }
        if (o.g) { arrow(c, h, h, h, h + 38, { color: COLP.g, lw: 2.2, head: 9 }); c.drawImage(labels.g, h + 2, h + 24, 60, 28); }
      },
    };
    vec.style.display = 'none';
    return api;
  },
};
