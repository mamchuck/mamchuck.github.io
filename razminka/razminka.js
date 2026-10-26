// Тренировка навыков (/razminka/): раунды по 60 секунд на автоматизм (счёт, дроби, степени, тригонометрия, формулы физики).
// Задания генерирует drills.js. Рекорды — в браузере; вошедшему ученику раунд засчитывается в XP и 🔥 серию (drill_finish).
import { CONFIG } from '../app/js/config.js?v=202610262010';
import { startFx } from '../diag/fx.js?v=202610262010';
import { SKILLS, parseAns, same, fmt } from './drills.js?v=202610262010';

const ROUND = 60;
const root = document.getElementById('rz');
const fx = startFx();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const touch = matchMedia('(pointer: coarse)').matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const MIX = { id: 'mix', ico: '🎲', t: 'Микс', d: 'Всё вперемешку — как на экзамене' };
let filter = store.get('rz:filter', { s: 'all', ex: 'all' });
let serverBest = {};

// ---------- Ученик вошёл в кабинет (сессия Supabase в этом же браузере) ----------
function session() {
  try {
    const k = Object.keys(localStorage).find((x) => /^sb-.+-auth-token$/.test(x));
    const s = k && JSON.parse(localStorage.getItem(k));
    return s?.access_token && s.expires_at * 1000 > Date.now() + 30e3 ? s.access_token : null;
  } catch { return null; }
}
async function rpc(fn, args) {
  const token = session();
  if (!token || !CONFIG.supabaseUrl) return null;
  const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST', body: JSON.stringify(args),
    headers: { apikey: CONFIG.supabaseAnonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return r.ok ? r.json().catch(() => null) : null;
}
const best = (id) => Math.max(store.get(`rz:best:${id}`, 0), serverBest[id] || 0);

// ---------- Выбор навыка ----------
function pool(f = filter) {
  return SKILLS.filter((k) => (f.s === 'all' || k.s === f.s) && (f.ex === 'all' || k.ex.includes(f.ex)));
}
function menu() {
  const list = pool();
  const seg = (name, val, label) => `<button class="rz-seg-b ${filter[name] === val ? 'on' : ''}" data-f="${name}" data-v="${val}">${label}</button>`;
  const card = (k) => `<button class="rz-card ${k.id === 'mix' ? 'rz-card-mix' : ''}" data-skill="${k.id}">
      <span class="rz-ico">${k.ico}</span>
      <span class="rz-card-main"><b>${k.t}</b><span class="muted">${k.d}</span>
        <span class="rz-tags">${(k.ex || []).map((e) => `<i>${e}</i>`).join('')}${k.s ? `<i class="s">${k.s === 'math' ? 'математика' : 'физика'}</i>` : ''}</span></span>
      <span class="rz-best">${best(k.id) ? `<small>рекорд</small><b>${best(k.id)}</b>` : '<small>60 с</small><b>▶</b>'}</span>
    </button>`;
  root.innerHTML = `
    <span class="l-chip">⚡ 60 секунд · бесплатно · без регистрации</span>
    <h1 class="x-title">Тренировка: <span class="x-grad">навыки на автомате</span></h1>
    <p class="x-sub">Счёт, дроби, степени, тригонометрия, формулы и единицы физики. Минута в день — и на экзамене руки делают это сами, а голова занята задачей.</p>
    <div class="rz-filters">
      <div class="rz-seg">${seg('s', 'all', 'Всё')}${seg('s', 'math', 'Математика')}${seg('s', 'phys', 'Физика')}</div>
      <div class="rz-seg">${seg('ex', 'all', 'ОГЭ и ЕГЭ')}${seg('ex', 'ОГЭ', 'ОГЭ')}${seg('ex', 'ЕГЭ', 'ЕГЭ')}</div>
    </div>
    <div class="rz-grid">${card({ ...MIX, ex: [] })}${list.map(card).join('')}</div>
    ${session() ? '<p class="rz-note">✓ Ты вошёл в кабинет — раунды дают XP и засчитываются в 🔥 серию.</p>'
      : '<p class="rz-note">Занимаешься со мной? Войди в <a href="../app/">кабинет</a> — раунды будут давать XP и держать 🔥 серию.</p>'}`;
  root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
    filter = { ...filter, [b.dataset.f]: b.dataset.v }; store.set('rz:filter', filter); menu();
  }));
  root.querySelectorAll('[data-skill]').forEach((b) => b.addEventListener('click', () => play(b.dataset.skill)));
  spotlight(root.querySelectorAll('.rz-card'));
}

