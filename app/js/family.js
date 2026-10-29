// Кабинеты ученика и родителя
import {
  h, mount, $, $$, I, toast, fmtDT, fmtD, fmtDay, plural, empty, hwStatus, levelLabel, safeFileName,
  pageHero, authorBar,
} from './ui.js?v=202610291759';
import { TUTOR } from './config.js?v=202610291759';
import { trainerFamily } from './trainer.js?v=202610291759';
import { mockView } from './mock.js?v=202610291759';
import { mountTelegramBanner } from './telegram.js?v=202610291759';
import { loadGame, gameBlock, bindGame } from './game.js?v=202610291759';
import { drillPage, loadDrill, drillBlock } from './drill.js?v=202610291759';
import { loadDaily, questCard, reviewCard } from './daily.js?v=202610291759';
import { cardsPage } from './cards.js?v=202610291759';
import { mountBoard } from './board.js?v=202610291759';

export const familyNav = (role) => (role === 'parent' ? [
  { path: '', label: 'Главная', icon: I.home },
  { path: 'homework', label: 'Домашние задания', short: 'ДЗ', icon: I.book },
  { path: 'lessons', label: 'Занятия', icon: I.calendar },
  { path: 'progress', label: 'Прогресс', icon: I.chart },
  { path: 'trainer', label: 'Банк задач', short: 'Задачи', icon: I.target },
  { path: 'cards', label: 'Шпаргалки', icon: I.cards },
  { path: 'mock', label: 'Пробный экзамен', short: 'Пробник', icon: I.clock },
  { path: 'materials', label: 'Материалы', icon: I.folder },
] : [
  { path: '', label: 'Главная', icon: I.home },
  { path: 'homework', label: 'Домашние задания', short: 'ДЗ', icon: I.book },
  { path: 'trainer', label: 'Банк задач', short: 'Задачи', icon: I.target },
  { path: 'razminka', label: 'Тренировка', icon: I.bolt },
  { path: 'cards', label: 'Шпаргалки', icon: I.cards },
  { path: 'mock', label: 'Пробный экзамен', short: 'Пробник', icon: I.clock },
  { path: 'lessons', label: 'Занятия', icon: I.calendar },
  { path: 'board', label: 'Доска', icon: I.board },
  { path: 'progress', label: 'Прогресс', icon: I.chart },
  { path: 'materials', label: 'Материалы', icon: I.folder },
]);

const isStudent = (ctx) => ctx.me.role === 'student';

// Аккаунт без привязанного ученика: по центру экрана + ввод кода приглашения
function noChild(view, ctx) {
  mount(view, h`<div class="empty-screen"><div class="card empty-card stack">
    <span class="empty-icon">${I.users}</span>
    <h2>Кабинет пока не подключён</h2>
    <p class="muted">Попросите у преподавателя ссылку или код приглашения и введите код ниже.</p>
    <form id="join-code" class="stack">
      <input name="code" class="code-input" placeholder="A1B2C3D4E5F6" maxlength="12" autocomplete="off" required aria-label="Код приглашения">
      <button class="btn btn-primary btn-block">Подключиться</button>
    </form></div></div>`);
  $('#join-code', view).addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button', e.target); btn.disabled = true; btn.classList.add('loading');
    try { await ctx.api.rpc('redeem_invitation', { p_code: e.target.code.value.trim() }); toast('Готово!'); location.hash = '#/'; location.reload(); }
    catch (err) { toast(err.message, 'error'); btn.disabled = false; btn.classList.remove('loading'); }
  });
}

async function openFile(api, path) {
  const w = window.open('', '_blank');
  try { const url = await api.fileUrl(path); if (w) w.location = url; else location.href = url; }
  catch (e) { w?.close(); toast(e.message, 'error'); }
}
function bindFiles(view, api) {
  $$('[data-open]', view).forEach((b) => b.addEventListener('click', () => openFile(api, b.dataset.open)));
}
const matLink = (m) => (m.file_path
  ? h`<button class="file-pill" data-open="${m.file_path}">${I.file}<span>${m.title}</span></button>`
  : h`<a class="file-pill" href="${m.url}" target="_blank" rel="noopener noreferrer">${I.link}<span>${m.title}</span></a>`);

