// Разминка: генераторы заданий. Каждый навык — gen(lvl) → { q, a | choices, show }:
//   q       — условие (HTML из наших же шаблонов, не из ввода пользователя);
//   a       — числовой ответ (ввод), сравнивается по значению: 0,75 = 3/4;
//   choices — 4 варианта (HTML), верный — choices[ok];
//   show    — как показать правильный ответ в разборе.
// lvl 0…2 растёт по ходу раунда (5 и 12 верных).

const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const MINUS = '−';
export const fmt = (x) => {
  const s = Number.isInteger(x) ? String(x) : String(+x.toFixed(6));
  return s.replace('.', ',').replace('-', MINUS);
};
const sgn = (x) => (x < 0 ? `(${fmt(x)})` : fmt(x));               // отрицательное в скобках: 5 · (−3)
const frac = (n, d) => { const g = gcd(n, d) || 1; let a = n / g, b = d / g; if (b < 0) { a = -a; b = -b; } return [a, b]; };
const fracStr = ([n, d]) => (d === 1 ? fmt(n) : `${n < 0 ? MINUS : ''}${Math.abs(n)}/${d}`);
const fracHtml = ([n, d]) => (d === 1 ? fmt(n) : `${n < 0 ? MINUS : ''}<span class="fr"><span>${Math.abs(n)}</span><span>${d}</span></span>`);

// 4 варианта: верный + 3 разных неверных
function choice(q, right, wrong, show) {
  const uniq = [...new Set(wrong.filter((w) => w !== right))].slice(0, 3);
  const all = shuffle([right, ...uniq]);
  return { q, choices: all, ok: all.indexOf(right), show: show ?? right };
}

// ============================================================ Математика
const mul = (lvl) => {
  if (lvl === 0) { const a = R(2, 9), b = R(2, 9); return Math.random() < 0.25 ? { q: `${a * b} : ${a}`, a: b } : { q: `${a} · ${b}`, a: a * b }; }
  if (lvl === 1) { const a = R(12, 99), b = R(2, 9); return Math.random() < 0.3 ? { q: `${a * b} : ${b}`, a } : { q: `${a} · ${b}`, a: a * b }; }
  const a = R(11, 25), b = R(11, 19);
  return pick([{ q: `${a} · ${b}`, a: a * b }, { q: `${a}²`, a: a * a }, { q: `${a * b} : ${b}`, a }]);
};

const pct = (lvl) => {
  const P = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75];
  const p = pick(lvl === 0 ? [10, 20, 25, 50] : P);
  const unit = 100 / gcd(p, 100), n = unit * R(1, lvl === 0 ? 8 : 12);
  if (lvl === 0) return { q: `${p}% от ${n}`, a: (n * p) / 100 };
  if (lvl === 1) return pick([{ q: `${p}% от ${n}`, a: (n * p) / 100 }, { q: `${n} увеличить на ${p}%`, a: n + (n * p) / 100 }, { q: `${n} уменьшить на ${p}%`, a: n - (n * p) / 100 }]);
  return pick([{ q: `Сколько процентов составляет ${(n * p) / 100} от ${n}?`, a: p },
    { q: `${p}% числа равны ${(n * p) / 100}. Найдите число.`, a: n }, { q: `${n} увеличить на ${p}%`, a: n + (n * p) / 100 }]);
};

const fracs = (lvl) => {
  if (lvl === 0) {
    const d = pick([2, 4, 5, 8, 10, 20, 25]); let n = R(1, d - 1); while (gcd(n, d) !== 1) n = R(1, d - 1);
    return Math.random() < 0.6 ? { q: `${fracHtml([n, d])} — в десятичную дробь`, a: n / d }
      : { q: `${fmt(n / d)} — в обыкновенную дробь`, a: n / d, show: fracStr([n, d]), needFrac: true, hint: 'через /, например 3/4' };
  }
  const D = lvl === 1 ? [2, 3, 4, 5, 6] : [3, 4, 5, 6, 7, 8, 9, 10, 12];
  const b = pick(D), d = pick(D), a = R(1, b + (lvl === 2 ? 3 : 0)), c = R(1, d);
  const op = pick(lvl === 1 ? ['+', '−', '·'] : ['+', '−', '·', ':']);
  const r = op === '+' ? frac(a * d + c * b, b * d) : op === '−' ? frac(a * d - c * b, b * d) : op === '·' ? frac(a * c, b * d) : frac(a * d, b * c);
  return { q: `${fracHtml(frac(a, b))} ${op} ${fracHtml(frac(c, d))}`, a: r[0] / r[1], show: fracStr(r), hint: 'можно дробью: 5/6' };
};