function spotlight(els) {
  els.forEach((el) => el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`); el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));
}

// ---------- Раунд ----------
let G = null;   // состояние раунда

function play(id) {
  const mixPool = pool().length ? pool() : SKILLS;
  const skill = id === 'mix' ? MIX : SKILLS.find((k) => k.id === id);
  G = { id, skill, mixPool, score: 0, total: 0, combo: 0, maxCombo: 0, wrong: [], t0: 0, timer: 0, busy: false, task: null, src: null };
  history.pushState({ rz: 1 }, '', `#${id}`);
  root.innerHTML = `
    <div class="rz-play">
      <div class="rz-top">
        <button class="rz-x" data-quit aria-label="Выйти">✕</button>
        <div class="rz-bar"><i></i></div>
        <span class="rz-time">60</span>
      </div>
      <div class="rz-stats"><span class="rz-skill">${skill.ico} ${skill.t}</span><span class="rz-combo"></span><span class="rz-score">0</span></div>
      <div class="rz-card-q card" aria-live="polite"><div class="rz-count">3</div></div>
      <div class="rz-answer"></div>
    </div>`;
  root.querySelector('[data-quit]').addEventListener('click', quit);
  let n = 3;
  const c = root.querySelector('.rz-count');
  const tick = setInterval(() => {
    n -= 1;
    if (!G) return clearInterval(tick);
    if (n > 0) { c.textContent = n; return; }
    clearInterval(tick); start();
  }, 600);
  G.timer = tick;
}

function start() {
  G.t0 = performance.now();
  const bar = root.querySelector('.rz-bar i'), tm = root.querySelector('.rz-time');
  const loop = () => {
    if (!G) return;
    const left = Math.max(0, ROUND - (performance.now() - G.t0) / 1000);
    bar.style.transform = `scaleX(${left / ROUND})`;
    tm.textContent = Math.ceil(left);
    tm.classList.toggle('hot', left < 10);
    if (left <= 0) return finish();
    G.raf = requestAnimationFrame(loop);
  };
  G.raf = requestAnimationFrame(loop);
  next();
}

const level = () => (G.score < 5 ? 0 : G.score < 12 ? 1 : 2);

function next() {
  const src = G.id === 'mix' ? G.mixPool[Math.floor(Math.random() * G.mixPool.length)] : G.skill;
  let t, guard = 0;
  do { t = src.gen(level()); guard++; } while (G.task && t.q === G.task.q && guard < 5);   // не повторять подряд
  G.task = t; G.src = src; G.busy = false;
  const q = root.querySelector('.rz-card-q');
  q.innerHTML = `${G.id === 'mix' ? `<span class="rz-from">${src.ico} ${src.t}</span>` : ''}<div class="rz-q">${t.q}</div>${t.hint ? `<span class="rz-hint">${t.hint}</span>` : ''}`;
  q.classList.remove('ok', 'bad'); void q.offsetWidth; q.classList.add('in');
  const a = root.querySelector('.rz-answer');
  if (t.choices) {
    a.innerHTML = `<div class="rz-choices">${t.choices.map((c, i) => `<button class="rz-ch" data-i="${i}"><kbd>${i + 1}</kbd><span>${c}</span></button>`).join('')}</div>`;
    a.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => answer(+b.dataset.i)));
  } else {
    a.innerHTML = `<form class="rz-form" autocomplete="off">
        ${t.pre ? `<span class="rz-pre">${t.pre}</span>` : ''}
        <input class="x-input rz-in" name="a" ${touch ? 'readonly inputmode="none"' : 'inputmode="decimal"'} placeholder="Ответ" aria-label="Ответ">
        <button class="btn btn-primary">OK</button></form>
      ${touch ? `<div class="rz-pad">${['7', '8', '9', '⌫', '4', '5', '6', '−', '1', '2', '3', '/', '0', ',', '✓'].map((k) => `<button type="button" data-k="${k}" class="${k === '✓' ? 'go' : ''}">${k}</button>`).join('')}</div>` : ''}`;
    const form = a.querySelector('form'), inp = form.a;
    form.addEventListener('submit', (e) => { e.preventDefault(); if (inp.value.trim()) answer(inp.value); });
    a.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const k = b.dataset.k;
      if (k === '⌫') inp.value = inp.value.slice(0, -1);
      else if (k === '✓') { if (inp.value.trim()) answer(inp.value); }
      else inp.value += k;
    }));
    if (!touch) inp.focus();
  }
}

function answer(v) {
  if (!G || G.busy) return;
  const t = G.task;
  let ok, mine, right;
  if (t.choices) { ok = v === t.ok; mine = t.choices[v]; right = t.show ?? t.choices[t.ok]; }
  else {
    const x = parseAns(v);
    ok = Number.isFinite(x) && same(x, t.a) && (!t.needFrac || v.includes('/'));
    mine = esc(v); right = t.show ?? fmt(t.a);
  }
  G.total += 1;
  const q = root.querySelector('.rz-card-q');
  q.classList.remove('in');
  if (ok) {
    G.score += 1; G.combo += 1; G.maxCombo = Math.max(G.maxCombo, G.combo);
    q.classList.add('ok');
    root.querySelector('.rz-score').textContent = G.score;
    const c = root.querySelector('.rz-combo');
    c.textContent = G.combo >= 3 ? `🔥 ×${G.combo}` : '';
    c.classList.remove('pop'); void c.offsetWidth; if (G.combo >= 3) c.classList.add('pop');
    if (G.combo > 0 && G.combo % 10 === 0) fx.burst('#2b8ad8');
    G.busy = true; setTimeout(() => G && next(), 180);
  } else {
    G.combo = 0; root.querySelector('.rz-combo').textContent = '';
    G.wrong.push({ q: t.q, mine, right, from: G.src });
    q.classList.add('bad');
    q.insertAdjacentHTML('beforeend', `<div class="rz-right">Верно: <b>${right}</b></div>`);
    if (t.choices) root.querySelectorAll('.rz-ch').forEach((b) => b.classList.toggle('good', +b.dataset.i === t.ok));
    G.busy = true; setTimeout(() => G && next(), 1100);                    // время на чтение правильного ответа — штраф сам собой
  }
}