const lessonItem = (l, mats = []) => h`
  <div class="item"><div class="item-main">
    <div class="item-title">${l.topic || l.subject}</div>
    <div class="item-meta">${l.subject} · ${fmtDT(l.starts_at)} · ${l.duration_min} мин</div>
    ${l.report ? h`<div class="item-text report">${l.report}</div>` : ''}
    ${mats.length ? h`<div class="files">${mats.map(matLink)}</div>` : ''}</div>
    ${l.status === 'cancelled' ? h`<span class="badge muted">Отменено</span>` : l.status === 'done' ? h`<span class="badge ok">Проведено</span>` : ''}</div>`;

const hwItem = (x, sub) => {
  const st = hwStatus(x, sub);
  return h`<a class="item item-link" href="#/hw/${x.id}"><div class="item-main">
    <div class="item-title">${x.title}</div>
    <div class="item-meta">${x.subject} · срок ${fmtD(x.due_at)}${sub?.grade ? ` · оценка ${sub.grade}` : ''}</div></div>
    <span class="badge ${st.cls}">${st.label}</span></a>`;
};

// ============================================================

async function home(view, _p, ctx) {
  const sid = ctx.studentId;
  if (!sid) return noChild(view, ctx);
  const { api } = ctx;
  const student = ctx.students.find((s) => s.id === sid);
  const [lessons, hws, subs, daily] = await Promise.all([
    api.select('lessons_public', { eq: { student_id: sid }, order: 'starts_at' }),
    api.select('homework', { eq: { student_id: sid }, order: 'due_at' }),
    api.select('submissions', { eq: { student_id: sid } }),
    isStudent(ctx) ? loadDaily(api) : {},
  ]);
  const nowIso = new Date().toISOString();
  const next = lessons.find((l) => l.status === 'planned' && l.starts_at >= nowIso);
  const subBy = Object.fromEntries(subs.map((s) => [s.homework_id, s]));
  const open = hws.filter((x) => !subBy[x.id]);
  const reports = lessons.filter((l) => l.status === 'done' && l.report).reverse().slice(0, 3);
  const first = isStudent(ctx) ? (ctx.me.full_name || '').split(' ')[0] : '';

  mount(view, h`
    ${isStudent(ctx)
    ? pageHero({ eyebrow: `Личный кабинет · ${student.grade ? student.grade + ' класс' : 'ученик'}`, title: first ? 'Привет, ' : 'Привет!', accent: first, after: first ? '!' : '', sub: fmtDay(Date.now()) })
    : pageHero({ eyebrow: 'Кабинет родителя', title: 'Успехи: ', accent: student.name, sub: fmtDay(Date.now()) })}
    ${questCard(daily.quest)}
    ${reviewCard(daily.srs)}
    <section class="hero card">
      <span class="hero-label">Следующее занятие</span>
      ${next ? h`<div class="hero-title">${next.subject}${next.topic ? ` · ${next.topic}` : ''}</div>
        <div class="hero-meta">${I.calendar}<span>${fmtDT(next.starts_at)} · ${next.duration_min} мин</span></div>`
    : h`<div class="hero-title">Пока не запланировано</div>`}
    </section>
    <div class="stats">
      <a class="stat" href="#/homework"><span>ДЗ не сдано</span><b class="${open.length ? 'text-warn' : ''}">${open.length}</b></a>
      <a class="stat" href="#/lessons"><span>Занятий проведено</span><b>${lessons.filter((l) => l.status === 'done').length}</b></a>
    </div>
    ${isStudent(ctx) ? h`<a class="g-goal rz-link" href="#/razminka"><span class="g-goal-ico">⚡</span><div><span class="g-label">Тренировка навыков · 60 секунд</span>
      <b>Счёт, дроби, тригонометрия, формулы физики — на автомат</b></div><span class="btn btn-primary g-goal-btn">Начать →</span></a>` : ''}
    <div class="grid-2">
      <section class="card"><div class="card-head"><h2>Домашние задания</h2><a href="#/homework" class="link">Все</a></div>
        ${open.length ? h`<div class="list">${open.slice(0, 5).map((x) => hwItem(x, null))}</div>` : empty('Всё сдано 🎉', I.check)}</section>
      <section class="card"><div class="card-head"><h2>Последние отчёты</h2><a href="#/lessons" class="link">Все</a></div>
        ${reports.length ? h`<div class="list">${reports.map(lessonItem)}</div>` : empty('Отчётов пока нет', I.book)}</section>
    </div>
    <section class="card contact-card">${authorBar(TUTOR)}</section>`);
  mountTelegramBanner(view, ctx);
}