const pows = (lvl) => {
  if (lvl === 0) { const n = R(11, 20); return Math.random() < 0.5 ? { q: `${n}²`, a: n * n } : { q: `√${n * n}`, a: n }; }
  if (lvl === 1) {
    return pick([(() => { const n = R(5, 10); return { q: `2<sup>${n}</sup>`, a: 2 ** n }; })(), (() => { const n = R(3, 5); return { q: `3<sup>${n}</sup>`, a: 3 ** n }; })(),
      (() => { const n = R(15, 25); return { q: `${n}²`, a: n * n }; })(), (() => { const n = R(15, 30); return { q: `√${n * n}`, a: n }; })(),
      (() => { const n = R(1, 4); return { q: `0,1<sup>${n}</sup>`, a: 0.1 ** n }; })()]);
  }
  return pick([
    (() => { const [a, b] = pick([[2, 8], [3, 12], [2, 18], [3, 27], [5, 20], [2, 32], [6, 24], [7, 28]]); return { q: `√${a} · √${b}`, a: Math.sqrt(a * b) }; })(),
    (() => { const k = R(2, 6), n = R(2, 9); return { q: `√${k * k * n} : √${n}`, a: k }; })(),
    (() => { const a = R(3, 8), b = R(2, 6), c = R(2, a + b - 1); return { q: `2<sup>${a}</sup> · 2<sup>${b}</sup> : 2<sup>${c}</sup>`, a: 2 ** (a + b - c) }; })(),
    (() => { const n = R(2, 3); return { q: `(${MINUS}3)<sup>${n}</sup>`, a: (-3) ** n }; })(),
  ]);
};

const negs = (lvl) => {
  const n = () => R(-20, 20) || 7;
  if (lvl === 0) { const a = n(), b = n(); return Math.random() < 0.5 ? { q: `${fmt(a)} + ${sgn(b)}`, a: a + b } : { q: `${fmt(a)} − ${sgn(b)}`, a: a - b }; }
  if (lvl === 1) { const a = R(-12, 12) || -4, b = R(-9, 9) || 3; return pick([{ q: `${fmt(a)} · ${sgn(b)}`, a: a * b }, { q: `${fmt(a * b)} : ${sgn(b)}`, a }]); }
  const a = n(), b = R(-9, 9) || -2, c = R(-9, 9) || 5;
  return pick([{ q: `${fmt(a)} + ${sgn(b)} · ${sgn(c)}`, a: a + b * c }, { q: `(${fmt(a)} − ${sgn(b)}) · ${sgn(c)}`, a: (a - b) * c },
    { q: `${fmt(a)} − ${sgn(b)}²`, a: a - b * b }, { q: `${sgn(b)}² − ${fmt(c * 2)}`, a: b * b - c * 2 }]);
};

// kx + b в школьной записи: «x», «−x», «3x − 5», «7»
const lin = (k, b, v = 'x') => {
  const kx = k === 0 ? '' : k === 1 ? v : k === -1 ? `${MINUS}${v}` : `${fmt(k)}${v}`;
  if (!kx) return fmt(b);
  return b === 0 ? kx : `${kx} ${b < 0 ? MINUS : '+'} ${Math.abs(b)}`;
};
const eqs = (lvl) => {
  const x = R(-9, 9) || 4;
  if (lvl === 0) { const a = R(2, 9), b = R(-15, 15); return { q: `${lin(a, b)} = ${fmt(a * x + b)}`, a: x, pre: 'x =' }; }
  if (lvl === 1) {
    const a = R(2, 7), c = a - R(1, 4), b = R(-9, 9), d = a * x + b - c * x;
    return { q: `${lin(a, b)} = ${lin(c, d)}`, a: x, pre: 'x =' };
  }
  const p = R(-7, 7), q = R(-7, 7) || 2, sx = -(p + q), t = p * q;
  const mid = sx === 0 ? '' : ` ${sx < 0 ? MINUS : '+'} ${Math.abs(sx) === 1 ? '' : Math.abs(sx)}x`;
  const fr = t === 0 ? '' : ` ${t < 0 ? MINUS : '+'} ${Math.abs(t)}`;
  return { q: `x²${mid}${fr} = 0 · больший корень`, a: Math.max(p, q), pre: 'x =' };
};

