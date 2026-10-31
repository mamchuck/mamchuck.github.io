// Сцена «Атом и ядро»: конструктор атома (протоны Z, нейтроны N, заряд иона q) и радиоактивные превращения (α-, β⁻-, β⁺-распад, γ-излучение).
// Всё считается точно по законам сохранения заряда и массового числа; электроны на оболочках раскладываются по правилу Маделунга.
import { fmt, tex, math as mathHtml, sprite } from './tex.js?v=202611010200';

const el = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls; return e; };
const SW = 520, SH = 400, CX = 260, CY = 200, ZMAX = 94, NMAX = 146;
const SYM = ['', 'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn', 'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu'];
const NAME = ['', 'Водород', 'Гелий', 'Литий', 'Бериллий', 'Бор', 'Углерод', 'Азот', 'Кислород', 'Фтор', 'Неон', 'Натрий', 'Магний', 'Алюминий', 'Кремний', 'Фосфор', 'Сера', 'Хлор', 'Аргон', 'Калий', 'Кальций', 'Скандий', 'Титан', 'Ванадий', 'Хром', 'Марганец', 'Железо', 'Кобальт', 'Никель', 'Медь', 'Цинк', 'Галлий', 'Германий', 'Мышьяк', 'Селен', 'Бром', 'Криптон', 'Рубидий', 'Стронций', 'Иттрий', 'Цирконий', 'Ниобий', 'Молибден', 'Технеций', 'Рутений', 'Родий', 'Палладий', 'Серебро', 'Кадмий', 'Индий', 'Олово', 'Сурьма', 'Теллур', 'Иод', 'Ксенон', 'Цезий', 'Барий', 'Лантан', 'Церий', 'Празеодим', 'Неодим', 'Прометий', 'Самарий', 'Европий', 'Гадолиний', 'Тербий', 'Диспрозий', 'Гольмий', 'Эрбий', 'Тулий', 'Иттербий', 'Лютеций', 'Гафний', 'Тантал', 'Вольфрам', 'Рений', 'Осмий', 'Иридий', 'Платина', 'Золото', 'Ртуть', 'Таллий', 'Свинец', 'Висмут', 'Полоний', 'Астат', 'Радон', 'Франций', 'Радий', 'Актиний', 'Торий', 'Протактиний', 'Уран', 'Нептуний', 'Плутоний'];

// Электроны по оболочкам (правило Маделунга, с исключениями для Cr и Cu): [2, 8, 8, 2] и т. д.
const SUB = [[1, 2], [2, 2], [2, 6], [3, 2], [3, 6], [4, 2], [3, 10], [4, 6], [5, 2], [4, 10], [5, 6], [6, 2], [4, 14], [5, 10], [6, 6], [7, 2], [5, 14], [6, 10], [7, 6]];
export function shellsOf(e, Z) {
  if (Z === 24 && e === 24) return [2, 8, 13, 1];
  if (Z === 29 && e === 29) return [2, 8, 18, 1];
  const out = []; let left = e;
  for (const [n, cap] of SUB) { if (left <= 0) break; const k = Math.min(cap, left); out[n - 1] = (out[n - 1] || 0) + k; left -= k; }
  return out.map((v) => v || 0);
}
const stableZ = (A) => A / (1.98 + 0.0155 * Math.pow(A, 2 / 3));                      // линия устойчивости (оценка)
const nuc = (A, Z, s) => `{}^{${A}}_{${Z}}\\text{${s}}`;