async function homework(view, _p, ctx) {
  const sid = ctx.studentId;
  if (!sid) return noChild(view, ctx);
  const [hws, subs] = await Promise.all([
    ctx.api.select('homework', { eq: { student_id: sid }, order: 'created_at', asc: false }),
    ctx.api.select('submissions', { eq: { student_id: sid } }),
  ]);
  const subBy = Object.fromEntries(subs.map((s) => [s.homework_id, s]));
  const subjects = [...new Set(hws.map((x) => x.subject))];
  const render = () => {
    const subj = $('#f-subj', view).value, st = $('#f-st', view).value;
    const list = hws.filter((x) => (!subj || x.subject === subj) && (!st || (st === 'open' ? !subBy[x.id] : hwStatus(x, subBy[x.id]).key === st)));
    mount($('#hwl', view), list.length ? h`<div class="list card">${list.map((x) => hwItem(x, subBy[x.id]))}</div>` : empty('Заданий нет', I.book));
  };
  mount(view, h`
    ${pageHero({ eyebrow: 'Домашние задания', title: 'Мои ', accent: 'задания' })}
    <div class="toolbar">
      <select id="f-subj" aria-label="Предмет"><option value="">Все предметы</option>${subjects.map((s) => h`<option>${s}</option>`)}</select>
      <select id="f-st" aria-label="Статус"><option value="">Все статусы</option><option value="open">Не сдано</option>
        <option value="submitted">На проверке</option><option value="reviewed">Проверено</option></select>
    </div>
    <div id="hwl"></div>`);
  render();
  $$('#f-subj, #f-st', view).forEach((s) => s.addEventListener('change', render));
}

async function hwDetail(view, [id], ctx) {
  const { api } = ctx;
  const [hw] = await api.select('homework', { eq: { id } });
  if (!hw) return mount(view, empty('Задание не найдено', I.book));
  const [[sub], mats] = await Promise.all([
    api.select('submissions', { eq: { homework_id: id } }),
    api.select('materials', { eq: { homework_id: id } }),
  ]);
  const st = hwStatus(hw, sub);
  const canSubmit = isStudent(ctx) && !sub?.reviewed_at;
  mount(view, h`
    <a href="#/homework" class="back">${I.back} Домашние задания</a>
    <div class="page-head"><div><h1>${hw.title}</h1><p class="muted">${hw.subject} · срок ${fmtD(hw.due_at)}</p></div>
      <span class="badge ${st.cls}">${st.label}</span></div>
    <section class="card stack"><h2>Задание</h2>
      <p class="pre">${hw.description || 'Без описания'}</p>
      ${mats.length ? h`<div class="files">${mats.map(matLink)}</div>` : ''}</section>
    ${sub?.reviewed_at ? h`<section class="card stack feedback"><div class="card-head"><h2>Проверено</h2>${sub.grade ? h`<span class="grade">${sub.grade}</span>` : ''}</div>
      <p class="pre">${sub.feedback || 'Без комментария'}</p></section>` : ''}
    <section class="card stack"><h2>${canSubmit ? (sub ? 'Ваш ответ (можно изменить до проверки)' : 'Ваш ответ') : 'Ответ ученика'}</h2>
      ${canSubmit ? h`
        <form id="sf" class="stack">
          <textarea name="answer" rows="6" placeholder="Напишите ответ или комментарий к решению" aria-label="Ответ">${sub?.answer || ''}</textarea>
          <label class="field"><span>Фото или файл решения</span><input type="file" name="file" accept="image/*,.pdf,.doc,.docx"></label>
          ${sub?.file_path ? h`<button type="button" class="file-pill" data-open="${sub.file_path}">${I.file}<span>Прикреплённый файл</span></button>` : ''}
          <button class="btn btn-primary">${sub ? 'Обновить ответ' : 'Отправить на проверку'}</button>
        </form>` : sub ? h`
          <p class="pre">${sub.answer || '—'}</p>
          ${sub.file_path ? h`<button class="file-pill" data-open="${sub.file_path}">${I.file}<span>Файл решения</span></button>` : ''}
          <p class="muted small">Сдано ${fmtDT(sub.submitted_at)}</p>` : h`<p class="muted">Ещё не сдано</p>`}
    </section>`);
  bindFiles(view, api);
  $('#sf', view)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, btn = $('button:not([type=button])', f);
    const answer = f.answer.value.trim(), file = f.file.files[0];
    if (!answer && !file && !sub?.file_path) return toast('Напишите ответ или прикрепите файл', 'error');
    if (file && file.size > 20 * 1024 * 1024) return toast('Файл больше 20 МБ', 'error');
    btn.disabled = true; btn.classList.add('loading');
    try {
      let file_path = sub?.file_path || null;
      if (file) { file_path = `${hw.student_id}/submissions/${safeFileName(file)}`; await api.upload(file_path, file); }
      if (sub) await api.update('submissions', sub.id, { answer, file_path });
      else await api.insert('submissions', { homework_id: hw.id, student_id: hw.student_id, answer, file_path });
      toast('Ответ отправлен'); ctx.refresh();
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; btn.classList.remove('loading'); }
  });
}