// Тригонометрия: точные значения на окружности
const TV = { 0: '0', h: '1/2', r2: '√2/2', r3: '√3/2', 1: '1', t3: '√3/3', s3: '√3' };
const TRIG = (() => {
  const base = { 0: ['0', '1', '0'], 30: ['h', 'r3', 't3'], 45: ['r2', 'r2', '1'], 60: ['r3', 'h', 's3'], 90: ['1', '0', null] };
  const out = [];
  for (let deg = 0; deg <= 360; deg += 15) {
    const ref = [0, 30, 45, 60, 90].find((r) => [r, 180 - r, 180 + r, 360 - r].includes(deg));
    if (ref === undefined) continue;
    const rad = (deg * Math.PI) / 180, [s, c, t] = base[ref];
    const val = (k, num) => (k === null ? null : k === '0' ? '0' : (num < 0 ? MINUS : '') + TV[k]);
    out.push({ deg, sin: val(s, Math.sin(rad)), cos: val(c, Math.cos(rad)), tg: val(t, Math.tan(rad)) });
  }
  return out;
})();
const RADS = { 0: '0', 30: 'π/6', 45: 'π/4', 60: 'π/3', 90: 'π/2', 120: '2π/3', 135: '3π/4', 150: '5π/6', 180: 'π', 210: '7π/6', 225: '5π/4', 240: '4π/3', 270: '3π/2', 300: '5π/3', 315: '7π/4', 330: '11π/6', 360: '2π' };
const POOL = ['0', '1/2', '√2/2', '√3/2', '1', '√3', '√3/3'].flatMap((v) => (v === '0' ? [v] : [v, MINUS + v]));
const trig = (lvl) => {
  const rows = TRIG.filter((r) => (lvl === 0 ? r.deg <= 90 : lvl === 1 ? r.deg <= 180 : true));
  let row, f;
  do { row = pick(rows); f = pick(lvl === 0 ? ['sin', 'cos'] : ['sin', 'cos', 'tg']); } while (row[f] === null);
  const right = row[f];
  const near = [right.startsWith(MINUS) ? right.slice(1) : MINUS + right, row[f === 'sin' ? 'cos' : 'sin']].filter(Boolean);
  const ang = lvl === 2 ? RADS[row.deg] : `${row.deg}°`;
  return choice(`${f} ${ang}`, right, [...shuffle(near), ...shuffle(POOL)].filter((x) => x !== '−0'));
};

const logs = (lvl) => {
  const SUB = { 2: '₂', 3: '₃', 4: '₄', 5: '₅', 7: '₇', 8: '₈', 9: '₉' };
  if (lvl === 0) {
    const b = pick([2, 3, 5, 10]), k = R(0, b === 2 ? 6 : 4);
    return { q: b === 10 ? `lg ${fmt(10 ** k)}` : `log${SUB[b]} ${b ** k}`, a: k };
  }
  if (lvl === 1) {
    return pick([
      (() => { const b = pick([2, 3, 5]), k = R(1, 3); return { q: `log${SUB[b]} <span class="fr"><span>1</span><span>${b ** k}</span></span>`, a: -k }; })(),
      (() => { const [b, x, r] = pick([[4, 2, '1/2'], [9, 3, '1/2'], [8, 2, '1/3'], [27, 3, '1/3'], [8, 4, '2/3'], [4, 8, '3/2'], [9, 27, '3/2'], [16, 8, '3/4']]); const [n, d] = r.split('/').map(Number); return { q: `log${SUB[b] || '<sub>' + b + '</sub>'} ${x}`, a: n / d, show: r }; })(),
      (() => { const b = pick([2, 3, 5, 7]), x = R(2, 9); return { q: `${b}<sup>log${SUB[b]} ${x}</sup>`, a: x }; })(),
    ]);
  }
  return pick([
    (() => { const [a, b, r] = pick([[25, 4, 2], [2, 50, 2], [8, 125, 3], [20, 5, 2], [4, 250, 3]]); return { q: `lg ${a} + lg ${b}`, a: r }; })(),
    (() => { const b = pick([2, 3]), x = R(2, 7), k = R(1, 3); return { q: `log${SUB[b]} ${x * b ** k} − log${SUB[b]} ${x}`, a: k }; })(),
    (() => { const b = pick([2, 3, 5]), k = R(2, 4), m = R(2, 3); return { q: `log${SUB[b]} ${b ** k}<sup>${m}</sup>`, a: k * m }; })(),
  ]);
};