export const atom = {
  id: 'atom',
  mode: 'free',
  title: 'Атом и ядро',
  lead: 'Собери атом из протонов, нейтронов и электронов и посмотри, как это записывается. Потом запусти радиоактивный распад: заряд и массовое число всегда сохраняются.',
  stage: { w: SW, h: SH, label: 'Модель атома: ядро из протонов и нейтронов и электроны на оболочках' },
  animated: true,
  animMs: 1300,
  params: [
    { id: 'Z', name: 'Протоны (заряд ядра)', tex: 'Z', unit: '', min: 1, max: ZMAX, step: 1, def: 6, dec: 0 },
    { id: 'N', name: 'Нейтроны', tex: 'N', unit: '', min: 0, max: NMAX, step: 1, def: 6, dec: 0 },
    { id: 'q', name: 'Заряд атома (иона)', tex: 'q', unit: 'e', min: -3, max: 6, step: 1, def: 0, dec: 0, fmt: (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0') },
  ],
  derive(p) {
    const Z = p.Z, N = p.N, A = Z + N, q = Math.min(p.q, Z), e = Math.max(0, Z - q), shells = shellsOf(e, Z), zs = stableZ(A);
    return { Z, N, A, q, e, shells, sym: SYM[Z], name: NAME[Z], drawShells: Z <= 54 && shells.length <= 4 && e > 0, stable: Z <= 83 && A > 0 && Math.abs(Z - zs) <= 1.6 + 0.02 * Z };
  },
  readouts: (p, d) => [['Заряд ядра', 'q_\\text{я}', `+${d.Z} e`], ['Массовое число', 'A = Z + N', `${d.A}`], ['Электронов', 'N_e', `${d.e}`],
    ['Заряд атома (иона)', 'q', d.q > 0 ? `+${d.q} e` : d.q < 0 ? `−${-d.q} e` : '0'], ['Изотоп', '', `${d.name}-${d.A}`]],
  formulas: [
    { tag: 'Массовое число', color: '#1b2330', tex: 'A = Z + N' },
    { tag: 'Заряд иона', color: '#2563eb', tex: 'q = (Z - N_e)\\,e' },
    { tag: 'Распады: сохраняются Z и A', color: '#d6336c', tex: '\\begin{array}{l}\\alpha:\\ {}^{A}_{Z}X \\to {}^{A-4}_{Z-2}Y + {}^{4}_{2}\\text{He}\\\\[2pt]\\beta^-:\\ {}^{A}_{Z}X \\to {}^{\\ A}_{Z+1}Y + {}^{\\ 0}_{-1}e + \\bar\\nu_e\\end{array}' },
  ],
  note: 'Нейтральный атом: число электронов равно числу протонов. Изотопы одного элемента отличаются числом нейтронов, а химические свойства определяет Z.',
  actions: [
    { id: 'alpha', group: 'Распад', label: 'α-распад', color: '#d6336c' }, { id: 'beta-', group: 'Распад', label: 'β⁻-распад', color: '#2563eb' },
    { id: 'beta+', group: 'Распад', label: 'β⁺-распад', color: '#7048e8' }, { id: 'gamma', group: 'Распад', label: 'γ-излучение', color: '#e8590c' },
    ...[['H-1', 1, 0], ['H-2', 1, 1], ['He-4', 2, 2], ['C-12', 6, 6], ['C-14', 6, 8], ['O-16', 8, 8], ['Fe-56', 26, 30], ['Ra-226', 88, 138], ['U-238', 92, 146]].map(([l, Z, N]) => ({ id: `p:${Z}:${N}`, group: 'Примеры', label: l, color: '#1f9d55' })),
  ],
  act(id, p, d) {
    if (id.startsWith('p:')) { const [, Z, N] = id.split(':'); return { set: { Z: +Z, N: +N, q: 0 } }; }
    const { Z, N, A, sym } = d, X = sym;
    if (id === 'alpha') {
      if (Z < 3 || N < 2) return { set: {}, log: { tex: '', check: 'α-распад невозможен: в ядре меньше 2 протонов или 2 нейтронов, которые нужно отдать' } };
      return { set: { Z: Z - 2, N: N - 2, q: 0 }, anim: 'alpha', log: { tex: `${nuc(A, Z, X)} \\to ${nuc(A - 4, Z - 2, SYM[Z - 2])} + {}^{4}_{2}\\text{He}`, check: `Заряд: ${Z} = ${Z - 2} + 2 · Масса: ${A} = ${A - 4} + 4` } };
    }
    if (id === 'beta-') {
      if (N < 1 || Z >= ZMAX) return { set: {}, log: { tex: '', check: 'β⁻-распад невозможен: нет нейтрона (или нет такого элемента в таблице сцены)' } };
      return { set: { Z: Z + 1, N: N - 1, q: 0 }, anim: 'beta-', log: { tex: `${nuc(A, Z, X)} \\to ${nuc(A, Z + 1, SYM[Z + 1])} + {}^{\\ 0}_{-1}e + \\bar{\\nu}_e`, check: `Заряд: ${Z} = ${Z + 1} + (−1) · Масса: ${A} = ${A} + 0 (нейтрон превратился в протон)` } };
    }
    if (id === 'beta+') {
      if (Z < 2 || N >= NMAX) return { set: {}, log: { tex: '', check: 'β⁺-распад невозможен: нет протона для превращения' } };
      return { set: { Z: Z - 1, N: N + 1, q: 0 }, anim: 'beta+', log: { tex: `${nuc(A, Z, X)} \\to ${nuc(A, Z - 1, SYM[Z - 1])} + {}^{\\ 0}_{+1}e + \\nu_e`, check: `Заряд: ${Z} = ${Z - 1} + 1 · Масса: ${A} = ${A} + 0 (протон превратился в нейтрон)` } };
    }
    return { set: {}, anim: 'gamma', log: { tex: `${nuc(A, Z, X)}^{*} \\to ${nuc(A, Z, X)} + \\gamma`, check: `Ядро избавилось от лишней энергии, Z = ${Z} и A = ${A} не изменились` } };
  },
  info(p, d, st) {
    const kind = d.q === 0 ? 'нейтральный атом' : d.q > 0 ? 'положительный ион (катион)' : 'отрицательный ион (анион)';
    const sh = d.e === 0 ? 'электронов нет' : d.shells.join(' · ');
    const log = st.log.length ? st.log.map((l) => `<div class="sm-eq">${l.tex ? mathHtml(l.tex) : ''}<small>${l.check}</small></div>`).join('') : '<p class="muted" style="margin:4px 0">Нажми «α-распад», «β-распад» или «γ-излучение».</p>';
    return `<div class="sm-big">${mathHtml(nuc(d.A, d.Z, d.sym))}</div>
      <div><b>${d.name}-${d.A}</b> <span class="sm-chip">${kind}</span></div>
      <table class="sm-it"><tr><td>Протоны (Z)</td><td>${d.Z}</td></tr><tr><td>Нейтроны (N)</td><td>${d.N}</td></tr><tr><td>Нуклоны (A = Z + N)</td><td>${d.A}</td></tr><tr><td>Электроны</td><td>${d.e}</td></tr></table>
      <div class="muted" style="font-size:13px">Электронные оболочки: <b style="color:var(--sm-text)">${sh}</b>${d.drawShells || d.e === 0 ? '' : ' (на рисунке не показаны)'}</div>
      <div class="muted" style="font-size:13px;margin-top:4px">Устойчивость (оценка): <b style="color:var(--sm-text)">${d.stable ? 'вероятно устойчиво' : 'неустойчиво, радиоактивно'}</b></div>
      <h4 style="margin-top:12px">Превращения</h4>${log}`;
  },

  mount(box, P0, d0) {
    const bg = el('sm-sbg', 'canvas'), orb = el('sm-orbits'), fx = el('sm-fx');
    box.prepend(bg, orb, fx);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label);
    bg.setAttribute('aria-hidden', 'true');
    let P = P0, d = d0, f = 1, k = 1, anim = null, shellEls = [];
    const RS = (i) => 66 + 36 * i;
    const full = (cv) => {
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.2e6 / (cssW * ((cssW * SH) / SW)))));
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(((cssW * SH) / SW) * dpr);
      const g = cv.getContext('2d'); g.setTransform(cv.width / SW, 0, 0, cv.height / SH, 0, 0); return g;
    };
    const ball = (c, x, y, r, c1, c2, plus) => {
      const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, c1); g.addColorStop(1, c2);
      c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(30,40,60,.35)'; c.lineWidth = 0.6; c.stroke();
      if (plus && r >= 6) { c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - r * 0.45, y); c.lineTo(x + r * 0.45, y); c.moveTo(x, y - r * 0.45); c.lineTo(x, y + r * 0.45); c.stroke(); }
    };
    const rn = () => Math.max(2.2, Math.min(9, 24 / Math.sqrt(Math.max(d.A, 1))));
    const nucleus = (c, cx, cy, Z, A, r) => {                                  // нуклоны по спирали, протоны и нейтроны вперемешку
      const pts = []; for (let i = 0; i < A; i++) { const ang = i * 2.399963, rad = r * 1.85 * Math.sqrt(i + 0.5) * 0.92; pts.push([cx + rad * Math.cos(ang), cy + rad * Math.sin(ang), Math.floor(((i + 1) * Z) / A) > Math.floor((i * Z) / A)]); }
      pts.reverse().forEach(([x, y, isP]) => ball(c, x, y, r, isP ? '#ff8f8f' : '#c9d0dc', isP ? '#d92d2d' : '#7d8799', isP));
    };
    const paint = () => {
      const c = full(bg); c.clearRect(0, 0, SW, SH);
      if (d.drawShells) d.shells.forEach((_, i) => { c.strokeStyle = '#c3cddd'; c.lineWidth = 1.2; c.beginPath(); c.arc(CX, CY, RS(i), 0, 7); c.stroke(); });
      nucleus(c, CX, CY, d.Z, d.A, rn());
      // электроны: каждая оболочка — элемент, который вращается целиком (его ведёт видеокарта)
      orb.replaceChildren(); shellEls = [];
      if (d.drawShells) d.shells.forEach((cnt, i) => {
        const w = el('sm-orbit'); w.style.left = `${(CX / SW) * 100}%`; w.style.top = `${(CY / SH) * 100}%`;
        for (let j = 0; j < cnt; j++) { const a = (j / cnt) * 2 * Math.PI + i * 0.7, dot = el('sm-electron'); dot.style.setProperty('--x', `${RS(i) * Math.cos(a)}`); dot.style.setProperty('--y', `${RS(i) * Math.sin(a)}`); w.append(dot); }
        orb.append(w); shellEls.push([w, 38 / (1 + i * 0.55) * (i % 2 ? -1 : 1)]);
      });
      sizeDots();
    };
    const sizeDots = () => { const s = Math.max(8, 10 * f); orb.style.setProperty('--f', f); orb.style.setProperty('--ds', `${s}px`); };
    const api = {
      resize() { const cssW = box.clientWidth || SW; f = cssW / SW; k = 1; paint(); },
      params(p, dd) { P = p; d = dd; paint(); },
      busy: () => !!anim,
      animate(type, t0) {
        fx.replaceChildren(); const dot = (cls) => { const e = el(cls); fx.append(e); return e; };
        anim = { type, t0, dur: 1.2, parts: [] };
        if (type === 'alpha') anim.parts.push({ e: dot('sm-fx-alpha'), ang: -0.35, v: 150 });
        else if (type === 'beta-' || type === 'beta+') { anim.parts.push({ e: dot(type === 'beta-' ? 'sm-fx-e' : 'sm-fx-pos'), ang: -0.6, v: 260 }); anim.parts.push({ e: dot('sm-fx-nu'), ang: 0.55, v: 210 }); }
        else anim.parts.push({ e: dot('sm-fx-ph'), ang: 0, v: 280 });
      },
      update(dd, o, t) {
        d = dd;
        for (const [w, speed] of shellEls) w.style.transform = `rotate(${(t * speed) % 360}deg)`;
        if (anim) {
          const u = t - anim.t0;
          if (u >= anim.dur) { fx.replaceChildren(); anim = null; return; }
          for (const pt of anim.parts) { const dist = pt.v * u * Math.min(1, 0.4 + u); pt.e.style.transform = `translate3d(${(CX + dist * Math.cos(pt.ang)) * f}px,${(CY + dist * Math.sin(pt.ang)) * f}px,0) rotate(${pt.ang}rad)`; pt.e.style.opacity = String(Math.max(0, 1 - Math.max(0, u - 0.8) / 0.4)); }
        }
      },
    };
    return api;
  },
};