// Доска ученика: рисует сам ученик вместе с преподавателем; родитель только смотрит
async function boardPage(view, _p, ctx) {
  const sid = ctx.studentId;
  if (!sid) return noChild(view, ctx);
  view.innerHTML = '<div class="bd-wrap"></div>';
  await mountBoard(view.firstElementChild, { api: ctx.api, studentId: sid, canWrite: isStudent(ctx), isTutor: false });
}

async function lessons(view, _p, ctx) {
  const sid = ctx.studentId;
  if (!sid) return noChild(view, ctx);
  const [all, mats] = await Promise.all([
    ctx.api.select('lessons_public', { eq: { student_id: sid }, order: 'starts_at' }),
    ctx.api.select('materials', { eq: { student_id: sid } }),
  ]);
  const of = (l) => mats.filter((m) => m.lesson_id === l.id);
  const up = all.filter((l) => l.status === 'planned');
  const past = all.filter((l) => l.status !== 'planned').reverse();
  mount(view, h`
    ${pageHero({ eyebrow: 'Занятия', title: 'Расписание и ', accent: 'отчёты' })}
    <div class="section-head"><h2>Расписание</h2></div>
    ${up.length ? h`<div class="list card">${up.map((l) => lessonItem(l, of(l)))}</div>` : empty('Нет запланированных занятий', I.calendar)}
    <div class="section-head"><h2>История и отчёты</h2></div>
    ${past.length ? h`<div class="list card">${past.map((l) => lessonItem(l, of(l)))}</div>` : empty('Пока нет проведённых занятий', I.book)}`);
  bindFiles(view, ctx.api);
}