const DER = [
  ['x²', '2x'], ['x³', '3x²'], ['x⁴', '4x³'], ['x⁵', '5x⁴'], ['sin x', 'cos x'], ['cos x', `${MINUS}sin x`], ['eˣ', 'eˣ'], ['ln x', '1/x'],
  ['√x', '1/(2√x)'], ['1/x', `${MINUS}1/x²`], ['tg x', '1/cos²x'], ['5x', '5'], ['7', '0'], ['3x²', '6x'], ['2x³', '6x²'],
  ['x² + 3x', '2x + 3'], ['4x − x²', '4 − 2x'], ['2ˣ', '2ˣ · ln 2'], ['sin 2x', '2cos 2x'], ['e²ˣ', '2e²ˣ'],
];
const ders = (lvl) => {
  const pool = lvl === 0 ? DER.slice(0, 13) : DER;
  const [f, d] = pick(pool);
  const wrong = DER.map((x) => x[1]).filter((x) => x !== d);
  const near = { '2x': ['x', 'x²/2'], '3x²': ['x²', '3x³'], 'cos x': [`${MINUS}cos x`, `${MINUS}sin x`], [`${MINUS}sin x`]: ['sin x', `${MINUS}cos x`],
    '1/x': ['ln x', `${MINUS}1/x²`], 'eˣ': ['x·eˣ⁻¹', 'eˣ⁺¹'], '0': ['7', '1'], '1/(2√x)': ['2√x', '1/√x'], '2cos 2x': ['cos 2x', `${MINUS}2cos 2x`] }[d] || [];
  return choice(`(${f})′ = ?`, d, [...near, ...shuffle(wrong)]);
};

// ============================================================ Физика: библиотека формул «одночленов» L = Π fᵢ^eᵢ
// [символ, показатель, константа?] — константы (g, π, числа) никогда не спрашиваем
const F = [
  { L: 'F', n: 'сила (второй закон Ньютона)', r: [['m', 1], ['a', 1]], ex: 'oge' },
  { L: 'p', n: 'давление', r: [['F', 1], ['S', -1]], ex: 'oge' },
  { L: 'p', n: 'давление жидкости', r: [['ρ', 1], ['g', 1, 1], ['h', 1]], ex: 'oge' },
  { L: 'ρ', n: 'плотность', r: [['m', 1], ['V', -1]], ex: 'oge' },
  { L: 'v', n: 'скорость', r: [['s', 1], ['t', -1]], ex: 'oge' },
  { L: 'F<sub>А</sub>', n: 'сила Архимеда', r: [['ρ<sub>ж</sub>', 1], ['g', 1, 1], ['V', 1]], ex: 'oge' },
  { L: 'A', n: 'механическая работа', r: [['F', 1], ['s', 1]], ex: 'oge' },
  { L: 'N', n: 'мощность', r: [['A', 1], ['t', -1]], ex: 'oge' },
  { L: 'E<sub>к</sub>', n: 'кинетическая энергия', r: [['m', 1], ['v', 2], ['2', -1, 1]], ex: 'oge', hard: 1 },
  { L: 'E<sub>п</sub>', n: 'потенциальная энергия', r: [['m', 1], ['g', 1, 1], ['h', 1]], ex: 'oge' },
  { L: 'Q', n: 'теплота при нагревании', r: [['c', 1], ['m', 1], ['Δt', 1]], ex: 'oge' },
  { L: 'Q', n: 'теплота при плавлении', r: [['λ', 1], ['m', 1]], ex: 'oge' },
  { L: 'Q', n: 'теплота при парообразовании', r: [['L', 1], ['m', 1]], ex: 'oge' },
  { L: 'Q', n: 'теплота при сгорании топлива', r: [['q', 1], ['m', 1]], ex: 'oge' },
  { L: 'I', n: 'сила тока (закон Ома)', r: [['U', 1], ['R', -1]], ex: 'oge' },
  { L: 'P', n: 'мощность тока', r: [['U', 1], ['I', 1]], ex: 'oge' },
  { L: 'Q', n: 'закон Джоуля — Ленца', r: [['I', 2], ['R', 1], ['t', 1]], ex: 'oge', hard: 1 },
  { L: 'R', n: 'сопротивление проводника', r: [['ρ', 1], ['l', 1], ['S', -1]], ex: 'oge' },
  { L: 'F<sub>упр</sub>', n: 'сила упругости', r: [['k', 1], ['x', 1]], ex: 'oge' },
  { L: 'p', n: 'импульс', r: [['m', 1], ['v', 1]], ex: 'oge' },
  { L: 'v', n: 'скорость волны', r: [['λ', 1], ['ν', 1]], ex: 'oge' },
  { L: 'I', n: 'сила тока через заряд', r: [['q', 1], ['t', -1]], ex: 'oge' },
  { L: 'F', n: 'закон всемирного тяготения', r: [['G', 1, 1], ['m<sub>1</sub>', 1], ['m<sub>2</sub>', 1], ['r', -2]], ex: 'both', hard: 1 },
  { L: 'a', n: 'центростремительное ускорение', r: [['v', 2], ['R', -1]], ex: 'both', hard: 1 },
  { L: 'p', n: 'уравнение Менделеева — Клапейрона', r: [['ν', 1], ['R', 1, 1], ['T', 1], ['V', -1]], ex: 'ege' },
  { L: 'F', n: 'закон Кулона', r: [['k', 1, 1], ['q<sub>1</sub>', 1], ['q<sub>2</sub>', 1], ['r', -2]], ex: 'ege', hard: 1 },
  { L: 'E', n: 'энергия фотона', r: [['h', 1, 1], ['ν', 1]], ex: 'ege' },
  { L: 'F<sub>Л</sub>', n: 'сила Лоренца', r: [['q', 1], ['v', 1], ['B', 1]], ex: 'ege' },
  { L: 'T', n: 'период математического маятника', r: [['2', 1, 1], ['π', 1, 1], ['l', 0.5], ['g', -0.5, 1]], ex: 'both', hard: 1 },
  { L: 'C', n: 'ёмкость конденсатора', r: [['q', 1], ['U', -1]], ex: 'ege' },
  { L: 'W', n: 'энергия конденсатора', r: [['C', 1], ['U', 2], ['2', -1, 1]], ex: 'ege', hard: 1 },
];

