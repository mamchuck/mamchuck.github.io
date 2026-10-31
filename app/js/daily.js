// Главная ученика: «Задание дня» (daily_quest) и «Работа над ошибками» (srs_due — интервальное повторение 1 → 3 → 7 дней).
import { h, raw, toast } from './ui.js?v=202610311433';
import { skillMeta } from '../../razminka/drill-ui.js?v=202610311433';

const word = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export async function loadDaily(api) {
  const [quest, srs] = await Promise.all([api.rpc('daily_quest').catch(() => null), api.rpc('srs_due', { p_limit: 0 }).catch(() => null)]);
  if (quest?.rewarded_now) setTimeout(() => toast('🎉 Задание дня выполнено! +30 XP'), 300);
  return { quest, srs };
}

export function questCard(q) {
  if (!q?.tasks?.length) return '';
  const sk = skillMeta(q.skill) || { ico: '⚡', t: 'Тренировка' };
  const pct = Math.round((100 * q.done) / q.total);
  const firstOpen = q.tasks.some((t) => !t.done) ? '#/trainer/quest' : `#/razminka/${q.skill}`;
  const row = (href, done, ok, title, sub) => h`<a class="dq-row ${done ? 'done' : ''} ${done && !ok ? 'miss' : ''}" href="${href}">
      <span class="dq-dot">${done ? raw(CHECK) : ''}</span><span class="dq-text"><b>${title}</b><small>${sub}</small></span><span class="dq-go">→</span></a>`;
  return h`<section class="card dq ${q.complete ? 'complete' : ''}">
    <div class="dq-head">
      <span class="dq-ico" aria-hidden="true">🎯</span>
      <div class="dq-title"><span class="g-label">Задание дня</span><b>${q.complete ? 'Выполнено! +30 XP 🎉' : `${q.done} из ${q.total} · ${q.total - q.done === 1 ? 'осталось одно' : `осталось ${q.total - q.done}`}`}</b></div>
      <span class="dq-pct">${pct}%</span>
    </div>
    <div class="dq-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
    <div class="dq-list">
      ${q.tasks.map((t) => row('#/trainer/quest', t.done, t.ok, `№ ${t.num}${t.topic ? ` · ${t.topic}` : ''}`,
        t.done ? (t.ok ? 'решено верно' : 'есть ошибка — задача придёт в работу над ошибками') : t.subject))}
      ${row(`#/razminka/${q.skill}`, q.skill_done, true, `${sk.ico} Тренировка: ${sk.t}`, q.skill_done ? 'раунд пройден' : '60 секунд')}
    </div>
    ${q.complete ? h`<p class="dq-note">Серия засчитана. Завтра — новое задание.</p>` : h`<a class="btn btn-primary dq-btn" href="${firstOpen}">${q.done ? 'Продолжить →' : 'Начать →'}</a>`}
  </section>`;
}

export function reviewCard(s) {
  if (!s || (!s.due && !s.waiting && !s.mastered)) return '';
  const when = s.next_at ? new Date(s.next_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : '';
  const text = s.due ? `${s.due} ${word(s.due, 'задача ждёт', 'задачи ждут', 'задач ждут')} повторения`
    : s.waiting ? `Сегодня всё повторено. Следующие задачи вернутся ${when}` : 'Все ошибки разобраны 🎉';
  const inner = h`<span class="g-goal-ico">🔁</span>
    <div><span class="g-label">Работа над ошибками · 1 → 3 → 7 дней</span><b>${text}</b>
      ${s.mastered ? h`<p class="dq-mastered">Освоено: ${s.mastered} ${word(s.mastered, 'задача', 'задачи', 'задач')}</p>` : ''}</div>
    ${s.due ? h`<span class="btn btn-primary g-goal-btn">Повторить →</span>` : ''}`;
  return s.due ? h`<a class="g-goal dq-review" href="#/trainer/review">${inner}</a>` : h`<section class="g-goal dq-review calm">${inner}</section>`;
}
