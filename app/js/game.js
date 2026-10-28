// Геймификация: 🔥 серия, уровень (XP), дорожная карта (SVG: подтемы + медали номеров), награды.
// Все данные — одним вызовом game_state(student_id); считает база, страница только рисует.
import { h, raw, $, $$, toast } from './ui.js?v=202610290028';

const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const word = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
const CLAIM_LABEL = { requested: 'Ждёт подтверждения', approved: 'Подтверждено', used: 'Использовано', declined: 'Отклонено' };

export async function loadGame(api, studentId) {
  try { return await api.rpc('game_state', { p_student: studentId }); } catch { return null; }
}

// ---------- 🔥 Серия ----------
function streakCard(s) {
  const alive = s.current > 0;
  const hint = s.done_today ? 'Сегодня засчитано — так держать!'
    : alive ? 'Реши задачу сегодня, чтобы серия не сгорела' : 'Реши задачу — и серия начнётся';
  return h`<section class="g-streak ${alive ? 'on' : ''} ${s.done_today ? 'today' : ''}">
    <div class="g-flame" aria-hidden="true">🔥</div>
    <div class="g-streak-main">
      <span class="g-label">Серия</span>
      <b class="g-big">${s.current}<small> ${word(s.current, 'день', 'дня', 'дней')}</small></b>
      <span class="g-hint">${hint}</span>
    </div>
    <div class="g-streak-side">
      <span>Рекорд <b>${s.best}</b></span>
      <span title="Заморозка спасает серию, если пропустить один день">${'🧊'.repeat(s.freezes) || '—'} <small>заморозки</small></span>
    </div>
  </section>`;
}

// ---------- ⭐ Уровень ----------
function levelCard(x) {
  const pct = Math.max(0, Math.min(100, Math.round((100 * (x.total - x.level_from)) / Math.max(1, x.level_to - x.level_from))));
  return h`<section class="g-level card">
    <div class="g-level-badge"><span>ур.</span><b>${x.level}</b></div>
    <div class="g-level-main">
      <div class="g-level-row"><b>${x.total} XP</b><span class="hint">до уровня ${x.level + 1}: ${x.level_to - x.total} XP</span></div>
      <div class="g-bar"><i style="width:${pct}%"></i></div>
      <span class="hint">Верная задача +10 · ДЗ +30 · неделя серии +50</span>
    </div>
  </section>`;
}

// ---------- 🗺 Дорожная карта: подтемы-«камни» + номер с тремя уровнями (бронза → серебро → золото) ----------
const W = 360, STEP = 138, STONE = 62, MOD_GAP = 64;
const MEDAL = ['', 'бронза', 'серебро', 'золото'];
const MEDAL_ICO = ['', '🥉', '🥈', '🥇'];
// Прогресс к следующему уровню (0…1) — те же пороги, что в game_state (supabase/039)
function nextPct(n) {
  const t = n.topics || [], td = t.filter((x) => x.done).length;
  const acc = n.accuracy ?? 0, acc20 = n.acc20 ?? 0, a = n.attempts;
  const v = n.level === 0 ? Math.min(a / 5, acc / 60)
    : n.level === 1 ? Math.min(a / 12, acc / 80, t.length ? td / t.length : 1)
    : n.level === 2 ? (n.stale ? 0.9 : Math.min(a / 25, acc20 / 90, acc / 80, t.length ? td / t.length : 1)) : 1;
  return Math.max(0, Math.min(1, v));
}

