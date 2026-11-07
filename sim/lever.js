// Сцена «Рычаг и правило моментов»: невесомая (почти) балка на опоре, слева и справа подвешены грузы.
// Условие равновесия: M₁ = M₂, то есть m₁·l₁ = m₂·l₂ (F₁/F₂ = l₂/l₁). При l в дециметрах и g = 10 м/с² момент в Н·м численно равен m·l.
// Если моменты не равны, балка поворачивается в сторону большего момента (с затуханием) и упирается в ограничитель. Грузы можно двигать мышью вдоль балки.
import { fmt, tex, arrow, rr, math as mathHtml } from './tex.js?v=202611071149';

const SW = 520, SH = 400, PX = 260, PY = 176, UNIT = 40, TMAX = (15 * Math.PI) / 180, G = 10, HANG = 38;
const COLL = { m1: '#2563eb', m2: '#e8590c', arm: '#1f9d55' };
let cur = 0, grab = 0;                                                          // текущий угол и какой груз тянут (для перетаскивания)

export const lever = {
  id: 'lever',
  mode: 'free',
  title: 'Рычаг и правило моментов',
  lead: 'Подвесь грузы слева и справа и подбери плечи так, чтобы рычаг уравновесился. Грузы можно двигать мышью вдоль балки. Условие равновесия: моменты сил равны, M₁ = M₂.',
  stage: { w: SW, h: SH, label: 'Рычаг на опоре с двумя грузами' },
  params: [
    { id: 'm1', name: 'Масса левого груза', tex: 'm_1', unit: 'кг', min: 1, max: 10, step: 1, def: 4, dec: 0 },
    { id: 'l1', name: 'Плечо слева', tex: 'l_1', unit: 'дм', min: 0.5, max: 5, step: 0.5, def: 3, dec: 1 },
    { id: 'm2', name: 'Масса правого груза', tex: 'm_2', unit: 'кг', min: 1, max: 10, step: 1, def: 6, dec: 0 },
    { id: 'l2', name: 'Плечо справа', tex: 'l_2', unit: 'дм', min: 0.5, max: 5, step: 0.5, def: 2, dec: 1 },
  ],
  toggles: [{ id: 'f', name: 'Силы и плечи', color: '#1f9d55', on: true }],
  actions: [
    { id: 'bal', group: 'Опыты', label: 'Уравновесить', color: '#1f9d55' },
    { id: 'gain', group: 'Опыты', label: 'Выигрыш в силе', color: '#2563eb' },
    { id: 'eq', group: 'Опыты', label: 'Одинаковые грузы', color: '#e8590c' },
  ],
  act(id, p) {
    if (id === 'gain') return { set: { m1: 10, l1: 1, m2: 2, l2: 5 } };
    if (id === 'eq') return { set: { m1: 5, l1: 3, m2: 5, l2: 3 } };
    const M = p.m1 * p.l1, l2 = M / p.m2;                                       // подбираем плечо справа; если оно не помещается — меняем массу правого груза
    if (l2 >= 0.5 && l2 <= 5 && Math.abs(l2 * 2 - Math.round(l2 * 2)) < 1e-9) return { set: { l2 } };
    for (let m2 = 1; m2 <= 10; m2++) { const l = M / m2; if (l >= 0.5 && l <= 5 && Math.abs(l * 2 - Math.round(l * 2)) < 1e-9) return { set: { m2, l2: l } }; }
    return { set: { m1: 4, l1: 3, m2: 6, l2: 2 } };
  },
  derive(p) {
    const M1 = p.m1 * p.l1, M2 = p.m2 * p.l2, net = M2 - M1, bal = Math.abs(net) < 1e-9;
    return { M1, M2, net, bal, F1: p.m1 * G, F2: p.m2 * G, gain: (p.m2 * G) / (p.m1 * G) };
  },
  readouts: (p, d) => [['Момент слева', 'M_1 = F_1 l_1', `${fmt(d.M1, 1)} Н·м`], ['Момент справа', 'M_2 = F_2 l_2', `${fmt(d.M2, 1)} Н·м`], ['Равновесие', '', d.bal ? 'есть: M₁ = M₂' : d.net > 0 ? 'перевешивает правая сторона' : 'перевешивает левая сторона'],
    ['Отношение сил', 'F_1/F_2', fmt(d.F1 / d.F2, 2)], ['Отношение плеч', 'l_2/l_1', fmt(p.l2 / p.l1, 2)]],
  formulas: [
    { tag: 'Момент силы', color: '#2563eb', tex: 'M = F\\,l,\\qquad l\\ \\text{— плечо}' },
    { tag: 'Условие равновесия', color: '#1f9d55', tex: 'M_1 = M_2\\ \\Leftrightarrow\\ \\dfrac{F_1}{F_2} = \\dfrac{l_2}{l_1}' },
    { tag: 'Золотое правило механики', color: '#e8590c', tex: 'A_1 = A_2:\\quad \\text{выигрыш в силе} = \\text{проигрыш в пути}' },
  ],
  note: 'Плечо — кратчайшее расстояние от оси до линии действия силы (у нас силы вертикальны, поэтому берётся горизонтальное расстояние). Чем больше плечо, тем меньшая сила нужна, чтобы уравновесить рычаг.',
  info(p, d) {
    return `<div class="sm-big" style="font-size:24px;color:${d.bal ? '#1f9d55' : 'inherit'}">${d.bal ? 'Рычаг в равновесии' : d.net > 0 ? 'Вправо тяжелее' : 'Влево тяжелее'}</div>
      <div><span class="sm-chip">M₁ = ${fmt(d.M1, 1)} Н·м · M₂ = ${fmt(d.M2, 1)} Н·м</span></div>
      <table class="sm-it"><tr><td>F₁ = m₁g</td><td>${fmt(d.F1, 0)} Н</td></tr><tr><td>F₂ = m₂g</td><td>${fmt(d.F2, 0)} Н</td></tr><tr><td>l₁ / l₂</td><td>${fmt(p.l1, 1)} дм / ${fmt(p.l2, 1)} дм</td></tr><tr><td>Выигрыш в силе</td><td>${fmt(Math.max(d.F1, d.F2) / Math.min(d.F1, d.F2), 2)}</td></tr></table>
      <div class="sm-eq">Пример: ${fmt(p.m1, 0)}·${fmt(p.l1, 1)} ${d.bal ? '=' : d.net > 0 ? '<' : '>'} ${fmt(p.m2, 0)}·${fmt(p.l2, 1)}<small>${d.bal ? 'Моменты равны — балка горизонтальна.' : 'Балка повернётся в сторону большего момента.'}</small></div>`;
  },

  mount(box, P0) {
    const cv = document.createElement('canvas'); cv.className = 'sm-sbg'; box.prepend(cv);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label); cv.setAttribute('aria-hidden', 'true');
    let P = P0, d = lever.derive(P0), th = 0, om = 0, on = true, lastT = null, moving = false;
    const setup = () => {
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.4e6 / (cssW * ((cssW * SH) / SW)))));
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(((cssW * SH) / SW) * dpr);
      const g = cv.getContext('2d'); g.setTransform(cv.width / SW, 0, 0, cv.height / SH, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round'; return g;
    };
    const pt = (u) => [PX + u * UNIT * Math.cos(th), PY + u * UNIT * Math.sin(th)];             // точка на балке на расстоянии u (в дм) от опоры, + вправо
    const block = (c, x, y, m, col) => {                                                        // груз на нити: размер растёт с массой
      const w = 20 + 4.2 * m, h = 16 + 3.2 * m; c.strokeStyle = '#2a3140'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + HANG); c.stroke();
      rr(c, x - w / 2, y + HANG, w, h, 6); const g = c.createLinearGradient(0, y + HANG, 0, y + HANG + h); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,.25)'); c.fillStyle = col; c.fill(); c.fillStyle = g; c.fill(); c.strokeStyle = '#1b2330'; c.lineWidth = 1.6; c.stroke();
      tex(c, `${fmt(m, 0)} кг`, x, y + HANG + h / 2 + 5, { size: 14, align: 'center', color: '#fff' }); return [y + HANG + h, h];
    };
    const paint = () => {
      const c = setup(); c.clearRect(0, 0, SW, SH);
      // опора и ограничители
      c.fillStyle = '#c5ccd8'; c.beginPath(); c.moveTo(PX, PY + 4); c.lineTo(PX - 34, PY + 150); c.lineTo(PX + 34, PY + 150); c.closePath(); c.fill(); c.strokeStyle = '#2a3140'; c.lineWidth = 2.2; c.stroke();
      c.fillStyle = '#9aa5b8'; c.fillRect(PX - 120, PY + 150, 240, 12); c.strokeStyle = '#2a3140'; c.lineWidth = 2; c.strokeRect(PX - 120, PY + 150, 240, 12);
      // балка с делениями через 1 дм
      const [ax, ay] = pt(-5.35), [bx, by] = pt(5.35);
      c.strokeStyle = '#8a6a2b'; c.lineWidth = 14; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.strokeStyle = '#e2c27d'; c.lineWidth = 11; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      c.strokeStyle = 'rgba(60,40,10,.7)'; c.lineWidth = 1.4; for (let u = -5; u <= 5; u++) { const [x, y] = pt(u); c.beginPath(); c.moveTo(x - Math.sin(th) * 4, y + Math.cos(th) * 4); c.lineTo(x + Math.sin(th) * 4, y - Math.cos(th) * 4); c.stroke(); }
      c.beginPath(); c.arc(PX, PY, 8, 0, 7); c.fillStyle = '#2a3140'; c.fill();
      // грузы; плечи — горизонтальные расстояния от опоры до линий действия сил (рисуем под грузами)
      const [x1, y1] = pt(-P.l1), [x2, y2] = pt(P.l2), ya = PY + 180;
      if (on) {
        c.strokeStyle = COLL.arm; c.lineWidth = 1.2; c.setLineDash([3, 4]); for (const x of [x1, x2]) { c.beginPath(); c.moveTo(x, PY + 60); c.lineTo(x, ya); c.stroke(); } c.setLineDash([]);
        for (const [x, n] of [[x1, 'l_1'], [x2, 'l_2']]) { arrow(c, PX, ya, x, ya, { color: COLL.arm, lw: 1.8, head: 8 }); arrow(c, x, ya, PX, ya, { color: COLL.arm, lw: 1.8, head: 8 }); tex(c, n, (PX + x) / 2, ya - 7, { size: 16, align: 'center', color: COLL.arm }); }
      }
      const [bot1] = block(c, x1, y1, P.m1, COLL.m1), [bot2] = block(c, x2, y2, P.m2, COLL.m2);
      if (on) {
        const af = (x, y, F, col) => arrow(c, x, y, x, y + Math.min(60, 18 + F * 0.55), { color: col, lw: 3, head: 11 });
        af(x1, bot1 + 2, d.F1, COLL.m1); af(x2, bot2 + 2, d.F2, COLL.m2);
        tex(c, `F_1 = ${fmt(d.F1, 0)} Н`, x1 + 10, bot1 + 30, { size: 15, color: COLL.m1 }); tex(c, `F_2 = ${fmt(d.F2, 0)} Н`, x2 - 10, bot2 + 30, { size: 15, align: 'right', color: COLL.m2 });
      }
    };
    const api = {
      resize() { paint(); },
      params(p, dd) { P = p; d = dd; moving = true; paint(); },
      update(dd, flags, t) {
        d = dd; if (!!flags.f !== on) { on = !!flags.f; paint(); }
        const dt = lastT === null ? 0 : Math.min(0.04, Math.max(0, t - lastT)); lastT = t; if (!moving) return;
        const I = (P.m1 * P.l1 * P.l1 + P.m2 * P.l2 * P.l2) / 100 + 0.35, al = ((d.net * Math.cos(th)) / I) * 0.35;      // момент силы тяжести, замедленный для наглядности
        om += (al - 4.2 * om) * dt; th += om * dt;
        if (th > TMAX) { th = TMAX; om = om > 0.6 ? -om * 0.2 : 0; } else if (th < -TMAX) { th = -TMAX; om = om < -0.6 ? -om * 0.2 : 0; }      // упёрлась в ограничитель
        if (d.bal) { om += -9 * th * dt; if (Math.abs(th) < 0.0008 && Math.abs(om) < 0.01) { th = 0; om = 0; moving = false; } }
        else if (Math.abs(th) >= TMAX - 1e-9 && om === 0 && Math.sign(al) === Math.sign(th)) moving = false;
        cur = th; paint();
      },
      busy: () => moving,
      animate() {},
    };
    return api;
  },
};
lever.drag = {
  hit: (p, d, x, y) => {
    const near = (u) => { const px = PX + u * UNIT * Math.cos(cur), py = PY + u * UNIT * Math.sin(cur) + HANG + 20; return Math.abs(x - px) < 34 && Math.abs(y - py) < 46; };
    grab = near(-p.l1) ? 1 : near(p.l2) ? 2 : 0; return grab !== 0;
  },
  to: (p, x) => { const l = Math.max(0.5, Math.min(5, Math.round((Math.abs(x - PX) / UNIT) * 2) / 2)); return grab === 1 ? { l1: l } : { l2: l }; },
};
