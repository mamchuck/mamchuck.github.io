// Тренировка навыков: интерфейс (выбор навыка → раунд 60 с → итог). Общий для открытой страницы /razminka/ и кабинета (#/razminka).
// mountDrill(root, opts):
//   rpc(fn, args)  — вызов базы (drill_finish, drill_state) или null, если ученик не вошёл;
//   hero, note     — HTML шапки меню и подписи под навыками;
//   fx             — { burst(color) } — вспышка фона (на открытой странице — шейдер), необязательно;
//   history        — true: раунд в адресе (#mul) и «Назад» браузера (только открытая страница);
//   cta            — HTML карточки под итогом раунда;
//   start          — id навыка, чтобы сразу начать раунд.
import { SKILLS, parseAns, same, fmt } from './drills.js?v=202610311516';

const ROUND = 60;
const MIX = { id: 'mix', ico: '🎲', t: 'Микс', d: 'Всё вперемешку — как на экзамене' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const answersWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'верный ответ' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'верных ответа' : 'верных ответов');
export const skillMeta = (id) => (id === 'mix' ? MIX : SKILLS.find((k) => k.id === id));

export function mountDrill(root, opts = {}) {
  const { rpc = async () => null, hero = '', note = '', fx = { burst() {} }, history: useHistory = false, cta = '' } = opts;
  const touch = matchMedia('(pointer: coarse)').matches;
  let filter = store.get('rz:filter', { s: 'all', ex: 'all' });
  let serverBest = {};
  let G = null;   // состояние раунда
  const alive = () => root.isConnected;
  const best = (id) => Math.max(store.get(`rz:best:${id}`, 0), serverBest[id] || 0);
  const pool = () => SKILLS.filter((k) => (filter.s === 'all' || k.s === filter.s) && (filter.ex === 'all' || k.ex.includes(filter.ex)));

  // ---------- Выбор навыка ----------
  function menu() {
    const seg = (name, val, label) => `<button class="rz-seg-b ${filter[name] === val ? 'on' : ''}" data-f="${name}" data-v="${val}">${label}</button>`;
    const card = (k) => `<button class="rz-card ${k.id === 'mix' ? 'rz-card-mix' : ''}" data-skill="${k.id}">
        <span class="rz-ico">${k.ico}</span>
        <span class="rz-card-main"><b>${k.t}</b><span class="muted">${k.d}</span>
          <span class="rz-tags">${(k.ex || []).map((e) => `<i>${e}</i>`).join('')}${k.s ? `<i class="s">${k.s === 'math' ? 'математика' : 'физика'}</i>` : ''}</span></span>
        <span class="rz-best">${best(k.id) ? `<small>рекорд</small><b>${best(k.id)}</b>` : '<small>60 с</small><b>▶</b>'}</span>
      </button>`;
    root.innerHTML = `${hero}
      <div class="rz-filters">
        <div class="rz-seg">${seg('s', 'all', 'Всё')}${seg('s', 'math', 'Математика')}${seg('s', 'phys', 'Физика')}</div>
        <div class="rz-seg">${seg('ex', 'all', 'ОГЭ и ЕГЭ')}${seg('ex', 'ОГЭ', 'ОГЭ')}${seg('ex', 'ЕГЭ', 'ЕГЭ')}</div>
      </div>
      <div class="rz-grid">${card({ ...MIX, ex: [] })}${pool().map(card).join('')}</div>
      ${note}`;
    root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
      filter = { ...filter, [b.dataset.f]: b.dataset.v }; store.set('rz:filter', filter); menu();
    }));
    root.querySelectorAll('[data-skill]').forEach((b) => b.addEventListener('click', () => play(b.dataset.skill)));
    root.querySelectorAll('.rz-card').forEach((el) => el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`); el.style.setProperty('--my', `${e.clientY - r.top}px`);
    }));
  }

  // ---------- Раунд ----------
  function play(id) {
    const skill = skillMeta(id);
    if (!skill) return menu();
    G = { id, skill, mixPool: pool().length ? pool() : SKILLS, score: 0, total: 0, combo: 0, maxCombo: 0, wrong: [], t0: 0, timer: 0, raf: 0, busy: false, task: null, src: null };
    if (useHistory) history.pushState({ rz: 1 }, '', `#${id}`);
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
    root.scrollIntoView?.({ block: 'start' });
    let n = 3;
    const c = root.querySelector('.rz-count');
    G.timer = setInterval(() => {
      n -= 1;
      if (!G || !alive()) { stop(); return; }
      if (n > 0) { c.textContent = n; return; }
      clearInterval(G.timer); start();
    }, 600);
  }

  function start() {
    G.t0 = performance.now();
    const bar = root.querySelector('.rz-bar i'), tm = root.querySelector('.rz-time');
    const loop = () => {
      if (!G) return;
      if (!alive()) { stop(); G = null; return; }                          // ушли со страницы посреди раунда
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
    if (!G) return;
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
          <input class="rz-in" name="a" ${touch ? 'readonly inputmode="none"' : 'inputmode="decimal"'} placeholder="Ответ" aria-label="Ответ">
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
      if (!touch) inp.focus({ preventScroll: true });
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
      if (G.combo % 10 === 0) fx.burst('#2b8ad8');
      G.busy = true; setTimeout(next, 180);
    } else {
      G.combo = 0; root.querySelector('.rz-combo').textContent = '';
      G.wrong.push({ q: t.q, mine, right, from: G.src });
      q.classList.add('bad');
      q.insertAdjacentHTML('beforeend', `<div class="rz-right">Верно: <b>${right}</b></div>`);
      if (t.choices) root.querySelectorAll('.rz-ch').forEach((b) => b.classList.toggle('good', +b.dataset.i === t.ok));
      G.busy = true; setTimeout(next, 1100);                                // время на чтение правильного ответа — штраф сам собой
    }
  }

  const onKey = (e) => {
    if (!alive()) { removeEventListener('keydown', onKey); return; }
    if (!G?.task?.choices || G.busy) return;
    const i = '1234'.indexOf(e.key);
    if (i >= 0) { e.preventDefault(); answer(i); }
  };
  addEventListener('keydown', onKey);

  function stop() { if (G) { cancelAnimationFrame(G.raf); clearInterval(G.timer); } }
  function quit() { stop(); G = null; if (useHistory && location.hash) history.back(); else menu(); }
  if (useHistory) addEventListener('popstate', () => { if (G) { stop(); G = null; } menu(); });

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
          <span class="muted">${answersWord(g.score)} за минуту</span>
          ${isBest ? `<span class="rz-badge">🏆 Новый рекорд${prev ? ` · было ${prev}` : ''}</span>` : prev ? `<span class="rz-badge soft">Рекорд — ${prev}</span>` : ''}
          <div class="rz-kpi"><span><b>${acc}%</b><small>точность</small></span><span><b>${pace} с</b><small>на ответ</small></span><span><b>${g.maxCombo}</b><small>лучшее комбо</small></span></div>
          <p class="rz-xp" hidden></p>
          <div class="rz-actions"><button class="btn btn-primary" data-again>Ещё раунд</button><button class="btn btn-ghost" data-menu>Другой навык</button></div>
        </div>
        ${g.wrong.length ? `<div class="card rz-mist"><b>Разбор ошибок${g.wrong.length > 10 ? ` · первые 10 из ${g.wrong.length}` : ''}</b>${g.wrong.slice(0, 10).map((w) => `
          <div class="rz-m">${g.id === 'mix' ? `<span class="rz-from">${w.from.ico} ${w.from.t}</span>` : ''}<div class="rz-mq">${w.q}</div>
            <div class="rz-ma"><span class="bad">Твой ответ: ${w.mine}</span><span class="good">Верно: <b>${w.right}</b></span></div></div>`).join('')}</div>` : ''}
        ${cta}
      </div>`;
    if (isBest) fx.burst('#e0a91a');
    const reset = () => { if (useHistory) history.replaceState(null, '', location.pathname + location.search); };
    root.querySelector('[data-again]').addEventListener('click', () => { reset(); play(g.id); });
    root.querySelector('[data-menu]').addEventListener('click', () => { reset(); menu(); });
    root.scrollIntoView?.({ block: 'start', behavior: 'smooth' });

    const r = await rpc('drill_finish', { p_skill: g.id, p_score: g.score, p_total: g.total }).catch(() => null);
    const el = root.querySelector('.rz-xp');
    if (r && el) {
      serverBest[g.id] = r.best;
      el.hidden = false;
      el.textContent = r.xp ? `+${r.xp} XP${r.streak ? ' · 🔥 серия засчитана' : ''} · результат сохранён в прогрессе`
        : r.capped ? 'Результат сохранён. XP за тренировку на сегодня уже набран' : 'Результат сохранён в прогрессе';
    }
  }

  // ---------- Старт ----------
  (async () => {
    const st = await rpc('drill_state', {}).catch(() => null);
    if (st) serverBest = st;
    if (!alive()) return;
    if (opts.start && skillMeta(opts.start)) { menu(); play(opts.start); } else menu();
  })();
}