async function materials(view, _p, ctx) {
  const sid = ctx.studentId;
  if (!sid) return noChild(view, ctx);
  const mats = await ctx.api.select('materials', { eq: { student_id: sid }, order: 'created_at', asc: false });
  const subjects = [...new Set(mats.map((m) => m.subject || 'Прочее'))].sort((a, b) => (a === 'Прочее') - (b === 'Прочее') || a.localeCompare(b, 'ru'));
  let subj = '';
  mount(view, h`
    ${pageHero({ eyebrow: 'Материалы', title: 'Файлы и ', accent: 'конспекты', sub: plural(mats.length, 'материал', 'материала', 'материалов') })}
    ${mats.length ? h`<div class="toolbar">
      ${subjects.length > 1 ? h`<div class="seg seg-inline">${['', ...subjects].map((s) => h`<button type="button" data-subj="${s}" class="${s === subj ? 'on' : ''}">${s || 'Все'}</button>`)}</div>` : ''}
      <input type="search" id="q" placeholder="Поиск по названию или теме" aria-label="Поиск"></div>` : ''}
    <div id="mats"></div>`);
  const render = () => {
    const text = $('#q', view)?.value.trim().toLowerCase() || '';
    const list = mats.filter((m) => (!subj || (m.subject || 'Прочее') === subj) && (!text || `${m.title} ${m.topic || ''}`.toLowerCase().includes(text)));
    const box = $('#mats', view);
    if (!list.length) return mount(box, empty(mats.length ? 'Ничего не найдено' : 'Материалов пока нет', I.folder));
    mount(box, h`${subjects.filter((s) => list.some((m) => (m.subject || 'Прочее') === s)).map((s) => {
      const rows = list.filter((m) => (m.subject || 'Прочее') === s);
      const topics = [...new Set(rows.map((m) => m.topic || ''))].sort((a, b) => (a === '') - (b === '') || a.localeCompare(b, 'ru'));
      return h`<section class="card lib-card"><div class="card-head"><h2>${s}</h2><span class="muted small">${plural(rows.length, 'файл', 'файла', 'файлов')}</span></div>
        ${topics.map((t) => h`${topics.length > 1 || t ? h`<div class="lib-group"><span>${t || 'Другое'}</span></div>` : ''}
          <div class="list">${rows.filter((m) => (m.topic || '') === t).map((m) => h`
            <div class="item"><span class="item-icon">${m.file_path ? I.file : I.link}</span>
              <div class="item-main"><div class="item-title">${m.title}</div><div class="item-meta">${fmtD(m.created_at)}${m.homework_id ? ' · к домашнему заданию' : m.lesson_id ? ' · к уроку' : ''}</div></div>
              ${m.file_path ? h`<button class="btn btn-soft btn-sm" data-open="${m.file_path}">Открыть</button>`
    : h`<a class="btn btn-soft btn-sm" href="${m.url}" target="_blank" rel="noopener noreferrer">Открыть</a>`}</div>`)}</div>`)}
      </section>`;
    })}`);
    bindFiles(box, ctx.api);
  };
  render();
  $('#q', view)?.addEventListener('input', render);
  $$('[data-subj]', view).forEach((b) => b.addEventListener('click', () => {
    subj = b.dataset.subj; $$('[data-subj]', view).forEach((x) => x.classList.toggle('on', x === b)); render();
  }));
}

async function progress(view, _p, ctx) {
  const sid = ctx.studentId;
  if (!sid) return noChild(view, ctx);
  const [rows, game, drill] = await Promise.all([
    ctx.api.select('topic_progress', { eq: { student_id: sid }, order: 'topic' }), loadGame(ctx.api, sid), loadDrill(ctx.api, sid)]);
  const subjects = [...new Set(rows.map((r) => r.subject))];
  mount(view, h`
    ${pageHero({ eyebrow: 'Прогресс', title: isStudent(ctx) ? 'Твой путь к ' : 'Путь к ', accent: 'ОГЭ' })}
    ${game ? gameBlock(game, { canClaim: isStudent(ctx), studentId: sid, afterGoal: drillBlock(drill, { canPlay: isStudent(ctx) }) }) : drillBlock(drill, { canPlay: isStudent(ctx) })}
    ${rows.length ? h`<div class="section-head"><h2>Темы от преподавателя</h2></div>` : ''}
    ${rows.length ? h`<div class="stats">${subjects.map((s) => {
      const r = rows.filter((x) => x.subject === s);
      return h`<div class="stat"><span>${s}</span><b>${Math.round(r.reduce((a, x) => a + x.level, 0) / r.length)}%</b></div>`;
    })}</div>
    ${subjects.map((s) => h`<section class="card"><h3>${s}</h3><div class="progress-list">
      ${rows.filter((r) => r.subject === s).map((r) => h`<div class="progress-row">
        <span class="p-topic">${r.topic}</span>
        <span class="bar" role="progressbar" aria-valuenow="${r.level}" aria-valuemin="0" aria-valuemax="100"><i style="width:${r.level}%"></i></span>
        <span class="p-level">${levelLabel(r.level)}</span></div>`)}</div></section>`)}`
    : game || drill ? '' : empty('Преподаватель ещё не отметил темы', I.chart)}`);
  bindGame(view, ctx, () => progress(view, _p, ctx));
}

export const familyRoutes = { board: boardPage, cards: cardsPage, razminka: drillPage, trainer: trainerFamily, mock: mockView, '': home, homework, hw: hwDetail, lessons, materials, progress };