function roadmap(map, subject, linkFor) {
  const nodes = map.filter((n) => n.subject === subject);
  if (!nodes.length) return '';
  const focus = goalNode(nodes);
  let y = 16, prevModule = null, k = 0;
  const pts = [], labels = [];
  const wave = () => 0.5 + 0.27 * Math.sin(k++ * 0.82);
  for (const n of nodes) {
    if (n.module !== prevModule) { if (prevModule) y += MOD_GAP - STONE / 2; labels.push({ y, text: n.module }); y += 80; prevModule = n.module; }
    for (const t of n.topics || []) { pts.push({ stone: true, n, t, x: wave() * W, y }); y += STONE; }
    if (n.topics?.length) y += 16;                                    // большой кружок номера не наезжает на последний камень
    pts.push({ n, x: wave() * W, y }); y += STEP;
  }
  const H = y - STEP + 70;
  const seg = (a, b) => `M${a.x} ${a.y} C${a.x} ${(a.y + b.y) / 2}, ${b.x} ${(a.y + b.y) / 2}, ${b.x} ${b.y}`;
  const litPt = (p) => (p.stone ? p.t.attempts > 0 : p.n.attempts > 0);
  const paths = pts.slice(1).map((b, i) => `<path d="${seg(pts[i], b)}" class="g-path ${litPt(pts[i]) && litPt(b) ? 'lit' : ''}"/>`).join('');
  const gold = nodes.filter((n) => n.status === 'done').length;
  const stars = nodes.reduce((s, n) => s + (n.level || 0), 0);
  const exam = subject === 'Профильная математика' ? 'ЕГЭ' : 'ОГЭ';

  return h`<section class="card g-map">
    <div class="g-map-head"><h3>${subject}: путь к ${exam}</h3>
      <span class="g-map-score"><span class="badge info">🥇 ${gold} из ${nodes.length}</span><span class="hint">медалей ${stars} из ${nodes.length * 3}</span></span></div>
    <div class="g-legend"><span><i class="lg m1"></i>бронза</span><span><i class="lg m2"></i>серебро</span><span><i class="lg m3"></i>золото — номер закрыт</span><span><i class="lg stone"></i>подтема</span></div>
    <div class="g-map-body" style="--h:${H}px">
      ${raw(`<svg class="g-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="g-path-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fd0ff"/><stop offset=".55" stop-color="#2b8ad8"/><stop offset="1" stop-color="#1f6fd1"/></linearGradient></defs>${paths}</svg>`)}
      ${labels.map((l) => h`<div class="g-module" style="top:${(l.y / H) * 100}%">${l.text}</div>`)}
      ${pts.map((p) => (p.stone ? stone(p, H, linkFor) : bigNode(p, H, linkFor, p.n === focus)))}
    </div>
  </section>`;
}

function stone(p, H, linkFor) {
  const { n, t } = p;
  const cls = t.done ? 'done' : t.attempts ? 'tried' : 'new';
  return h`<a class="g-stone ${cls} ${p.x > W / 2 ? 'left' : 'right'}" href="${linkFor(n, t.topic)}" style="left:${(p.x / W) * 100}%;top:${(p.y / H) * 100}%"
    title="№ ${n.num} · ${t.topic}${t.attempts ? ` · ${t.correct} из ${t.attempts} верно` : ' · ещё не решал'}">
    <span class="g-sdot">${t.done ? raw(CHECK) : t.attempts ? h`<b>${Math.min(t.correct, 3)}/3</b>` : ''}</span>
    <span class="g-scap">${t.topic}</span>
  </a>`;
}

function bigNode(p, H, linkFor, isFocus) {
  const n = p.n, r = 24, c = 2 * Math.PI * r, pct = nextPct(n);
  const medal = n.level ? `m${n.level}` : '';
  return h`<a class="g-node ${n.status} ${medal} ${n.stale ? 'stale' : ''} ${isFocus ? 'focus' : ''}" href="${linkFor(n)}" style="left:${(p.x / W) * 100}%;top:${(p.y / H) * 100}%"
    title="№ ${n.num} · ${n.title}${n.attempts ? ` · ${n.correct} из ${n.attempts} верно` : ''}">
    <span class="g-dot">
      ${n.attempts && n.status !== 'done' ? raw(`<svg class="g-ring" viewBox="0 0 56 56"><circle cx="28" cy="28" r="${r}"/><circle cx="28" cy="28" r="${r}" style="stroke-dasharray:${c * pct} ${c}"/></svg>`) : ''}
      ${n.status === 'done' ? raw(CHECK) : n.attempts ? h`<b>${n.num}</b>` : raw(LOCK)}
    </span>
    <span class="g-pips" aria-label="Уровень ${n.level} из 3">${[1, 2, 3].map((i) => h`<i class="${i <= n.level ? 'on' : ''}"></i>`)}</span>
    <span class="g-cap"><b>№ ${n.num}</b>${n.title}${n.stale ? h` · <em>↻ повтори</em>` : n.level ? h` · <em>${MEDAL[n.level]}</em>` : n.accuracy != null ? h` · <em>${n.accuracy}%</em>` : ''}</span>
  </a>`;
}

// ---------- 🎟 Награды ----------
function rewards(list, best, canClaim) {
  return h`<section class="g-rewards">
    <div class="section-head"><h2>Награды за серию</h2><span class="hint">открываются по рекорду серии</span></div>
    <div class="g-reward-grid">${list.map((r) => {
      const pct = Math.min(100, Math.round((100 * best) / r.need));
      return h`<div class="card g-reward ${r.unlocked ? 'open' : ''} ${r.claim ? 'claimed' : ''}">
        <div class="g-reward-ico">${r.icon}</div>
        <b>${r.title}</b>
        <p class="muted small">${r.description}</p>
        ${r.claim ? h`<span class="badge ${r.claim === 'declined' ? 'bad' : 'info'}">${CLAIM_LABEL[r.claim]}</span>`
          : r.unlocked ? (canClaim ? h`<button class="btn btn-primary btn-sm" data-claim="${r.id}">Забрать</button>` : h`<span class="badge info">Открыта</span>`)
          : h`<div class="g-bar sm"><i style="width:${pct}%"></i></div><span class="hint">${r.need} ${word(r.need, 'день', 'дня', 'дней')} подряд · осталось ${r.need - best}</span>`}
      </div>`;
    })}</div>
  </section>`;
}

// ---------- 🎯 Следующая цель ----------
// Сначала «потускневшее» золото, потом номер в работе, потом первый не начатый
function goalNode(nodes) {
  return nodes.find((n) => n.stale) || nodes.find((n) => n.status === 'active') || nodes.find((n) => n.status === 'locked');
}

function goalText(n) {
  const name = `№ ${n.num} · ${n.title}`, a = n.attempts, acc = n.accuracy ?? 0;
  const open = (n.topics || []).find((t) => !t.done);
  const more = (min) => (a < min ? `ещё ${min - a} ${word(min - a, 'задача', 'задачи', 'задач')}` : '');
  const join = (...x) => x.filter(Boolean).join(' и ');
  if (n.stale) return { text: `↻ Повтори ${name} — золото тускнеет без практики. Реши пару задач`, topic: null };
  if (n.level === 0) return a ? { text: `${name} до 🥉: ${join(more(5), acc < 60 ? `точность от 60% (сейчас ${acc}%)` : '')}`, topic: null }
    : { text: `Начни ${name}: 5 задач — и будет 🥉 бронза`, topic: null };
  if (n.level === 1) {
    if (open) return { text: `${name} до 🥈: закрой подтему «${open.topic}» — ${open.correct >= 3 ? 'точность 4 из последних 5' : `ещё ${3 - open.correct} ${word(3 - open.correct, 'верная', 'верные', 'верных')}`}`, topic: open.topic };
    return { text: `${name} до 🥈: ${join(more(12), acc < 80 ? `точность от 80% (сейчас ${acc}%)` : '')}`, topic: null };
  }
  if (open) return { text: `${name} до 🥇: подтема «${open.topic}» просела — подтяни`, topic: open.topic };
  return { text: `${name} до 🥇: ${join(more(25), (n.acc20 ?? 0) < 90 ? `90% из последних 20 (сейчас ${n.acc20 ?? 0}%)` : '', acc < 80 ? 'держи 80% в последних 10' : '') || 'ещё одна верная'}`, topic: null };
}

function nextGoal(map, linkFor, isStudent) {
  const n = goalNode(map);
  if (!n) return h`<section class="g-goal done"><span class="g-goal-ico">🏁</span><div><b>Все номера в золоте!</b><p>Теперь — полные варианты на время.</p></div></section>`;
  const g = goalText(n);
  return h`<section class="g-goal"><span class="g-goal-ico">🎯</span><div><span class="g-label">Следующая цель</span><b>${g.text}</b></div>
    ${isStudent ? h`<a class="btn btn-primary g-goal-btn" href="${linkFor(n, g.topic)}">Решать № ${n.num} →</a>` : ''}</section>`;
}

// ---------- 🎉 Праздник: новый закрытый номер или уровень (сравнение с прошлым визитом) ----------
function celebrate(state, key) {
  let prev = null;
  try { prev = JSON.parse(localStorage.getItem(key)); } catch {}
  const lv = Object.fromEntries(state.map.map((n) => [`${n.subject}|${n.num}`, n.level || 0]));
  try { localStorage.setItem(key, JSON.stringify({ lv, level: state.xp.level })); } catch {}
  if (!prev?.lv) return;
  const up = state.map.filter((n) => (n.level || 0) > (prev.lv[`${n.subject}|${n.num}`] ?? 0));
  const msg = state.xp.level > prev.level ? `Новый уровень — ${state.xp.level}!`
    : up.length ? up.map((n) => `№ ${n.num} — ${MEDAL_ICO[n.level]} ${MEDAL[n.level]}`).join(', ') + '!' : null;
  if (!msg) return;
  const el = document.createElement('div');
  el.className = 'g-party';
  el.innerHTML = `<div class="g-party-card"><span>🎉</span><b>${msg}</b><small>Так держать — карта растёт</small></div>`
    + Array.from({ length: 28 }, (_, i) => `<i style="--a:${(i * 360) / 28}deg;--d:${120 + (i % 5) * 34}px;--c:${['#8fd0ff', '#2b8ad8', '#ffffff', '#5cb3f2'][i % 4]}"></i>`).join('');
  document.body.appendChild(el);
  el.addEventListener('click', () => el.remove());
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3200);
}

// Полный блок: для ученика (с кнопкой «Забрать»), родителя и преподавателя
export function gameBlock(state, { canClaim = false, studentId = '', afterGoal = '' } = {}) {
  if (!state) return '';
  // база ещё без миграции 039 — уровней и подтем нет: считаем «закрыт» золотом, «в работе» бронзой
  for (const n of state.map) { n.level ??= n.status === 'done' ? 3 : n.attempts >= 5 ? 1 : 0; n.topics ??= []; n.stale ??= false; }
  const subjects = [...new Set(state.map.map((n) => n.subject))];
  const linkFor = canClaim ? (n, topic) => `#/trainer/num/${encodeURIComponent(n.subject)}/${n.num}${topic ? '/' + encodeURIComponent(topic) : ''}` : () => '#/trainer';
  if (canClaim && studentId) setTimeout(() => celebrate(state, `game2:${studentId}`), 400);
  return h`<div class="g-wrap">
    <div class="g-top">${streakCard(state.streak)}${levelCard(state.xp)}</div>
    ${nextGoal(state.map, linkFor, canClaim)}
    ${afterGoal}
    ${subjects.map((s) => roadmap(state.map, s, linkFor))}
    ${rewards(state.rewards, state.streak.best, canClaim)}
  </div>`;
}

