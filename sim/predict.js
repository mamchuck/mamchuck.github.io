// Сцена «Как изменится величина?» (задание №12 ОГЭ): формула, вопрос «что будет, если изменить величины» и три ответа.
// Вопросы собираются сами из степенных формул: результат — это произведение множителей k^степень, поэтому ответ всегда считается точно.
// Для степеней 1/2 (период маятника) множитель берётся из квадратов (4 или 9), чтобы ответ получался «чистым».
import { fmt, math as mathHtml, rr } from './tex.js?v=202611010219';

const SW = 520, SH = 400;
const SEC = { 1: 'Механика', 2: 'Колебания и волны', 3: 'Тепловые явления', 4: 'Электричество', 5: 'Оптика и атом' };
// [раздел, формула, что находим (им. п.), [[обозначение, «что меняем» (в. п.), степень]]]
const F = [
  [1, 'v = \\dfrac{s}{t}', 'скорость равномерного движения', [['s', 'путь', 1], ['t', 'время', -1]]],
  [1, 'F = m a', 'сила, действующая на тело', [['m', 'массу тела', 1], ['a', 'ускорение тела', 1]]],
  [1, 'a = \\dfrac{F}{m}', 'ускорение тела', [['F', 'равнодействующую силу', 1], ['m', 'массу тела', -1]]],
  [1, 'p = m v', 'импульс тела', [['m', 'массу тела', 1], ['v', 'скорость тела', 1]]],
  [1, 'E_\\text{к} = \\dfrac{m v^2}{2}', 'кинетическая энергия тела', [['m', 'массу тела', 1], ['v', 'скорость тела', 2]]],
  [1, 'F = k x', 'сила упругости пружины', [['k', 'жёсткость пружины', 1], ['x', 'удлинение пружины', 1]]],
  [1, 'F_\\text{тр} = \\mu N', 'сила трения скольжения', [['\\mu', 'коэффициент трения', 1], ['N', 'силу нормальной реакции опоры', 1]]],
  [1, 'p = \\dfrac{F}{S}', 'давление, создаваемое силой', [['F', 'силу давления', 1], ['S', 'площадь опоры', -1]]],
  [1, 'p = \\rho g h', 'давление жидкости на дно сосуда', [['\\rho', 'плотность жидкости', 1], ['h', 'высоту столба жидкости', 1]]],
  [1, 'F_\\text{А} = \\rho g V', 'архимедова сила', [['\\rho', 'плотность жидкости', 1], ['V', 'объём погружённой части тела', 1]]],
  [1, 'A = F s', 'работа постоянной силы', [['F', 'силу', 1], ['s', 'путь', 1]]],
  [1, 'N = \\dfrac{A}{t}', 'мощность', [['A', 'работу', 1], ['t', 'время', -1]]],
  [1, 'a = \\dfrac{v^2}{R}', 'центростремительное ускорение', [['v', 'скорость', 2], ['R', 'радиус окружности', -1]]],
  [1, 'F = G\\dfrac{m_1 m_2}{r^2}', 'сила гравитационного притяжения двух тел', [['m_1', 'массу первого тела', 1], ['m_2', 'массу второго тела', 1], ['r', 'расстояние между телами', -2]]],
  [2, 'T = 2\\pi\\sqrt{\\dfrac{l}{g}}', 'период колебаний математического маятника', [['l', 'длину нити', 0.5], ['g', 'ускорение свободного падения', -0.5]]],
  [2, 'T = 2\\pi\\sqrt{\\dfrac{m}{k}}', 'период колебаний пружинного маятника', [['m', 'массу груза', 0.5], ['k', 'жёсткость пружины', -0.5]]],
  [2, '\\nu = \\dfrac{1}{T}', 'частота колебаний', [['T', 'период колебаний', -1]]],
  [2, '\\lambda = \\dfrac{v}{\\nu}', 'длина волны', [['v', 'скорость волны', 1], ['\\nu', 'частоту', -1]]],
  [2, 'v = \\lambda \\nu', 'скорость волны', [['\\lambda', 'длину волны', 1], ['\\nu', 'частоту', 1]]],
  [3, 'Q = c m \\Delta t', 'количество теплоты, необходимое для нагревания тела', [['c', 'удельную теплоёмкость вещества', 1], ['m', 'массу тела', 1], ['\\Delta t', 'изменение температуры', 1]]],
  [3, 'Q = \\lambda m', 'количество теплоты, необходимое для плавления вещества', [['\\lambda', 'удельную теплоту плавления', 1], ['m', 'массу вещества', 1]]],
  [3, 'Q = q m', 'количество теплоты, выделяющееся при сгорании топлива', [['q', 'удельную теплоту сгорания', 1], ['m', 'массу топлива', 1]]],
  [3, 'p = n k T', 'давление идеального газа', [['n', 'концентрацию молекул', 1], ['T', 'абсолютную температуру', 1]]],
  [3, 'p = \\dfrac{\\nu R T}{V}', 'давление идеального газа', [['\\nu', 'количество вещества', 1], ['T', 'абсолютную температуру', 1], ['V', 'объём сосуда', -1]]],
  [3, '\\eta = \\dfrac{A}{Q}', 'КПД теплового двигателя', [['A', 'полезную работу', 1], ['Q', 'количество теплоты, полученное от нагревателя', -1]]],
  [4, 'I = \\dfrac{U}{R}', 'сила тока в проводнике', [['U', 'напряжение', 1], ['R', 'сопротивление', -1]]],
  [4, 'R = \\rho\\dfrac{l}{S}', 'сопротивление проводника', [['\\rho', 'удельное сопротивление', 1], ['l', 'длину проводника', 1], ['S', 'площадь поперечного сечения', -1]]],
  [4, 'P = I^2 R', 'мощность тока на резисторе', [['I', 'силу тока', 2], ['R', 'сопротивление', 1]]],
  [4, 'P = \\dfrac{U^2}{R}', 'мощность тока на резисторе', [['U', 'напряжение', 2], ['R', 'сопротивление', -1]]],
  [4, 'Q = I^2 R t', 'количество теплоты, выделяющееся в проводнике', [['I', 'силу тока', 2], ['R', 'сопротивление', 1], ['t', 'время', 1]]],
  [4, 'F = k\\dfrac{|q_1||q_2|}{r^2}', 'сила взаимодействия двух точечных зарядов', [['q_1', 'модуль первого заряда', 1], ['q_2', 'модуль второго заряда', 1], ['r', 'расстояние между зарядами', -2]]],
  [4, 'C = \\dfrac{\\varepsilon\\varepsilon_0 S}{d}', 'ёмкость плоского конденсатора', [['S', 'площадь пластин', 1], ['d', 'расстояние между пластинами', -1]]],
  [4, 'E = \\dfrac{F}{q}', 'напряжённость электрического поля', [['F', 'силу, действующую на заряд', 1], ['q', 'пробный заряд', -1]]],
  [5, 'D = \\dfrac{1}{F}', 'оптическая сила линзы', [['F', 'фокусное расстояние', -1]]],
  [5, 'E = h\\nu', 'энергия фотона', [['\\nu', 'частоту излучения', 1]]],
  [5, 'E = \\dfrac{h c}{\\lambda}', 'энергия фотона', [['\\lambda', 'длину волны излучения', -1]]],
];
const rng = (seed) => { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const plural = (n) => (Number.isInteger(n) ? (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'раза' : 'раз') : 'раза');
const num = (x) => { const t = fmt(Math.round(x * 100) / 100, 2); return t.includes(',') ? t.replace(/0+$/, '').replace(/,$/, '') : t; };
const ex = (c) => { const e = (c.up ? 1 : -1) * c.e, a = Math.abs(e); return `${e < 0 ? '-' : ''}${a === 0.5 ? '\\frac{1}{2}' : num(a)}`; };
const STAT = { score: 0, total: 0, streak: 0, best: 0 };
let lastSec = null;
const nice = (x) => Math.abs(x * 2 - Math.round(x * 2)) < 1e-9;

function make(sec, seed) {
  const r = rng(seed), pool = F.filter((f) => !sec || f[0] === sec), f = pool[Math.floor(r() * pool.length)], vars = f[3];
  for (let tries = 0; tries < 60; tries++) {
    const n = Math.min(vars.length, r() < 0.55 ? 1 : 2), idx = vars.map((_, i) => i).sort(() => r() - 0.5).slice(0, n), ch = [];
    for (const i of idx) { const half = vars[i][2] % 1 !== 0, ks = half ? [4, 9] : [2, 3, 4]; ch.push({ i, k: ks[Math.floor(r() * ks.length)], up: r() < 0.5 }); }
    if (ch.length === 2 && r() < 0.35) {                                      // иногда подбираем второй множитель так, чтобы всё взаимно сократилось
      const r1 = ch[0].k ** ((ch[0].up ? 1 : -1) * vars[ch[0].i][2]);
      for (const k of [2, 3, 4, 9]) for (const up of [true, false]) if (Math.abs(k ** ((up ? 1 : -1) * vars[ch[1].i][2]) * r1 - 1) < 1e-9) { ch[1].k = k; ch[1].up = up; }
    }
    const ratio = ch.reduce((p, c) => p * c.k ** ((c.up ? 1 : -1) * vars[c.i][2]), 1), x = ratio >= 1 ? ratio : 1 / ratio;
    if (!nice(x) || x > 64) continue;
    return { f, ch, ratio };
  }
  return { f, ch: [{ i: 0, k: 2, up: true }], ratio: 2 ** vars[0][2] };
}

export const predict = {
  id: 'predict',
  mode: 'free',
  title: 'Как изменится величина?',
  lead: 'Задание №12 ОГЭ: формула и вопрос «что будет, если…». Выбери ответ, а потом смотри разбор: он покажет, как каждый множитель меняет результат. Вопросы собираются сами, их бесконечно много.',
  stage: { w: SW, h: SH, label: 'Формула и вопрос о том, как изменится величина' },
  params: [{ id: 'sec', name: 'Раздел', tex: '\\text{раздел}', unit: '', dec: 0, def: 0, options: [{ label: 'Все', v: 0 }, ...Object.entries(SEC).map(([v, label]) => ({ label, v: +v }))], fmt: (v) => (v ? SEC[v] : 'все') }],
  actions: [
    { id: 'up', group: 'Ответ', label: 'Увеличится', color: '#1f9d55' },
    { id: 'down', group: 'Ответ', label: 'Уменьшится', color: '#e8590c' },
    { id: 'same', group: 'Ответ', label: 'Не изменится', color: '#2563eb' },
    { id: 'next', group: 'Дальше', label: 'Следующий вопрос', color: '#7048e8' },
  ],
  act(id, p, d) {
    if (id === 'next') return { set: { seed: 1 + Math.floor(Math.random() * 1e6), ans: 0 } };
    if (p.ans) return null;                                                   // на вопрос уже ответили
    const code = { up: 1, down: 2, same: 3 }[id]; STAT.total++;
    if (code === d.correct) { STAT.score++; STAT.streak++; STAT.best = Math.max(STAT.best, STAT.streak); } else STAT.streak = 0;
    return { set: { ans: code } };
  },
  derive(p) {
    if (lastSec !== p.sec) { lastSec = p.sec; p.seed = 1 + Math.floor(Math.random() * 1e6); p.ans = 0; }
    const q = make(p.sec, p.seed ?? 5), f = q.f, ratio = q.ratio, same = Math.abs(ratio - 1) < 1e-9, correct = same ? 3 : ratio > 1 ? 1 : 2;
    const phr = q.ch.map((c) => `${f[3][c.i][1]} ${c.up ? 'увеличить' : 'уменьшить'} в ${c.k} ${plural(c.k)}`);
    const text = `Как изменится ${f[2]}, если ${phr.length === 1 ? phr[0] : `${phr[0]}, а ${phr[1]}`}? Остальные величины не меняются.`;
    const x = ratio >= 1 ? ratio : 1 / ratio, answer = same ? 'не изменится' : `${ratio > 1 ? 'увеличится' : 'уменьшится'} в ${num(x)} ${plural(x)}`;
    const parts = q.ch.map((c) => { const e = f[3][c.i][2], m = c.k ** ((c.up ? 1 : -1) * e); return { sym: f[3][c.i][0], e, m, k: c.k, up: c.up }; });
    return { f, q, ratio, same, correct, text, answer, parts, ans: p.ans ?? 0, formula: f[1] };
  },
  readouts: () => [['Верных ответов', '', `${STAT.score} из ${STAT.total}`], ['Серия подряд', '', `${STAT.streak}`], ['Лучшая серия', '', `${STAT.best}`]],
  formulas: [
    { tag: 'Как считать', color: '#2563eb', tex: '\\text{множитель} = k^{\\,\\text{степень}}' },
    { tag: 'Итог', color: '#e8590c', tex: '\\dfrac{y_2}{y_1} = k_1^{n_1}\\cdot k_2^{n_2}\\cdots' },
  ],
  note: 'Степень величины в формуле — это то, во сколько раз «сильно» она влияет. Если величина стоит в знаменателе, степень отрицательная: рост такой величины уменьшает результат.',
  info(p, d) {
    const chips = d.parts.map((c) => `<div class="sm-eq">${mathHtml(c.sym)} ${c.up ? '× ' : '÷ '}${c.k}<small>степень ${num(c.e)} → множитель ${mathHtml(`${c.k}^{${ex(c)}}`)} = ${num(c.m)}</small></div>`).join('');
    if (!d.ans) return `<div class="sm-big" style="font-size:24px">Твой ответ?</div><div><span class="sm-chip">${SEC[d.f[0]]}</span></div><p style="margin:10px 0 0;line-height:1.4">Подумай, как каждая величина входит в формулу, и выбери ответ ниже.</p>${chips ? '' : ''}`;
    const ok = d.ans === d.correct, lab = { 1: 'увеличится', 2: 'уменьшится', 3: 'не изменится' }[d.ans];
    return `<div class="sm-big" style="font-size:24px;color:${ok ? '#1f9d55' : '#d6336c'}">${ok ? 'Верно!' : 'Неверно'}</div>
      <div><span class="sm-chip">${ok ? 'так и есть' : `ты ответил: ${lab}`}</span></div>
      <div class="sm-eq"><b>Ответ:</b> ${d.answer}</div>
      <h4 style="margin-top:12px">Разбор</h4>${chips}
      <div class="sm-eq">Итог: ${d.parts.map((c) => num(c.m)).join(' · ')} = <b>${num(d.ratio)}</b></div>`;
  },

  mount(box) {
    const bg = document.createElement('canvas'); bg.className = 'sm-sbg'; box.prepend(bg);
    const fe = document.createElement('div'), qe = document.createElement('div'); fe.className = 'sm-pr-f'; qe.className = 'sm-pr-q'; box.append(fe, qe);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', this.stage.label); bg.setAttribute('aria-hidden', 'true');
    let d = null, f = 1;
    const full = () => {
      const cssW = box.clientWidth || SW, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1.4e6 / (cssW * ((cssW * SH) / SW)))));
      bg.width = Math.round(cssW * dpr); bg.height = Math.round(((cssW * SH) / SW) * dpr);
      const g = bg.getContext('2d'); g.setTransform(bg.width / SW, 0, 0, bg.height / SH, 0, 0); return g;
    };
    const paint = () => {
      if (!d) return; f = (box.clientWidth || SW) / SW; box.style.setProperty('--f', f);
      fe.innerHTML = mathHtml(d.formula, true); qe.textContent = d.text;
      const c = full(); c.clearRect(0, 0, SW, SH);
      // «было» и «стало»: высота столбика пропорциональна значению величины (ограничена, чтобы поместиться)
      const base = 372, H0 = 70, x0 = 150, x1 = 300, bw = 70, h1 = H0, rawH = H0 * d.ratio, h2 = Math.max(6, Math.min(118, rawH)), clipped = rawH > 118;
      c.strokeStyle = '#2a3140'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(60, base); c.lineTo(SW - 60, base); c.stroke();
      rr(c, x0, base - h1, bw, h1, 6); c.fillStyle = '#9aa8c0'; c.fill();
      c.font = '600 15px "KaTeX_Main", serif'; c.fillStyle = '#1b2330'; c.textAlign = 'center'; c.fillText('было', x0 + bw / 2, base + 0 - h1 - 8);
      if (d.ans) {
        rr(c, x1, base - h2, bw, h2, 6); c.fillStyle = d.ans === d.correct ? '#37b24d' : '#f08c00'; c.fill();
        c.fillText(`стало: ×${num(d.ratio)}`, x1 + bw / 2, base - h2 - 8); if (clipped) { c.fillStyle = '#fff'; c.fillText('≈', x1 + bw / 2, base - h2 + 22); }
      } else { c.setLineDash([5, 5]); c.strokeStyle = '#7a8aa5'; c.lineWidth = 2; rr(c, x1, base - H0, bw, H0, 6); c.stroke(); c.setLineDash([]); c.font = '700 34px "KaTeX_Main", serif'; c.fillStyle = '#7a8aa5'; c.fillText('?', x1 + bw / 2, base - H0 / 2 + 12); c.font = '600 15px "KaTeX_Main", serif'; c.fillText('стало', x1 + bw / 2, base - H0 - 8); }
    };
    return { resize() { paint(); }, params(p, dd) { d = dd; paint(); }, update() {} };
  },
};