const SUP = { 2: '²', 3: '³', 4: '⁴' };
// Одночлен {символ: показатель} → HTML: числа отдельно, дробь, корень для показателей ±1/2
function mono(ex) {
  let numV = 1, denV = 1; const num = [], den = [], rn = [], rd = [];
  for (const [s, e] of ex) {
    if (!e) continue;
    if (/^\d+$/.test(s)) { const v = (+s) ** Math.abs(e); if (Number.isInteger(v)) { if (e > 0) numV *= v; else denV *= v; continue; } }
    const half = !Number.isInteger(e), k = Math.abs(half ? e * 2 : e);
    const t = s + (k > 1 ? SUP[k] : '');
    const arr = half ? (e > 0 ? rn : rd) : (e > 0 ? num : den);
    if (/^\d/.test(t)) arr.unshift(t); else arr.push(t);                     // число впереди: 2W, а не W2
  }
  const g = gcd(numV, denV); numV /= g; denV /= g;
  const side = (v, arr) => (v !== 1 ? String(v) : '') + arr.join('');
  const fr = (n, d) => (d ? `<span class="fr"><span>${n || '1'}</span><span>${d}</span></span>` : n || '1');
  const main = fr(side(numV, num), side(denV, den));
  const root = rn.length || rd.length ? `<span class="sq">√<span>${fr(rn.join(''), rd.join(''))}</span></span>` : '';
  return main === '1' && root ? root : main + root;
}
const key = (ex) => ex.filter(([, e]) => e).map(([s, e]) => s + e).sort().join('|');

// Выразить t из L = Π: t^eₜ = L · Π fᵢ^(−eᵢ)  →  t = (…)^(1/eₜ)
function solveFor(f, t) {
  const et = f.r.find(([s]) => s === t)[1];
  return [[f.L, 1 / et], ...f.r.filter(([s]) => s !== t).map(([s, e]) => [s, -e / et])];
}
const formulaHtml = (f) => `${f.L} = ${mono(f.r)}`;

