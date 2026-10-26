// Тренировка навыков в кабинете: раздел #/razminka (тот же интерфейс, что на сайте — razminka/drill-ui.js)
// и блок «Тренировка навыков» в прогрессе (drill_stats: рекорды, график последних раундов, неделя).
import { h, raw, pageHero } from './ui.js?v=202610262146';
import { mountDrill, skillMeta } from '../../razminka/drill-ui.js?v=202610262146';

const word = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };

export async function drillPage(view, params, ctx) {
  view.innerHTML = '<div class="rz-root"></div>';
  mountDrill(view.firstElementChild, {
    rpc: (fn, args) => ctx.api.rpc(fn, args),
    start: params[0] || '',
    hero: pageHero({ eyebrow: 'Тренировка навыков · 60 секунд', title: 'Навыки ', accent: 'на автомате',
      sub: 'Счёт, дроби, степени, тригонометрия, формулы и единицы физики. Каждый раунд сохраняется в прогресс.' }).s,
    cta: `<a class="card rz-cta rz-cta-link" href="#/progress"><b>📈 Все результаты — в прогрессе</b><span class="muted">Рекорды по навыкам и график последних раундов</span></a>`,
  });
}

export async function loadDrill(api, studentId) {
  try { return await api.rpc('drill_stats', { p_student: studentId }); } catch { return null; }
}

// Мини-график последних раундов: линия + заливка, последняя точка подсвечена
function spark(vals, best) {
  if (vals.length < 2) return '';
  const W = 132, H = 40, max = Math.max(best, ...vals, 1);
  const pts = vals.map((v, i) => [4 + (i * (W - 8)) / (vals.length - 1), H - 4 - ((H - 10) * v) / max]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return `<svg class="dr-spark" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <defs><linearGradient id="dr-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4aa8f5" stop-opacity=".35"/><stop offset="1" stop-color="#4aa8f5" stop-opacity="0"/></linearGradient></defs>
    <path d="${line} L${lx.toFixed(1)} ${H} L4 ${H} Z" fill="url(#dr-fill)"/>
    <path d="${line}" fill="none" stroke="#2b8ad8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.6" fill="#fff" stroke="#2b8ad8" stroke-width="2"/></svg>`;
}

export function drillBlock(st, { canPlay = false } = {}) {
  if (!st) return '';
  const skills = (st.skills || []).filter((s) => skillMeta(s.skill));
  const play = (id) => (canPlay ? `#/razminka${id ? '/' + id : ''}` : null);
  const tile = (s) => {
    const m = skillMeta(s.skill), r = s.recent || [], last = r[r.length - 1] ?? 0, prev = r[r.length - 2];
    const d = prev == null ? null : last - prev;
    const inner = h`
      <div class="dr-tile-head"><span class="dr-ico">${m.ico}</span><b>${m.t}</b></div>
      <div class="dr-tile-mid"><div class="dr-best"><small>рекорд</small><b>${s.best}</b></div>${raw(spark(r, s.best))}</div>
      <div class="dr-tile-foot"><span>последний: <b>${last}</b>${d == null ? '' : h` <i class="dr-d ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '▲ +' + d : d < 0 ? '▼ ' + d : '='}</i>`}</span>
        <span>${s.rounds} ${word(s.rounds, 'раунд', 'раунда', 'раундов')}${s.acc != null ? ` · ${s.acc}%` : ''}</span></div>`;
    return canPlay ? h`<a class="dr-tile" href="${play(s.skill)}">${inner}</a>` : h`<div class="dr-tile">${inner}</div>`;
  };
  const days = st.week_days || 0;
  return h`<section class="card dr-wrap">
    <div class="dr-head"><div><span class="g-label">⚡ Тренировка навыков</span><h3>Счёт и формулы на автомате</h3></div>
      ${canPlay ? h`<a class="btn btn-primary" href="${play()}">Тренироваться →</a>` : ''}</div>
    <div class="dr-week">
      <div><b>${st.week_rounds || 0}</b><small>${word(st.week_rounds || 0, 'раунд', 'раунда', 'раундов')} за 7 дней</small></div>
      <div><b>${st.week_correct || 0}</b><small>верных ответов за 7 дней</small></div>
      <div><span class="dr-dots" aria-label="${days} из 7 дней">${Array.from({ length: 7 }, (_, i) => h`<i class="${i < days ? 'on' : ''}"></i>`)}</span><small>${days} из 7 дней с тренировкой</small></div>
    </div>
    ${skills.length ? h`<div class="dr-grid">${skills.map(tile)}</div>`
      : h`<div class="dr-empty"><span>⚡</span><p>${canPlay ? 'Пока ни одного раунда. Минута в день — и счёт с формулами пойдут на автомате.' : 'Раундов пока не было.'}</p>
        ${canPlay ? h`<a class="btn btn-soft" href="${play()}">Первый раунд</a>` : ''}</div>`}
  </section>`;
}
