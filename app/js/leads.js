// Заявки: лиды из диагностики ОГЭ (таблица xray_sessions). Статус, контакт, готовое сообщение.
import { h, mount, $, $$, I, toast, fmtDT, empty, pageHero } from './ui.js?v=202610221803';

const STATUS = [
  ['new', 'Новый'], ['contacted', 'Написал'], ['trial', 'Пробное'], ['student', 'Ученик'], ['lost', 'Отказ'],
];
const GRADE_CLS = { 2: 'bad', 3: 'warn', 4: 'info', 5: 'ok' };
const weak = (s) => (s.result?.items || []).filter((i) => !i.ok).map((i) => i.num);

function message(s) {
  const w = weak(s);
  return `Привет! Это Илья, репетитор по математике и физике. Посмотрел твою диагностику ОГЭ по предмету «${s.subject}»: `
    + `прогноз «${s.result?.grade}»${w.length ? `, просели задания № ${w.join(', ')}` : ', ошибок нет — отличный результат'}. `
    + `${w.length ? 'Это закрывается за 2–3 недели. ' : ''}Давай разберём на бесплатном пробном занятии — 30 минут онлайн. `
    + 'Когда удобно: завтра или послезавтра вечером?';
}

export async function leadsPage(view, _p, ctx) {
  let rows;
  try {
    // только завершённые и без тяжёлого поля answers; последние 1000 — список не растёт бесконечно
    rows = await ctx.api.select('xray_sessions', { cols: 'id,created_at,finished_at,subject,result,tg_chat_id,tg_name,tg_username,lead_status,trial_requested_at',
      notNull: ['finished_at'], order: 'created_at', asc: false, limit: 1000 });
  } catch {
    mount(view, h`${pageHero({ eyebrow: 'Заявки', title: 'Лиды из ', accent: 'диагностики' })}
      ${empty('Раздел включится после обновления базы (supabase/013_leads.sql).', I.inbox)}`);
    return;
  }
  rows = rows.filter((s) => s.finished_at);
  let filter = 'tg';

  const draw = () => {
    const list = rows.filter((s) => (filter === 'tg' ? s.tg_chat_id : filter === 'all' ? true : s.lead_status === filter));
    const cnt = (f) => rows.filter((s) => (f === 'tg' ? s.tg_chat_id : f === 'all' ? true : s.lead_status === f)).length;
    const chips = [['tg', 'В Telegram'], ...STATUS, ['all', 'Все']];
    mount(view, h`
      ${pageHero({ eyebrow: 'Заявки', title: 'Лиды из ', accent: 'диагностики', sub: 'Кто прошёл диагностику и забрал разбор в Telegram. Пиши в первые 15 минут — так больше шансов на пробное.' })}
      <div class="lead-chips">${chips.map(([k, l]) => h`<button class="chip ${filter === k ? 'on' : ''}" data-f="${k}">${l} · ${cnt(k)}</button>`)}</div>
      ${list.length ? h`<div class="lead-list">${list.map((s) => {
        const w = weak(s), g = s.result?.grade;
        const contact = s.tg_username ? `https://t.me/${s.tg_username}` : s.tg_chat_id ? `tg://user?id=${s.tg_chat_id}` : null;
        return h`<div class="card lead" data-id="${s.id}">
          <div class="lead-top">
            <span class="badge ${GRADE_CLS[g] || ''}">прогноз «${g}»</span>
            <b>ОГЭ · ${s.subject}</b>
            ${s.trial_requested_at ? h`<span class="badge warn">🔥 хочет пробное</span>` : ''}
            <span class="hint lead-date">${fmtDT(s.created_at)}</span>
          </div>
          <div class="lead-meta">Верно ${s.result?.correct} из ${s.result?.total}${w.length ? ` · слабые № ${w.join(', ')}` : ' · без ошибок'}</div>
          <div class="lead-meta">${contact ? h`👤 <a href="${contact}" target="_blank" rel="noopener">${s.tg_username ? '@' + s.tg_username : (s.tg_name || 'профиль в Telegram')}</a>` : h`<span class="hint">Не перешёл в Telegram — контакта нет</span>`}</div>
          <div class="lead-actions">
            <select class="input lead-status" data-status aria-label="Статус">${STATUS.map(([k, l]) => h`<option value="${k}" ${s.lead_status === k ? 'selected' : ''}>${l}</option>`)}</select>
            ${contact ? h`<button class="btn btn-primary btn-sm" data-write>Скопировать сообщение и написать</button>` : ''}
          </div>
        </div>`;
      })}</div>` : empty(filter === 'tg' ? 'Пока никто не забрал разбор в Telegram' : 'Здесь пусто', I.inbox)}`);

    $$('[data-f]', view).forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; draw(); }));
    $$('.lead', view).forEach((el) => {
      const s = rows.find((r) => r.id === el.dataset.id);
      $('[data-status]', el).addEventListener('change', async (e) => {
        try { await ctx.api.update('xray_sessions', s.id, { lead_status: e.target.value }); s.lead_status = e.target.value; toast('Статус обновлён'); draw(); }
        catch (err) { toast(err.message, 'error'); e.target.value = s.lead_status; }
      });
      $('[data-write]', el)?.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(message(s)); toast('Сообщение скопировано — вставь в чат'); } catch {}
        window.open(s.tg_username ? `https://t.me/${s.tg_username}` : `tg://user?id=${s.tg_chat_id}`, '_blank');
        if (s.lead_status === 'new') {
          try { await ctx.api.update('xray_sessions', s.id, { lead_status: 'contacted' }); s.lead_status = 'contacted'; $('[data-status]', el).value = 'contacted'; } catch {}
        }
      });
    });
  };
  draw();
}