export function bindGame(root, ctx, rerender) {
  $$('[data-claim]', root).forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await ctx.api.rpc('game_claim', { p_reward: b.dataset.claim }); toast('Награда твоя! Преподаватель получил уведомление'); rerender(); }
    catch (e) { toast(e.message, 'error'); b.disabled = false; }
  }));
}

// Для преподавателя: заявки на награды ученика — подтвердить / отметить использованной / отклонить
export async function tutorClaims(api, studentId, state) {
  let rows = [];
  try { rows = await api.select('game_claims', { eq: { student_id: studentId }, order: 'created_at', asc: false }); } catch { return ''; }
  if (!rows.length) return '';
  const R = Object.fromEntries((state?.rewards || []).map((r) => [r.id, r]));
  return h`<section class="card"><h3>Заявки на награды</h3><div class="list">${rows.map((c) => h`<div class="item">
    <div class="item-main"><div class="item-title">${R[c.reward_id]?.icon || '🎁'} ${R[c.reward_id]?.title || 'Награда'}</div>
      <div class="item-meta">${CLAIM_LABEL[c.status]}</div></div>
    <select class="input lead-status" data-claim-status="${c.id}" aria-label="Статус награды">
      ${Object.entries(CLAIM_LABEL).map(([k, l]) => h`<option value="${k}" ${c.status === k ? 'selected' : ''}>${l}</option>`)}
    </select></div>`)}</div></section>`;
}

export function bindTutorClaims(root, ctx) {
  $$('[data-claim-status]', root).forEach((s) => s.addEventListener('change', async () => {
    try { await ctx.api.update('game_claims', s.dataset.claimStatus, { status: s.value }); toast('Статус обновлён'); }
    catch (e) { toast(e.message, 'error'); }
  }));
}