addEventListener('keydown', (e) => {
  if (!G?.task?.choices || G.busy) return;
  const i = '1234'.indexOf(e.key);
  if (i >= 0) { e.preventDefault(); answer(i); }
});

function stop() {
  if (!G) return;
  cancelAnimationFrame(G.raf); clearInterval(G.timer);
}
function quit() { stop(); G = null; if (location.hash) history.back(); else menu(); }
addEventListener('popstate', () => { if (G) { stop(); G = null; } menu(); });

// ---------- Итог ----------
async function finish() {
  stop();
  const g = G; G = null;
  const prev = best(g.id), isBest = g.score > prev && g.score > 0;
  if (isBest) store.set(`rz:best:${g.id}`, g.score);
  const acc = g.total ? Math.round((100 * g.score) / g.total) : 0;
  const pace = g.score ? (ROUND / g.score).toFixed(1).replace('.', ',') : '—';
  root.innerHTML = `
    <div class="rz-end">
      <div class="card rz-res ${isBest ? 'best' : ''}">
        <span class="g-label">${g.skill.ico} ${g.skill.t}</span>
        <b class="rz-big">${g.score}</b>
        <span class="muted">${g.score % 10 === 1 && g.score % 100 !== 11 ? 'верный ответ' : g.score % 10 >= 2 && g.score % 10 <= 4 && (g.score % 100 < 12 || g.score % 100 > 14) ? 'верных ответа' : 'верных ответов'} за минуту</span>
        ${isBest ? `<span class="rz-badge">🏆 Новый рекорд${prev ? ` · было ${prev}` : ''}</span>` : prev ? `<span class="rz-badge soft">Рекорд — ${prev}</span>` : ''}
        <div class="rz-kpi"><span><b>${acc}%</b><small>точность</small></span><span><b>${pace} с</b><small>на ответ</small></span><span><b>${g.maxCombo}</b><small>лучшее комбо</small></span></div>
        <p class="rz-xp" hidden></p>
        <div class="rz-actions"><button class="btn btn-primary" data-again>Ещё раунд</button><button class="btn btn-ghost" data-menu>Другой навык</button></div>
      </div>
      ${g.wrong.length ? `<div class="card rz-mist"><b>Разбор ошибок${g.wrong.length > 10 ? ` · первые 10 из ${g.wrong.length}` : ''}</b>${g.wrong.slice(0, 10).map((w) => `
        <div class="rz-m">${g.id === 'mix' ? `<span class="rz-from">${w.from.ico} ${w.from.t}</span>` : ''}<div class="rz-mq">${w.q}</div>
          <div class="rz-ma"><span class="bad">Твой ответ: ${w.mine}</span><span class="good">Верно: <b>${w.right}</b></span></div></div>`).join('')}</div>` : ''}
      <div class="card rz-cta"><b>Хочешь так же уверенно решать задачи?</b><p class="muted">Диагностика за 12 минут покажет, какие номера экзамена проседают.</p>
        <a class="btn btn-primary" href="../diag/">Пройти диагностику</a></div>
    </div>`;
  if (isBest) fx.burst('#e0a91a');
  root.querySelector('[data-again]').addEventListener('click', () => { history.replaceState(null, '', location.pathname); play(g.id); });
  root.querySelector('[data-menu]').addEventListener('click', () => { history.replaceState(null, '', location.pathname); menu(); });
  scrollTo({ top: 0, behavior: 'smooth' });

  const r = await rpc('drill_finish', { p_skill: g.id, p_score: g.score, p_total: g.total }).catch(() => null);
  if (r) {
    serverBest[g.id] = r.best;
    const el = root.querySelector('.rz-xp');
    if (el) { el.hidden = false; el.textContent = r.xp ? `+${r.xp} XP в кабинет${r.streak ? ' · 🔥 серия засчитана' : ''}` : r.capped ? 'XP за тренировку на сегодня уже набран — рекорд всё равно сохранён' : 'Раунд сохранён в кабинете'; }
  }
}

// ---------- Старт ----------
(async () => {
  const st = await rpc('drill_state', {}).catch(() => null);
  if (st) serverBest = st;
  const id = location.hash.slice(1);
  if (id && (id === 'mix' || SKILLS.some((k) => k.id === id))) { history.replaceState(null, '', location.pathname); menu(); play(id); }
  else menu();
})();