const derive = (lvl) => {
  const pool = F.filter((f) => (lvl === 0 ? !f.hard && f.ex !== 'ege' : true));
  const f = pick(pool);
  const t = pick(f.r.filter(([, , c]) => !c))[0];
  const right = solveFor(f, t);
  const wr = [];
  wr.push(right.map(([s, e]) => [s, -e]));                                              // перевернули дробь
  for (let i = 0; i < right.length; i++) wr.push(right.map(([s, e], j) => [s, i === j ? -e : e]));   // один множитель «не туда»
  wr.push(right.map(([s, e]) => [s, Math.abs(e)]));                                       // всё перемножили
  if (right.some(([, e]) => !Number.isInteger(e))) wr.push(right.map(([s, e]) => [s, e * 2]));      // забыли корень
  else if (right.some(([, e]) => Math.abs(e) === 0.5 || Math.abs(e) === 2)) wr.push(right.map(([s, e]) => [s, e / 2]));
  const seen = new Set([key(right)]);
  const wrong = shuffle(wr).filter((w) => { const k = key(w); if (seen.has(k)) return false; seen.add(k); return true; }).map((w) => `${t} = ${mono(w)}`);
  return choice(`Из формулы <b>${formulaHtml(f)}</b> выразите <b>${t}</b>`, `${t} = ${mono(right)}`, wrong);
};

const whatIs = (lvl) => {
  const pool = F.filter((f) => (lvl === 0 ? f.ex !== 'ege' : true));
  const f = pick(pool);
  const others = shuffle(F.filter((g) => g.n !== f.n && (g.L === f.L || Math.random() < 0.4))).map((g) => g.n);
  return choice(`${mono(f.r)} — это…`, f.n, others, `${f.n}: ${formulaHtml(f)}`);
};

const UNITS = [
  ['сила', 'Н'], ['работа', 'Дж'], ['мощность', 'Вт'], ['давление', 'Па'], ['сила тока', 'А'], ['напряжение', 'В'], ['сопротивление', 'Ом'],
  ['электрический заряд', 'Кл'], ['частота', 'Гц'], ['количество теплоты', 'Дж'], ['удельная теплоёмкость', 'Дж/(кг·°C)'],
  ['удельная теплота плавления', 'Дж/кг'], ['плотность', 'кг/м³'], ['импульс', 'кг·м/с'], ['ускорение', 'м/с²'], ['жёсткость пружины', 'Н/м'],
  ['удельное сопротивление', 'Ом·мм²/м'], ['оптическая сила линзы', 'дптр'], ['период колебаний', 'с'],
  ['электроёмкость', 'Ф', 'ege'], ['индуктивность', 'Гн', 'ege'], ['магнитная индукция', 'Тл', 'ege'], ['магнитный поток', 'Вб', 'ege'],
  ['количество вещества', 'моль', 'ege'], ['абсолютная температура', 'К', 'ege'],
];
const BASE = [['Н', 'кг·м/с²'], ['Дж', 'кг·м²/с²'], ['Вт', 'кг·м²/с³'], ['Па', 'кг/(м·с²)'], ['Дж', 'Н·м'], ['Вт', 'Дж/с'], ['Па', 'Н/м²'], ['Кл', 'А·с'], ['Ом', 'В/А']];
const units = (lvl) => {
  const pool = UNITS.filter((u) => lvl > 0 || !u[2]);
  if (lvl === 2 && Math.random() < 0.5) {
    const [u, b] = pick(BASE);
    return choice(`1 ${u} = ?`, b, shuffle(BASE.filter((x) => x[0] !== u).map((x) => x[1])));
  }
  const [name, u] = pick(pool);
  if (Math.random() < 0.35 && pool.filter((x) => x[1] === u).length === 1) {
    return choice(`Что измеряется в «${u}»?`, name, shuffle(pool.filter((x) => x[1] !== u)).map((x) => x[0]));
  }
  return choice(`В чём измеряется ${name}?`, u, shuffle(pool.filter((x) => x[1] !== u)).map((x) => x[1]));
};

