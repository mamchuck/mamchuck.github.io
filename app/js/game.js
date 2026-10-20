// Геймификация: 🔥 серия, уровень (XP), дорожная карта ОГЭ (SVG), награды.
// Все данные — одним вызовом game_state(student_id); считает база, страница только рисует.
import { h, raw, $, $$, toast } from './ui.js?v=202610201548';

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

// ---------- 🗺 Дорожная карта (SVG-линия + узлы) ----------
const STEP = 92, MOD_GAP = 64, W = 360;
const XS = [0.5, 0.78, 0.5, 0.22];

function roadmap(map, subject, linkFor) {
  const nodes = map.filter((n) => n.subject === subject);
  if (!nodes.length) return '';
  // фокус — первый «в работе», иначе первый закрытый замком
  const focus = (nodes.find((n) => n.status === 'active') || nodes.find((n) => n.status === 'locked'))?.num;
  let y = 16, prevModule = null, i = 0;
  const pts = [], labels = [];
  for (const n of nodes) {
    if (n.module !== prevModule) { if (prevModule) y += MOD_GAP - STEP / 2; labels.push({ y, text: n.module }); y += 84; prevModule = n.module; }
    pts.push({ ...n, x: XS[i % XS.length] * W, y });
    y += STEP; i += 1;
  }
  const H = y - STEP + 60;
  const seg = (a, b) => `M${a.x} ${a.y} C${a.x} ${(a.y + b.y) / 2}, ${b.x} ${(a.y + b.y) / 2}, ${b.x} ${b.y}`;
  const paths = pts.slice(1).map((b, k) => {
    const a = pts[k];
    const lit = a.status !== 'locked' && b.status !== 'locked';
    return `<path d="${seg(a, b)}" class="g-path ${lit ? 'lit' : ''}"/>`;
  }).join('');
  const done = nodes.filter((n) => n.status === 'done').length;

  return h`<section class="card g-map">
    <div class="g-map-head"><h3>${subject}: путь к ОГЭ</h3><span class="badge info">${done} из ${nodes.length} закрыто</span></div>
    <div class="g-legend"><span><i class="lg done"></i>закрыт</span><span><i class="lg active"></i>в работе</span><span><i class="lg locked"></i>не начат</span></div>
    <div class="g-map-body" style="--h:${H}px">
      ${raw(`<svg class="g-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="g-path-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fd0ff"/><stop offset=".55" stop-color="#2b8ad8"/><stop offset="1" stop-color="#1f6fd1"/></linearGradient></defs>${paths}</svg>`)}
      ${labels.map((l) => h`<div class="g-module" style="top:${(l.y / H) * 100}%">${l.text}</div>`)}
      ${pts.map((n) => {
        const r = 22, c = 2 * Math.PI * r, acc = n.accuracy ?? 0;
        return h`<a class="g-node ${n.status} ${n.num === focus ? 'focus' : ''}" href="${linkFor(n)}" style="left:${(n.x / W) * 100}%;top:${(n.y / H) * 100}%"
          title="№ ${n.num} · ${n.title}${n.attempts ? ` · ${n.correct} из ${n.attempts} верно` : ''}">
          <span class="g-dot">
            ${n.status === 'active' ? raw(`<svg class="g-ring" viewBox="0 0 52 52"><circle cx="26" cy="26" r="${r}"/><circle cx="26" cy="26" r="${r}" style="stroke-dasharray:${(c * acc) / 100} ${c}"/></svg>`) : ''}
            ${n.status === 'done' ? raw(CHECK) : n.status === 'locked' ? raw(LOCK) : h`<b>${n.num}</b>`}
          </span>
          <span class="g-cap"><b>№ ${n.num}</b>${n.title}${n.status === 'active' && n.accuracy != null ? h` · <em>${n.accuracy}%</em>` : ''}</span>
        </a>`;
      })}
    </div>
  </section>`;
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
function nextGoal(map, linkFor, isStudent) {
  const n = map.find((x) => x.status === 'active') || map.find((x) => x.status === 'locked');
  if (!n) return h`<section class="g-goal done"><span class="g-goal-ico">🏁</span><div><b>Все номера закрыты!</b><p>Теперь — полные варианты на время.</p></div></section>`;
  let text;
  if (n.status === 'locked') text = `Начни № ${n.num} · ${n.title}: реши 5 задач, чтобы увидеть точность`;
  else {
    const len = Math.min(n.attempts, 10), ok = Math.round(((n.accuracy || 0) * len) / 100);
    const more = Math.max(0, 5 - n.attempts);
    const need = Math.min(10, Math.max(0, Math.ceil((0.8 * len - ok) / 0.2)));
    const k = Math.max(more, need);
    text = k ? `Закрой № ${n.num} · ${n.title}: ещё ${k} ${word(k, 'верная задача', 'верные задачи', 'верных задач')} подряд` : `№ ${n.num} почти закрыт — реши ещё одну`;
  }
  return h`<section class="g-goal"><span class="g-goal-ico">🎯</span><div><span class="g-label">Следующая цель</span><b>${text}</b></div>
    ${isStudent ? h`<a class="btn btn-primary g-goal-btn" href="${linkFor(n)}">Решать № ${n.num} →</a>` : ''}</section>`;
}

// ---------- 🎉 Праздник: новый закрытый номер или уровень (сравнение с прошлым визитом) ----------
function celebrate(state, key) {
  let prev = null;
  try { prev = JSON.parse(localStorage.getItem(key)); } catch {}
  const done = state.map.filter((n) => n.status === 'done').map((n) => `${n.subject}|${n.num}`);
  try { localStorage.setItem(key, JSON.stringify({ done, level: state.xp.level })); } catch {}
  if (!prev) return;
  const fresh = state.map.filter((n) => n.status === 'done' && !prev.done.includes(`${n.subject}|${n.num}`));
  const msg = state.xp.level > prev.level ? `Новый уровень — ${state.xp.level}!`
    : fresh.length ? `№ ${fresh.map((n) => n.num).join(', ')} ${fresh.length > 1 ? 'закрыты' : 'закрыт'}!` : null;
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
export function gameBlock(state, { canClaim = false, studentId = '' } = {}) {
  if (!state) return '';
  const subjects = [...new Set(state.map.map((n) => n.subject))];
  const linkFor = canClaim ? (n) => `#/trainer/num/${encodeURIComponent(n.subject)}/${n.num}` : () => '#/trainer';
  if (canClaim && studentId) setTimeout(() => celebrate(state, `game:${studentId}`), 400);
  return h`<div class="g-wrap">
    <div class="g-top">${streakCard(state.streak)}${levelCard(state.xp)}</div>
    ${nextGoal(state.map, linkFor, canClaim)}
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