const CONV = [
  // [единица, множитель к базовой, базовая]
  ['мА', 1e-3, 'А'], ['кВт', 1e3, 'Вт'], ['МДж', 1e6, 'Дж'], ['кПа', 1e3, 'Па'], ['см', 1e-2, 'м'], ['мм', 1e-3, 'м'], ['км', 1e3, 'м'],
  ['г', 1e-3, 'кг'], ['т', 1e3, 'кг'], ['мин', 60, 'с'], ['ч', 3600, 'с'], ['л', 1e-3, 'м³'], ['см²', 1e-4, 'м²'], ['кОм', 1e3, 'Ом'], ['мВ', 1e-3, 'В'], ['МВт', 1e6, 'Вт'],
];
const conv = (lvl) => {
  if (Math.random() < 0.3) {
    const v = pick([18, 36, 54, 72, 90, 108, 144, 180]);
    return Math.random() < 0.6 ? { q: `${v} км/ч = ? м/с`, a: v / 3.6 } : { q: `${v / 3.6} м/с = ? км/ч`, a: v };
  }
  const [u, k, b] = pick(lvl === 0 ? CONV.slice(0, 11) : CONV);
  const x = k >= 1 ? pick([1.5, 2, 2.5, 3, 4, 5, 0.5, 12]) : pick([5, 20, 50, 200, 250, 500, 1500, 2500]);
  const val = +(x * k).toPrecision(10);
  return Math.random() < (lvl === 2 ? 0.5 : 0.2) && val >= 1e-3
    ? { q: `${fmt(val)} ${b} = ? ${u}`, a: x } : { q: `${fmt(x)} ${u} = ? ${b}`, a: val };
};

// ============================================================ Каталог
export const SKILLS = [
  { id: 'mul', s: 'math', ex: ['ОГЭ', 'ЕГЭ'], ico: '×', t: 'Быстрый счёт', d: 'Таблица умножения, двузначные, деление', gen: mul },
  { id: 'neg', s: 'math', ex: ['ОГЭ', 'ЕГЭ'], ico: '±', t: 'Отрицательные числа', d: 'Знаки, скобки и порядок действий', gen: negs },
  { id: 'frac', s: 'math', ex: ['ОГЭ', 'ЕГЭ'], ico: '½', t: 'Дроби', d: 'Обыкновенные ↔ десятичные, действия', gen: fracs },
  { id: 'pct', s: 'math', ex: ['ОГЭ', 'ЕГЭ'], ico: '%', t: 'Проценты', d: 'Процент от числа, увеличить, найти целое', gen: pct },
  { id: 'pow', s: 'math', ex: ['ОГЭ', 'ЕГЭ'], ico: '√', t: 'Степени и корни', d: 'Квадраты до 30, 2ⁿ, свойства корней', gen: pows },
  { id: 'eq', s: 'math', ex: ['ОГЭ', 'ЕГЭ'], ico: '𝑥', t: 'Уравнения в уме', d: 'Линейные и приведённые квадратные', gen: eqs },
  { id: 'trig', s: 'math', ex: ['ЕГЭ'], ico: '∠', t: 'Тригонометрия', d: 'sin, cos, tg на окружности — градусы и радианы', gen: trig, choice: 1 },
  { id: 'log', s: 'math', ex: ['ЕГЭ'], ico: 'log', t: 'Логарифмы', d: 'Значения и свойства логарифмов', gen: logs },
  { id: 'der', s: 'math', ex: ['ЕГЭ'], ico: '′', t: 'Производные', d: 'Таблица производных и правила', gen: ders, choice: 1 },
  { id: 'derive', s: 'phys', ex: ['ОГЭ', 'ЕГЭ'], ico: '⇄', t: 'Выведи формулу', d: 'Выразить величину из формулы', gen: derive, choice: 1 },
  { id: 'what', s: 'phys', ex: ['ОГЭ', 'ЕГЭ'], ico: 'ƒ', t: 'Узнай формулу', d: 'Что считается по этой формуле', gen: whatIs, choice: 1 },
  { id: 'units', s: 'phys', ex: ['ОГЭ', 'ЕГЭ'], ico: 'Дж', t: 'Единицы СИ', d: 'В чём измеряется и через основные', gen: units, choice: 1 },
  { id: 'conv', s: 'phys', ex: ['ОГЭ', 'ЕГЭ'], ico: '⇆', t: 'Перевод единиц', d: 'км/ч ↔ м/с, мА, кВт, см², литры', gen: conv },
];

// Проверка числового ответа: «0,75», «3/4», «−2», «1 500»
export function parseAns(s) {
  const t = String(s).trim().replace(/[−–—]/g, '-').replace(/\s/g, '').replace(',', '.');
  const m = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(t);
  if (m) return +m[2] ? +m[1] / +m[2] : NaN;
  return t === '' || !/^-?(\d+\.?\d*|\.\d+)$/.test(t) ? NaN : +t;
}
export const same = (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));
