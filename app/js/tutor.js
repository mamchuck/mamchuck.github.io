// Кабинет преподавателя
import {
  h, mount, $, $$, I, toast, modal, confirmDialog, fmtDT, fmtD, fmtDay, dayKey, toLocalInput,
  plural, empty, hwStatus, LEVELS, levelLabel, SUBJECTS, pageHero,
} from './ui.js?v=202610311602';
import {
  libraryPage, uploadForStudent, attachItems, pickFromLibrary, libraryField, libraryFieldHtml, openFile,
} from './library.js?v=202610311602';
import { backupOverdue, lastBackup, bindBackup } from './backup.js?v=202610311602';
import { trainerTutor, trainerReviewBlock } from './trainer.js?v=202610311602';
import { mountTelegramBanner, linksFor } from './telegram.js?v=202610311602';
import { loadGame, gameBlock, tutorClaims, bindTutorClaims } from './game.js?v=202610311602';
import { loadDrill, drillBlock } from './drill.js?v=202610311602';
import { cardsPage } from './cards.js?v=202610311602';
import { theoryPage } from './theory.js?v=202610311602';
import { mountBoard } from './board.js?v=202610311602';
import { leadsPage } from './leads.js?v=202610311602';

export const tutorNav = [
  { path: '', label: 'Главная', icon: I.home },
  { path: 'leads', label: 'Заявки', icon: I.inbox },
  { path: 'students', label: 'Ученики', icon: I.users },
  { path: 'schedule', label: 'Расписание', icon: I.calendar },
  { path: 'review', label: 'Проверка', icon: I.check },
  { path: 'trainer', label: 'Банк задач', short: 'Задачи', icon: I.target },
  { path: 'library', label: 'Библиотека', icon: I.folder },
  { path: 'theory', label: 'Теория', icon: I.theory, hl: true },
];

const arr = (v) => (v == null ? [] : [].concat(v));
const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
const subjectOptions = (list, cur) =>
  (list?.length ? list : SUBJECTS).map((s) => h`<option ${s === cur ? 'selected' : ''}>${s}</option>`);
const dueInput = (d) => (d ? toLocalInput(d).slice(0, 10) : '');
const dueValue = (v) => (v ? new Date(`${v}T20:00`).toISOString() : null);

const FILES_ACCEPT = '.pdf,image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx';
const filesInput = (name, label) => h`<label class="field"><span>${label}</span><input type="file" name="${name}" multiple accept="${FILES_ACCEPT}"></label>`;

// ============================================================
// Формы
// ============================================================

function studentForm(ctx, s) {
  const m = modal({
    title: s ? 'Редактировать ученика' : 'Новый ученик',
    body: h`
      <label class="field"><span>Имя</span><input name="name" required value="${s?.name || ''}" placeholder="Например: Аня К."></label>
      <p class="hint">Рекомендуем имя и первую букву фамилии — без полных персональных данных.</p>
      <div class="row-2">
        <label class="field"><span>Класс</span><select name="grade">
          ${Array.from({ length: 11 }, (_, i) => h`<option value="${i + 1}" ${(s?.grade ?? 9) === i + 1 ? 'selected' : ''}>${i + 1}</option>`)}
        </select></label>
        <label class="field"><span>Статус</span><select name="status">
          ${[['active', 'Занимается'], ['paused', 'Пауза'], ['finished', 'Закончил']].map(([v, l]) => h`<option value="${v}" ${s?.status === v ? 'selected' : ''}>${l}</option>`)}
        </select></label>
      </div>
      <fieldset class="field"><span>Предметы</span><div class="chips">
        ${SUBJECTS.map((x) => h`<label class="chip-check"><input type="checkbox" name="subjects" value="${x}" ${(s?.subjects || SUBJECTS.slice(0, 1)).includes(x) ? 'checked' : ''}><span>${x}</span></label>`)}
      </div></fieldset>
      <label class="field"><span>Цели обучения</span><textarea name="goals" rows="3" placeholder="Например: ОГЭ на 5">${s?.goals || ''}</textarea></label>`,
    onSubmit: async (d) => {
      const row = { name: d.name, grade: +d.grade, status: d.status, subjects: arr(d.subjects), goals: d.goals || '' };
      if (!row.subjects.length) throw new Error('Выберите хотя бы один предмет');
      const r = s ? await ctx.api.update('students', s.id, row) : await ctx.api.insert('students', row);
      toast(s ? 'Сохранено' : 'Ученик добавлен');
      if (!s) location.hash = `#/student/${r.id}`; else ctx.refresh();
    },
  });
  if (!s) return;
  const del = document.createElement('div');
  del.className = 'danger-zone';
  mount(del, h`<button type="button" class="btn btn-ghost btn-sm btn-danger-ghost">${I.trash} Удалить ученика</button>
    <span class="hint">Если ученик просто закончил занятия — лучше поставьте статус «Закончил», история сохранится.</span>`);
  $('.modal-body', m.el).append(del);
  $('button', del).addEventListener('click', () => {
    m.close();
    modal({
      title: `Удалить «${s.name}»?`, submit: 'Удалить навсегда', danger: true,
      body: h`<p>Будут удалены <b>все</b> данные ученика: занятия, отчёты, ДЗ и ответы, прогресс, заметки.
        Ученик и родитель потеряют доступ к кабинету. Отменить это нельзя.</p>
        <p class="hint">Совет: перед удалением скачайте резервную копию в Настройках.</p>
        <label class="field"><span>Для подтверждения введите имя: ${s.name}</span><input name="confirm" autocomplete="off" required></label>`,
      onSubmit: async (d) => {
        if (d.confirm !== s.name.trim()) throw new Error('Имя введено неверно');
        await ctx.api.remove('students', s.id);
        toast('Ученик удалён');
        location.hash = '#/students';
      },
    });
  });
}

function lessonForm(ctx, { students, studentId, lesson, at }) {
  const fixed = studentId || lesson?.student_id;
  const st = students.find((s) => s.id === fixed);
  const start = lesson?.starts_at || at || (() => { const d = new Date(Date.now() + 864e5); d.setHours(16, 0, 0, 0); return d; })();
  const m = modal({
    title: lesson ? 'Изменить занятие' : 'Новое занятие',
    body: h`
      ${fixed ? '' : h`<label class="field"><span>Ученик</span><select name="student_id" required>
        ${students.filter((s) => s.status === 'active').map((s) => h`<option value="${s.id}">${s.name}</option>`)}</select></label>`}
      <div class="row-2">
        <label class="field"><span>Дата и время</span><input type="datetime-local" name="starts_at" required value="${toLocalInput(start)}"></label>
        <label class="field"><span>Длительность</span><select name="duration_min">
          ${[45, 60, 90, 120].map((m) => h`<option value="${m}" ${(lesson?.duration_min || 60) === m ? 'selected' : ''}>${m} мин</option>`)}</select></label>
      </div>
      ${lesson ? '' : h`
      <div class="repeat-box">
        <label class="switch"><input type="checkbox" name="repeat"><span>Повторять каждую неделю</span></label>
        <div class="repeat-opts" hidden>
          <fieldset class="field"><span>Дни недели</span><div class="chips">
            ${WEEKDAYS.map(([n, l]) => h`<label class="chip-check"><input type="checkbox" name="days" value="${n}"><span>${l}</span></label>`)}
          </div></fieldset>
          <label class="field"><span>Сколько недель</span><select name="weeks">
            ${[4, 8, 12, 16, 24, 36].map((w) => h`<option value="${w}" ${w === 8 ? 'selected' : ''}>${w} недель${w === 36 ? ' (учебный год)' : ''}</option>`)}</select></label>
          <p class="hint repeat-preview"></p>
        </div>
      </div>`}
      ${lesson?.series_id ? h`<p class="hint">🔁 Занятие из повторяющейся серии.</p>` : ''}
      <label class="field"><span>Предмет</span><select name="subject">${subjectOptions(st?.subjects, lesson?.subject)}</select></label>
      <label class="field"><span>Тема</span><input name="topic" value="${lesson?.topic || ''}" placeholder="Например: квадратные уравнения"></label>
      <label class="field"><span>План (видите только вы)</span><textarea name="plan" rows="3">${lesson?.plan || ''}</textarea></label>
      <div class="divider"><span>Материалы урока — увидит ученик</span></div>
      ${filesInput('files', 'Загрузить файлы (презентация, конспект)')}
      ${libraryFieldHtml()}`,
    onSubmit: async (d) => {
      const row = { starts_at: new Date(d.starts_at).toISOString(), duration_min: +d.duration_min, subject: d.subject, topic: d.topic || '', plan: d.plan || '' };
      if (!lesson && d.repeat) {
        const dates = seriesDates(d.starts_at, [].concat(d.days ?? []).map(Number), +d.weeks);
        if (!dates.length) throw new Error('Выберите дни недели');
        const series_id = crypto.randomUUID(), sid = fixed || d.student_id;
        const rows = await ctx.api.insertMany('lessons', dates.map((dt) => ({ ...row, starts_at: dt.toISOString(), student_id: sid, series_id })));
        const first = rows.sort((a, b) => (a.starts_at > b.starts_at ? 1 : -1))[0];
        await uploadForStudent(ctx.api, sid, d.files, { lesson_id: first.id, subject: first.subject, topic: first.topic });
        await attachItems(ctx.api, sid, picked, { lesson_id: first.id });
        toast(`Создано ${plural(rows.length, 'занятие', 'занятия', 'занятий')}`); return ctx.refresh();
      }
      const l = lesson ? await ctx.api.update('lessons', lesson.id, row) : await ctx.api.insert('lessons', { ...row, student_id: fixed || d.student_id });
      await uploadForStudent(ctx.api, l.student_id, d.files, { lesson_id: l.id, subject: l.subject, topic: l.topic });
      await attachItems(ctx.api, l.student_id, picked, { lesson_id: l.id });
      toast(lesson ? 'Сохранено' : 'Занятие запланировано'); ctx.refresh();
    },
  });
  const picked = libraryField(ctx.api, m, { subject: () => $('[name=subject]', m.el).value });

  // Повтор: показать опции, отметить день недели выбранной даты, предпросмотр
  const rep = $('[name=repeat]', m.el);
  if (rep) {
    const opts = $('.repeat-opts', m.el), when = $('[name=starts_at]', m.el);
    const preview = () => {
      const days = $$('[name=days]:checked', m.el).map((c) => +c.value);
      const dates = seriesDates(when.value, days, +$('[name=weeks]', m.el).value);
      $('.repeat-preview', m.el).textContent = dates.length
        ? `Будет создано ${plural(dates.length, 'занятие', 'занятия', 'занятий')}: с ${fmtD(dates[0])} по ${fmtD(dates.at(-1))}, в ${when.value.slice(11, 16)}.`
        : 'Отметьте дни недели.';
    };
    const markDay = () => {
      if ($$('[name=days]:checked', m.el).length) return;
      const dow = (new Date(when.value).getDay() + 6) % 7 + 1;
      const c = $(`[name=days][value="${dow}"]`, m.el); if (c) c.checked = true;
    };
    rep.addEventListener('change', () => { opts.hidden = !rep.checked; markDay(); preview(); });
    m.el.addEventListener('change', (e) => { if (e.target.matches('[name=days],[name=weeks],[name=starts_at]')) preview(); });
  }

  // Серия: удалить все следующие занятия
  if (lesson?.series_id) {
    const box = document.createElement('div');
    box.className = 'danger-zone';
    mount(box, h`<button type="button" class="btn btn-ghost btn-sm btn-danger-ghost">${I.trash} Удалить это и все следующие занятия серии</button>
      <span class="hint">Проведённые занятия останутся. Уведомление об удалении не отправляется — предупредите ученика сами.</span>`);
    $('.modal-body', m.el).append(box);
    $('button', box).addEventListener('click', async () => {
      const all = await ctx.api.select('lessons', { eq: { series_id: lesson.series_id } });
      const left = all.filter((x) => x.status === 'planned' && x.starts_at >= lesson.starts_at);
      m.close();
      confirmDialog(`Удалить ${plural(left.length, 'занятие', 'занятия', 'занятий')} серии (с ${fmtD(lesson.starts_at)})?`, async () => {
        for (const x of left) await ctx.api.remove('lessons', x.id);
        toast('Удалено'); ctx.refresh();
      });
    });
  }
}

// Дни недели: 1 = пн … 7 = вс
const WEEKDAYS = [[1, 'Пн'], [2, 'Вт'], [3, 'Ср'], [4, 'Чт'], [5, 'Пт'], [6, 'Сб'], [7, 'Вс']];
// Даты серии: с даты первого занятия, по выбранным дням, N недель, в то же время
function seriesDates(startValue, days, weeks) {
  const start = new Date(startValue);
  if (isNaN(start) || !days.length) return [];
  const monday = new Date(start); monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const out = [];
  for (let w = 0; w < weeks; w++) {
    for (const dn of [...days].sort()) {
      const d = new Date(monday); d.setDate(monday.getDate() + w * 7 + dn - 1);
      d.setHours(start.getHours(), start.getMinutes(), 0, 0);
      if (d >= start) out.push(d);
    }
  }
  return out;
}

// «Провести урок»: итог, отчёт для семьи, заметка, ДЗ — одним окном
function conductLesson(ctx, lesson) {
  const m = modal({
    title: 'Провести урок', submit: 'Сохранить урок', wide: true,
    body: h`
      <p class="muted">${lesson.subject} · ${fmtDT(lesson.starts_at)}</p>
      <label class="field"><span>Тема</span><input name="topic" required value="${lesson.topic}"></label>
      <label class="field"><span>Что прошли — отчёт для ученика и родителя</span><textarea name="report" rows="3" placeholder="Коротко: что разобрали, как получилось, на что обратить внимание">${lesson.report || ''}</textarea></label>
      <label class="switch"><input type="checkbox" name="publish" checked><span>Опубликовать отчёт для семьи</span></label>
      <label class="field"><span>${I.note} Личная заметка — видите только вы</span><textarea name="note" rows="2" placeholder="Затруднения, причины ошибок, идеи на следующий раз"></textarea></label>
      <div class="divider"><span>Домашнее задание (необязательно)</span></div>
      <label class="field"><span>Название</span><input name="hw_title" placeholder="Например: №1–10 из файла"></label>
      <label class="field"><span>Инструкция</span><textarea name="hw_desc" rows="2"></textarea></label>
      <label class="field"><span>Срок</span><input type="date" name="hw_due" value="${dueInput(Date.now() + 3 * 864e5)}"></label>
      ${filesInput('hw_files', 'Файлы к заданию (можно несколько)')}
      ${libraryFieldHtml('Добавить к заданию из библиотеки')}`,
    onSubmit: async (d) => {
      const { api } = ctx;
      await api.update('lessons', lesson.id, { status: 'done', topic: d.topic, report: d.report || '', report_published: !!d.publish && !!d.report });
      if (d.note) await api.insert('private_notes', { student_id: lesson.student_id, lesson_id: lesson.id, body: d.note });
      if (d.hw_title) {
        const hw = await api.insert('homework', { student_id: lesson.student_id, lesson_id: lesson.id, subject: lesson.subject, title: d.hw_title, description: d.hw_desc || '', due_at: dueValue(d.hw_due) });
        await uploadForStudent(api, lesson.student_id, d.hw_files, { homework_id: hw.id, subject: lesson.subject });
        await attachItems(api, lesson.student_id, picked, { homework_id: hw.id });
      } else if (picked.length || [].concat(d.hw_files ?? []).length) {
        throw new Error('Укажите название ДЗ, чтобы прикрепить файлы');
      }
      toast('Урок проведён'); ctx.refresh();
    },
  });
  const picked = libraryField(ctx.api, m, { subject: lesson.subject });
}

function reportForm(ctx, lesson) {
  modal({
    title: 'Отчёт о занятии',
    body: h`
      <label class="field"><span>Отчёт для ученика и родителя</span><textarea name="report" rows="5">${lesson.report}</textarea></label>
      <label class="switch"><input type="checkbox" name="publish" ${lesson.report_published ? 'checked' : ''}><span>Опубликован</span></label>`,
    onSubmit: async (d) => {
      await ctx.api.update('lessons', lesson.id, { report: d.report || '', report_published: !!d.publish && !!d.report });
      toast('Сохранено'); ctx.refresh();
    },
  });
}

function homeworkForm(ctx, student, hw) {
  const m = modal({
    title: hw ? 'Изменить задание' : 'Новое домашнее задание',
    body: h`
      <label class="field"><span>Предмет</span><select name="subject">${subjectOptions(student.subjects, hw?.subject)}</select></label>
      <label class="field"><span>Название</span><input name="title" required value="${hw?.title || ''}"></label>
      <label class="field"><span>Инструкция</span><textarea name="description" rows="4">${hw?.description || ''}</textarea></label>
      <label class="field"><span>Срок сдачи</span><input type="date" name="due" value="${dueInput(hw?.due_at || Date.now() + 3 * 864e5)}"></label>
      ${filesInput('files', hw ? 'Добавить файлы' : 'Файлы с заданием (можно несколько)')}
      ${libraryFieldHtml()}
      <label class="field"><span>Ссылка</span><input type="url" name="url" placeholder="https://"></label>`,
    onSubmit: async (d) => {
      const row = { subject: d.subject, title: d.title, description: d.description || '', due_at: dueValue(d.due) };
      const x = hw ? await ctx.api.update('homework', hw.id, row) : await ctx.api.insert('homework', { ...row, student_id: student.id });
      await uploadForStudent(ctx.api, student.id, d.files, { homework_id: x.id, subject: x.subject });
      await attachItems(ctx.api, student.id, picked, { homework_id: x.id });
      if (d.url) await ctx.api.insert('materials', { student_id: student.id, homework_id: x.id, subject: x.subject, title: 'Ссылка к заданию', url: d.url });
      toast(hw ? 'Сохранено' : 'Задание выдано'); ctx.refresh();
    },
  });
  const picked = libraryField(ctx.api, m, { subject: () => $('[name=subject]', m.el).value });
}

function reviewForm(ctx, hw, sub, studentName) {
  const m = modal({
    title: 'Проверка работы', submit: 'Отправить оценку', wide: true,
    body: h`
      <p class="muted">${studentName} · ${hw.subject} · сдано ${fmtDT(sub.submitted_at)}</p>
      <h3>${hw.title}</h3>
      <div class="answer">${sub.answer || h`<span class="muted">Без текста</span>`}</div>
      ${sub.file_path ? h`<button type="button" class="btn btn-soft" id="sub-file">${I.file} Открыть файл ученика</button>` : ''}
      <div class="row-2">
        <label class="field"><span>Оценка</span><select name="grade">
          ${['5', '4', '3', '2', 'Зачёт', 'Без оценки'].map((g) => h`<option ${sub.grade === g ? 'selected' : ''}>${g}</option>`)}</select></label>
      </div>
      <label class="field"><span>Комментарий для ученика</span><textarea name="feedback" rows="4" placeholder="Что получилось, где ошибки и как их исправить">${sub.feedback || ''}</textarea></label>`,
    onSubmit: async (d) => {
      await ctx.api.update('submissions', sub.id, { grade: d.grade, feedback: d.feedback || '', reviewed_at: new Date().toISOString() });
      toast('Проверено'); ctx.refresh();
    },
  });
  $('#sub-file', m.el)?.addEventListener('click', () => openFile(ctx.api, sub.file_path));
}

function materialForm(ctx, student) {
  modal({
    title: 'Загрузить материал только этому ученику',
    body: h`
      <p class="hint">Чтобы выдавать файл нескольким ученикам, загрузите его в «Библиотеку».</p>
      <label class="field"><span>Предмет</span><select name="subject">${subjectOptions(student.subjects)}</select></label>
      ${filesInput('files', 'Файлы')}
      <div class="row-2">
        <label class="field"><span>или ссылка</span><input type="url" name="url" placeholder="https://"></label>
        <label class="field"><span>Название ссылки</span><input name="title"></label>
      </div>`,
    onSubmit: async (d) => {
      const list = [].concat(d.files ?? []);
      if (!list.length && !d.url) throw new Error('Прикрепите файл или ссылку');
      await uploadForStudent(ctx.api, student.id, list, { subject: d.subject });
      if (d.url) await ctx.api.insert('materials', { student_id: student.id, subject: d.subject, title: d.title || d.url, url: d.url });
      toast('Материал добавлен'); ctx.refresh();
    },
  });
}

function progressForm(ctx, student, row) {
  modal({
    title: row ? 'Изменить тему' : 'Новая тема',
    body: h`
      <label class="field"><span>Предмет</span><select name="subject">${subjectOptions(student.subjects, row?.subject)}</select></label>
      <label class="field"><span>Тема</span><input name="topic" required value="${row?.topic || ''}"></label>
      <fieldset class="field"><span>Уровень</span><div class="level-pick">
        ${LEVELS.map(([v, l]) => h`<label><input type="radio" name="level" value="${v}" ${(row?.level ?? 0) === v ? 'checked' : ''}><span>${l}</span></label>`)}
      </div></fieldset>`,
    onSubmit: async (d) => {
      const r = { subject: d.subject, topic: d.topic, level: +d.level, checked_at: new Date().toISOString().slice(0, 10) };
      if (row) await ctx.api.update('topic_progress', row.id, r);
      else await ctx.api.insert('topic_progress', { ...r, student_id: student.id });
      toast('Сохранено'); ctx.refresh();
    },
  });
}

async function invite(ctx, student, role) {
  try {
    const code = await ctx.api.rpc('create_invitation', { p_student_id: student.id, p_role: role, p_days: 3 });
    const link = `${location.origin}${location.pathname}#/join/${code}`;
    const who = role === 'student' ? 'ученика' : 'родителя';
    const m = modal({
      title: `Приглашение для ${who}`,
      body: h`
        <p>Отправьте ссылку ${who} лично. Это не пароль, а одноразовый ключ: сработает один раз и действует 3 дня. Когда по ней войдут, вам придёт уведомление в Telegram — если это чужой человек, отзовите доступ во вкладке «Доступ».</p>
        <div class="code-box">${code}</div>
        <div class="copy-row"><input readonly value="${link}" aria-label="Ссылка"><button type="button" class="btn btn-primary" id="copy">Копировать</button></div>
        <p class="hint">Человек откроет ссылку, зарегистрируется, и доступ к кабинету «${student.name}» откроется автоматически.</p>
        <p class="hint">После входа на главной появится предложение подключить Telegram-уведомления.</p>`,
    });
    $('#copy', m.el).addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(`Приглашение в личный кабинет mamchuck (одноразовая ссылка, действует 3 дня):\n${link}`); toast('Скопировано'); }
      catch { $('.copy-row input', m.el).select(); }
    });
    ctx.refresh();
  } catch (e) { toast(e.message, 'error'); }
}

// ============================================================
// Карточки
// ============================================================

const lessonStatus = { planned: ['Запланировано', 'info'], done: ['Проведено', 'ok'], cancelled: ['Отменено', 'muted'] };

// Ответы на напоминания из Telegram: { lesson_id: [ {role, response} ] }
let RESP = {};
async function loadResponses(api) {
  try {
    RESP = {};
    for (const r of await api.select('lesson_responses')) (RESP[r.lesson_id] ||= []).push(r);
  } catch { RESP = {}; }
}
const respBadges = (l) => (l.status === 'planned' && RESP[l.id]?.length ? h`<div class="resp">${RESP[l.id].map((r) => h`
  <span class="badge ${r.response === 'move' ? 'warn' : 'ok'}">${r.role === 'parent' ? 'Родитель' : 'Ученик'}: ${r.response === 'move' ? '🔁 просит перенести' : '✅ будет'}</span>`)}</div>` : '');

function lessonCard(l, studentName) {
  const [label, cls] = lessonStatus[l.status];
  return h`
  <div class="item">
    <div class="item-main">
      <div class="item-title">${l.topic || l.subject}</div>
      <div class="item-meta">${studentName ? h`<b>${studentName}</b> · ` : ''}${l.subject} · ${fmtDT(l.starts_at)} · ${l.duration_min} мин</div>
      ${l.status === 'done' && l.report ? h`<div class="item-text">${l.report}${l.report_published ? '' : h` <span class="badge muted">не опубликован</span>`}</div>` : ''}
      ${respBadges(l)}
    </div>
    <div class="item-side">
      <span class="badge ${cls}">${label}</span>
      <div class="actions">
        ${l.status === 'planned' ? h`<button class="btn btn-primary btn-sm" data-conduct="${l.id}">Провести урок</button>` : ''}
        ${l.status === 'done' ? h`<button class="btn btn-ghost btn-sm" data-report="${l.id}">Отчёт</button>` : ''}
        <button class="btn btn-ghost btn-sm" data-ledit="${l.id}">Изменить</button>
        ${l.status === 'planned' ? h`<button class="btn btn-ghost btn-sm" data-lcancel="${l.id}">Отменить</button>` : ''}
      </div>
    </div>
  </div>`;
}

function bindLessons(view, ctx, lessons, students) {
  const L = byId(lessons);
  $$('[data-conduct]', view).forEach((b) => b.addEventListener('click', () => conductLesson(ctx, L[b.dataset.conduct])));
  $$('[data-report]', view).forEach((b) => b.addEventListener('click', () => reportForm(ctx, L[b.dataset.report])));
  $$('[data-ledit]', view).forEach((b) => b.addEventListener('click', () => lessonForm(ctx, { students, lesson: L[b.dataset.ledit] })));
  $$('[data-lcancel]', view).forEach((b) => b.addEventListener('click', () =>
    confirmDialog('Отменить это занятие?', async () => { await ctx.api.update('lessons', b.dataset.lcancel, { status: 'cancelled' }); toast('Занятие отменено'); ctx.refresh(); }, 'Отменить занятие')));
}

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };

// ============================================================
// Страницы
// ============================================================

async function dashboard(view, _p, ctx) {
  const { api } = ctx;
  await loadResponses(api);
  const [students, lessons, subs] = await Promise.all([
    api.select('students', { order: 'name' }),
    api.select('lessons', { eq: { status: 'planned' }, order: 'starts_at' }),
    api.select('submissions', { isNull: ['reviewed_at'], order: 'submitted_at' }),   // только ждущие проверки, а не все за всё время
  ]);
  const hws = subs.length ? await api.select('homework', { cols: 'id,title,subject', eq: { id: subs.map((x) => x.homework_id) } }) : [];
  const S = byId(students), H = byId(hws);
  const today = startOfToday();
  const upcoming = lessons.filter((l) => l.starts_at >= today).slice(0, 6);
  const toReview = subs.filter((s) => !s.reviewed_at);
  const todayCount = lessons.filter((l) => dayKey(l.starts_at) === dayKey(Date.now())).length;
  const moveReq = lessons.filter((l) => l.starts_at >= today && RESP[l.id]?.some((r) => r.response === 'move'));

  mount(view, h`
    ${pageHero({ eyebrow: 'Кабинет преподавателя', title: 'Здравствуйте, ', accent: (ctx.me.full_name || '').split(' ')[0] || 'преподаватель',
      sub: fmtDay(Date.now()), actions: h`<button class="btn btn-primary" id="add-lesson">${I.plus}<span>Занятие</span></button>` })}
    <div class="stats">
      <a class="stat" href="#/schedule"><span>Сегодня</span><b>${plural(todayCount, 'занятие', 'занятия', 'занятий')}</b></a>
      <a class="stat" href="#/review"><span>На проверке</span><b>${plural(toReview.length, 'работа', 'работы', 'работ')}</b></a>
      <a class="stat" href="#/students"><span>Учеников</span><b>${students.filter((s) => s.status === 'active').length}</b></a>
    </div>
    <div class="grid-2">
      <section class="card"><div class="card-head"><h2>Ближайшие занятия</h2><a href="#/schedule" class="link">Все</a></div>
        ${upcoming.length ? h`<div class="list">${upcoming.map((l) => lessonCard(l, S[l.student_id]?.name))}</div>` : empty('Нет запланированных занятий', I.calendar)}
      </section>
      <div class="stack">
        ${moveReq.length ? h`<section class="card move-card"><div class="card-head"><h2>🔁 Просят перенести</h2></div>
          <div class="list">${moveReq.map((l) => lessonCard(l, S[l.student_id]?.name))}</div>
          <p class="hint">Измените время занятия — ученику и родителю придёт сообщение о переносе.</p></section>` : ''}
        <section class="card"><div class="card-head"><h2>Ждут проверки</h2><a href="#/review" class="link">Все</a></div>
          ${toReview.length ? h`<div class="list">${toReview.slice(0, 5).map((s) => h`
            <a class="item item-link" href="#/student/${s.student_id}/homework"><div class="item-main">
              <div class="item-title">${H[s.homework_id]?.title}</div>
              <div class="item-meta"><b>${S[s.student_id]?.name}</b> · сдано ${fmtDT(s.submitted_at)}</div></div>
              <span class="badge info">Проверить</span></a>`)}</div>` : empty('Все работы проверены', I.check)}
        </section>
        ${backupOverdue() ? h`<section class="card stack backup-remind"><div class="card-head"><h2>Резервная копия</h2>
          <span class="badge warn">${lastBackup() ? `последняя ${fmtD(lastBackup())}` : 'ещё не делали'}</span></div>
          <p class="muted small">Скачайте копию всех данных на компьютер — на бесплатном тарифе база сама копии не делает.</p>
          <button class="btn btn-soft" data-backup>${I.folder} Скачать всё</button><p class="hint backup-step"></p></section>` : ''}
      </div>
    </div>`);
  $('#add-lesson').addEventListener('click', () => lessonForm(ctx, { students }));
  bindBackup(view, ctx.api, () => ctx.refresh());
  bindLessons(view, ctx, [...upcoming, ...moveReq], students);
  mountTelegramBanner(view, ctx);
}

async function studentsPage(view, _p, ctx) {
  const students = await ctx.api.select('students', { order: 'name' });
  const render = (q = '', st = 'active') => {
    const list = students.filter((s) => (st === 'all' || s.status === st) && s.name.toLowerCase().includes(q.toLowerCase()));
    mount($('#slist', view), list.length ? h`${list.map((s) => h`<a class="student-card card" href="#/student/${s.id}">
        <span class="avatar avatar-lg">${s.name[0]}</span>
        <div class="item-main"><div class="item-title">${s.name}</div>
          <div class="item-meta">${s.grade ? `${s.grade} класс · ` : ''}${s.subjects.join(', ')}</div></div>
      </a>`)}` : empty(students.length ? 'Никого не найдено' : 'Добавьте первого ученика', I.users));
  };
  mount(view, h`
    ${pageHero({ eyebrow: 'Ученики', title: 'Мои ', accent: 'ученики', actions: h`<button class="btn btn-primary" id="add">${I.plus}<span>Ученик</span></button>` })}
    <div class="toolbar">
      <input type="search" id="q" placeholder="Поиск по имени" aria-label="Поиск">
      <select id="st" aria-label="Статус"><option value="active">Занимаются</option><option value="paused">На паузе</option><option value="finished">Закончили</option><option value="all">Все</option></select>
    </div>
    <div id="slist" class="cards"></div>`);
  render();
  $('#q', view).addEventListener('input', () => render($('#q', view).value, $('#st', view).value));
  $('#st', view).addEventListener('change', () => render($('#q', view).value, $('#st', view).value));
  $('#add', view).addEventListener('click', () => studentForm(ctx));
}

const TABS = [
  ['', 'Обзор'], ['lessons', 'Занятия'], ['board', 'Доска'], ['homework', 'ДЗ'], ['materials', 'Материалы'],
  ['progress', 'Прогресс'], ['notes', 'Заметки'], ['access', 'Доступ'],
];

async function studentPage(view, [id, tab = ''], ctx) {
  const { api } = ctx;
  if (tab === 'payments') { location.hash = `#/student/${id}`; return; }   // старые ссылки из бота: раздел оплат убран
  const [s] = await api.select('students', { eq: { id } });
  if (!s) { mount(view, empty('Ученик не найден', I.users)); return; }
  const shell = (content) => h`
    <a href="#/students" class="back">${I.back} Ученики</a>
    <div class="page-head"><div class="who"><span class="avatar avatar-lg">${s.name[0]}</span><div>
      <h1>${s.name}</h1><p class="muted">${s.grade ? `${s.grade} класс · ` : ''}${s.subjects.join(', ')}${s.status !== 'active' ? ' · ' + ({ paused: 'на паузе', finished: 'закончил' }[s.status]) : ''}</p></div></div>
      <button class="btn btn-ghost" id="edit">Редактировать</button></div>
    <nav class="tabs" aria-label="Разделы ученика">${TABS.map(([t, l]) => h`<a href="#/student/${id}${t ? '/' + t : ''}" class="${t === tab ? 'on' : ''}">${l}</a>`)}</nav>
    ${content}`;
  const done = (content) => { mount(view, shell(content)); $('#edit', view).addEventListener('click', () => studentForm(ctx, s)); };

  if (tab === '') {
    const [lessons, hws, subs, prog] = await Promise.all([
      api.select('lessons', { eq: { student_id: id }, order: 'starts_at' }),
      api.select('homework', { eq: { student_id: id } }),
      api.select('submissions', { eq: { student_id: id } }),
      api.select('topic_progress', { eq: { student_id: id } }),
    ]);
    const doneCount = lessons.filter((l) => l.status === 'done').length;
    const next = lessons.find((l) => l.status === 'planned' && l.starts_at >= startOfToday());
    const subBy = Object.fromEntries(subs.map((x) => [x.homework_id, x]));
    const open = hws.filter((x) => !subBy[x.id]).length;
    const avg = prog.length ? Math.round(prog.reduce((a, p) => a + p.level, 0) / prog.length) : 0;
    done(h`
      <div class="stats">
        <a class="stat" href="#/student/${id}/lessons"><span>Проведено занятий</span><b>${doneCount}</b></a>
        <a class="stat" href="#/student/${id}/homework"><span>ДЗ не сдано</span><b>${open}</b></a>
        <a class="stat" href="#/student/${id}/progress"><span>Средний прогресс</span><b>${avg}%</b></a>
      </div>
      <div class="grid-2">
        <section class="card"><div class="card-head"><h2>Следующее занятие</h2></div>
          ${next ? h`<div class="list">${lessonCard(next)}</div>` : h`${empty('Не запланировано', I.calendar)}<button class="btn btn-soft btn-block" id="plan">${I.plus} Запланировать</button>`}</section>
        <section class="card"><div class="card-head"><h2>Цели</h2></div><p class="pre">${s.goals || '—'}</p></section>
      </div>`);
    bindLessons(view, ctx, next ? [next] : [], [s]);
    $('#plan', view)?.addEventListener('click', () => lessonForm(ctx, { students: [s], studentId: id }));
  }

  if (tab === 'lessons' || tab === '') await loadResponses(api);
  if (tab === 'lessons') {
    const lessons = await api.select('lessons', { eq: { student_id: id }, order: 'starts_at', asc: false });
    const t = startOfToday();
    const up = lessons.filter((l) => l.status === 'planned').reverse();
    const past = lessons.filter((l) => l.status !== 'planned');
    done(h`
      <div class="section-head"><h2>Запланировано</h2><button class="btn btn-primary btn-sm" id="add">${I.plus} Занятие</button></div>
      ${up.length ? h`<div class="list card">${up.map((l) => lessonCard(l))}</div>` : empty('Нет запланированных занятий', I.calendar)}
      ${up.some((l) => l.starts_at < t) ? h`<p class="hint">Есть прошедшие занятия без отметки — нажмите «Провести урок».</p>` : ''}
      <div class="section-head"><h2>История</h2></div>
      ${past.length ? h`<div class="list card">${past.map((l) => lessonCard(l))}</div>` : empty('Пока нет проведённых занятий', I.book)}`);
    $('#add', view).addEventListener('click', () => lessonForm(ctx, { students: [s], studentId: id }));
    bindLessons(view, ctx, lessons, [s]);
  }

  if (tab === 'homework') {
    const [hws, subs, mats] = await Promise.all([
      api.select('homework', { eq: { student_id: id }, order: 'created_at', asc: false }),
      api.select('submissions', { eq: { student_id: id } }),
      api.select('materials', { eq: { student_id: id } }),
    ]);
    const subBy = Object.fromEntries(subs.map((x) => [x.homework_id, x]));
    done(h`
      <div class="section-head"><h2>Домашние задания</h2><button class="btn btn-primary btn-sm" id="add">${I.plus} Задание</button></div>
      ${hws.length ? h`<div class="list card">${hws.map((x) => {
        const sub = subBy[x.id], st = hwStatus(x, sub), files = mats.filter((m) => m.homework_id === x.id);
        return h`<div class="item"><div class="item-main">
            <div class="item-title">${x.title}</div>
            <div class="item-meta">${x.subject} · срок ${fmtD(x.due_at)}${files.length ? ` · ${plural(files.length, 'файл', 'файла', 'файлов')}` : ''}${sub?.grade ? ` · оценка ${sub.grade}` : ''}</div>
            ${x.description ? h`<div class="item-text">${x.description}</div>` : ''}</div>
          <div class="item-side"><span class="badge ${st.cls}">${st.label}</span><div class="actions">
            ${sub ? h`<button class="btn btn-${sub.reviewed_at ? 'ghost' : 'primary'} btn-sm" data-review="${x.id}">${sub.reviewed_at ? 'Ответ' : 'Проверить'}</button>` : ''}
            <button class="btn btn-ghost btn-sm" data-hedit="${x.id}">Изменить</button>
            <button class="icon-btn" data-hdel="${x.id}" aria-label="Удалить">${I.trash}</button></div></div></div>`;
      })}</div>` : empty('Заданий пока нет', I.book)}`);
    const H = byId(hws);
    $('#add', view).addEventListener('click', () => homeworkForm(ctx, s));
    $$('[data-review]', view).forEach((b) => b.addEventListener('click', () => reviewForm(ctx, H[b.dataset.review], subBy[b.dataset.review], s.name)));
    $$('[data-hedit]', view).forEach((b) => b.addEventListener('click', () => homeworkForm(ctx, s, H[b.dataset.hedit])));
    $$('[data-hdel]', view).forEach((b) => b.addEventListener('click', () =>
      confirmDialog('Удалить задание вместе с ответом ученика?', async () => { await api.remove('homework', b.dataset.hdel); toast('Удалено'); ctx.refresh(); })));
  }

  if (tab === 'materials') {
    const [mats, hws] = await Promise.all([
      api.select('materials', { eq: { student_id: id }, order: 'created_at', asc: false }),
      api.select('homework', { eq: { student_id: id } }),
    ]);
    const H = byId(hws);
    done(h`
      <div class="section-head"><h2>Материалы</h2><div class="actions">
        <button class="btn btn-primary btn-sm" id="from-lib">${I.folder} Из библиотеки</button>
        <button class="btn btn-ghost btn-sm" id="add">${I.plus} Загрузить</button></div></div>
      ${mats.length ? h`<div class="list card">${mats.map((m) => h`
        <div class="item"><span class="item-icon">${m.file_path ? I.file : I.link}</span>
          <div class="item-main"><div class="item-title">${m.title}</div>
            <div class="item-meta">${m.subject ? `${m.subject}${m.topic ? ' · ' + m.topic : ''} · ` : ''}${fmtD(m.created_at)}${m.homework_id && H[m.homework_id] ? ` · к заданию «${H[m.homework_id].title}»` : ''}${m.lesson_id ? ' · к уроку' : ''}${m.library_item_id ? ' · из библиотеки' : ''}</div></div>
          <div class="actions">
            ${m.file_path ? h`<button class="btn btn-ghost btn-sm" data-open="${m.file_path}">Открыть</button>` : h`<a class="btn btn-ghost btn-sm" href="${m.url}" target="_blank" rel="noopener noreferrer">Открыть</a>`}
            <button class="icon-btn" data-mdel="${m.id}" aria-label="Удалить">${I.trash}</button></div></div>`)}</div>` : empty('Материалов пока нет', I.folder)}`);
    const M = byId(mats);
    $('#add', view).addEventListener('click', () => materialForm(ctx, s));
    $('#from-lib', view).addEventListener('click', async () => {
      const items = await pickFromLibrary(api, { subject: s.subjects[0] });
      if (!items.length) return;
      const fresh = items.filter((i) => !mats.some((m) => m.library_item_id === i.id && !m.homework_id && !m.lesson_id));
      try { await attachItems(api, id, fresh); toast(`Выдано: ${plural(fresh.length, 'материал', 'материала', 'материалов')}`); ctx.refresh(); }
      catch (e) { toast(e.message, 'error'); }
    });
    $$('[data-open]', view).forEach((b) => b.addEventListener('click', () => openFile(api, b.dataset.open)));
    $$('[data-mdel]', view).forEach((b) => b.addEventListener('click', () => confirmDialog(M[b.dataset.mdel].library_item_id ? 'Убрать материал у ученика? В библиотеке он останется.' : 'Удалить материал?', async () => {
      const m = M[b.dataset.mdel];
      await api.remove('materials', m.id);
      if (m.file_path && !m.library_item_id) await api.removeFile(m.file_path).catch(() => {});
      toast('Удалено'); ctx.refresh();
    })));
  }

  if (tab === 'progress') {
    const [rows, game, drill] = await Promise.all([api.select('topic_progress', { eq: { student_id: id }, order: 'topic' }), loadGame(api, id), loadDrill(api, id)]);
    const subjects = [...new Set([...s.subjects, ...rows.map((r) => r.subject)])];
    const claims = await tutorClaims(api, id, game);
    done(h`
      ${claims}
      ${game ? gameBlock(game, { afterGoal: drillBlock(drill) }) : drillBlock(drill)}
      <div class="section-head"><h2>Прогресс по темам</h2><button class="btn btn-primary btn-sm" id="add">${I.plus} Тема</button></div>
      ${rows.length ? subjects.filter((sub) => rows.some((r) => r.subject === sub)).map((sub) => h`
        <section class="card"><h3>${sub}</h3><div class="progress-list">
          ${rows.filter((r) => r.subject === sub).map((r) => h`
            <button class="progress-row" data-pedit="${r.id}">
              <span class="p-topic">${r.topic}</span>
              <span class="bar" role="progressbar" aria-valuenow="${r.level}" aria-valuemin="0" aria-valuemax="100"><i style="width:${r.level}%"></i></span>
              <span class="p-level">${levelLabel(r.level)}</span></button>`)}
        </div></section>`) : empty('Добавьте темы, чтобы отслеживать прогресс', I.chart)}`);
    const R = byId(rows);
    $('#add', view).addEventListener('click', () => progressForm(ctx, s));
    bindTutorClaims(view, ctx);
    $$('[data-pedit]', view).forEach((b) => b.addEventListener('click', () => progressForm(ctx, s, R[b.dataset.pedit])));
  }

  if (tab === 'board') {
    done(h`<div class="bd-wrap" id="bd-root"></div>`);
    await mountBoard($('#bd-root', view), { api, studentId: id, canWrite: true, isTutor: true });
    return;
  }

  if (tab === 'notes') {
    const notes = await api.select('private_notes', { eq: { student_id: id }, order: 'created_at', asc: false });
    done(h`
      <p class="notice">${I.note} Заметки видите только вы. Ученик и родитель к ним доступа не имеют.</p>
      <form class="card stack" id="nf"><textarea name="body" rows="3" required placeholder="Новая заметка" aria-label="Новая заметка"></textarea>
        <button class="btn btn-primary">Добавить</button></form>
      ${notes.length ? h`<div class="list card">${notes.map((n) => h`
        <div class="item"><div class="item-main"><div class="item-meta">${fmtDT(n.created_at)}</div><div class="item-text pre">${n.body}</div></div>
          <button class="icon-btn" data-ndel="${n.id}" aria-label="Удалить">${I.trash}</button></div>`)}</div>` : ''}`);
    $('#nf', view).addEventListener('submit', async (e) => {
      e.preventDefault();
      try { await api.insert('private_notes', { student_id: id, body: e.target.body.value.trim() }); toast('Заметка добавлена'); ctx.refresh(); }
      catch (err) { toast(err.message, 'error'); }
    });
    $$('[data-ndel]', view).forEach((b) => b.addEventListener('click', () =>
      confirmDialog('Удалить заметку?', async () => { await api.remove('private_notes', b.dataset.ndel); ctx.refresh(); })));
  }

  if (tab === 'access') {
    const [mems, invs] = await Promise.all([
      api.select('student_memberships', { eq: { student_id: id } }),
      api.select('invitations', { eq: { student_id: id }, order: 'created_at', asc: false }),
    ]);
    const profs = mems.length ? byId(await api.select('profiles', { eq: { id: mems.map((m) => m.user_id) } })) : {};
    const tg = await linksFor(api, mems.map((m) => m.user_id));
    const invState = (i) => (i.used_at ? ['Использовано', 'ok'] : new Date(i.expires_at) < new Date() ? ['Истекло', 'muted'] : ['Ожидает', 'info']);
    done(h`
      <div class="grid-2">
        <section class="card stack"><h2>Пригласить</h2>
          <p class="muted">Создайте ссылку и отправьте её ученику или родителю, например в мессенджере.</p>
          <button class="btn btn-primary" data-inv="student">${I.key} Ссылка для ученика</button>
          <button class="btn btn-soft" data-inv="parent">${I.key} Ссылка для родителя</button></section>
        <section class="card"><h2>У кого есть доступ</h2>
          ${mems.length ? h`<div class="list">${mems.map((m) => h`<div class="item"><div class="item-main">
            <div class="item-title">${profs[m.user_id]?.full_name || 'Без имени'}</div>
            <div class="item-meta">${m.role === 'student' ? 'Ученик' : 'Родитель'}</div></div>
            <span class="badge ${tg[m.user_id] ? 'ok' : 'muted'}">${tg[m.user_id] ? 'Telegram ✓' : 'без Telegram'}</span></div>`)}</div>
            <p class="hint">Telegram подключают сами: Настройки → «Подключить Telegram».</p>` : empty('Пока никто не подключён', I.users)}</section>
      </div>
      ${invs.length ? h`<div class="section-head"><h2>Приглашения</h2></div><div class="list card">${invs.map((i) => {
        const [l, c] = invState(i);
        return h`<div class="item"><div class="item-main"><div class="item-title">${i.role === 'student' ? 'Ученик' : 'Родитель'}</div>
          <div class="item-meta">создано ${fmtDT(i.created_at)} · до ${fmtD(i.expires_at)}</div></div>
          <span class="badge ${c}">${l}</span>
          ${!i.used_at ? h`<button class="icon-btn" data-idel="${i.id}" aria-label="Отозвать">${I.trash}</button>` : ''}</div>`;
      })}</div>` : ''}`);
    $$('[data-inv]', view).forEach((b) => b.addEventListener('click', () => invite(ctx, s, b.dataset.inv)));
    $$('[data-idel]', view).forEach((b) => b.addEventListener('click', () =>
      confirmDialog('Отозвать приглашение? Ссылка перестанет работать.', async () => { await api.remove('invitations', b.dataset.idel); ctx.refresh(); }, 'Отозвать')));
  }
}

const scheduleTabs = (mode) => h`<div class="seg seg-inline">
  <a href="#/schedule" class="${mode === 'week' ? 'on' : ''}">Неделя</a>
  <a href="#/schedule/upcoming" class="${mode === 'upcoming' ? 'on' : ''}">Список</a>
  <a href="#/schedule/past" class="${mode === 'past' ? 'on' : ''}">Прошедшие</a></div>`;

// ---------- Неделя: дни колонками, часы строками (как в Google Календаре) ----------
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const HOUR_PX = 56;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const subjCls = (s) => ({ 'Математика': 'math', 'Физика': 'phys', 'Профильная математика': 'ege' }[s] || 'other');
function mondayOf(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function parseDay(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
function weekTitle(mon) {
  const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  const f = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
  return `${mon.getMonth() === sun.getMonth() ? mon.getDate() : f.format(mon)} – ${f.format(sun)} ${sun.getFullYear()}`;
}
// Пересекающиеся занятия в одном дне — рядом, в несколько дорожек
function lanes(items) {
  const out = []; let group = [], end = 0;
  const flush = () => { const n = Math.max(...group.map((g) => g.lane)) + 1; group.forEach((g) => { g.lanes = n; out.push(g); }); group = []; };
  for (const it of items.sort((a, b) => a.s - b.s)) {
    if (group.length && it.s >= end) flush();
    const used = new Set(group.filter((g) => g.e > it.s).map((g) => g.lane));
    let lane = 0; while (used.has(lane)) lane++;
    group.push({ ...it, lane }); end = Math.max(end, it.e);
  }
  if (group.length) flush();
  return out;
}

async function scheduleWeek(view, ctx, dayParam) {
  const { api } = ctx;
  await loadResponses(api);
  const mon = mondayOf(parseDay(dayParam) || new Date());
  const next = new Date(mon); next.setDate(next.getDate() + 7);
  const prev = new Date(mon); prev.setDate(prev.getDate() - 7);
  const [students, all] = await Promise.all([api.select('students', { order: 'name' }),
    api.select('lessons', { gte: { starts_at: mon.toISOString() }, lt: { starts_at: next.toISOString() }, order: 'starts_at' })]);   // только неделя
  const S = byId(students);
  const week = all.filter((l) => l.starts_at >= mon.toISOString() && l.starts_at < next.toISOString());
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(d.getDate() + i); return d; });
  // диапазон часов: 9–21, расширяется под занятия
  let h0 = 9, h1 = 21;
  for (const l of week) {
    const s = new Date(l.starts_at), e = new Date(+s + l.duration_min * 60e3);
    h0 = Math.min(h0, s.getHours()); h1 = Math.max(h1, e.getHours() + (e.getMinutes() ? 1 : 0));
  }
  const hours = Array.from({ length: h1 - h0 }, (_, i) => h0 + i);
  const todayKey = ymd(new Date()), now = new Date();
  const active = week.filter((l) => l.status !== 'cancelled');
  const totalMin = active.reduce((x, l) => x + l.duration_min, 0);
  const col = (d) => {
    const k = ymd(d);
    const items = lanes(week.filter((l) => ymd(new Date(l.starts_at)) === k).map((l) => {
      const s = new Date(l.starts_at); const sm = s.getHours() * 60 + s.getMinutes();
      return { l, s: sm, e: sm + l.duration_min };
    }));
    const nowTop = k === todayKey && now.getHours() >= h0 && now.getHours() < h1 ? ((now.getHours() - h0) * 60 + now.getMinutes()) / 60 * HOUR_PX : null;
    return h`<div class="wk-col ${k === todayKey ? 'today' : ''} ${d < mondayOf(now) || (k < todayKey) ? 'past' : ''}" data-day="${k}" style="height:${hours.length * HOUR_PX}px">
      ${items.map(({ l, s, lane, lanes: n }) => {
        const st = new Date(l.starts_at), en = new Date(+st + l.duration_min * 60e3);
        const move = RESP[l.id]?.some((r) => r.response === 'move');
        return h`<button type="button" class="wk-ev s-${subjCls(l.subject)} st-${l.status} ${l.duration_min < 50 ? 'short' : ''}" data-ev="${l.id}"
          style="top:${(s - h0 * 60) / 60 * HOUR_PX + 1}px;height:${l.duration_min / 60 * HOUR_PX - 3}px;left:calc(${(100 / n) * lane}% + 2px);width:calc(${100 / n}% - 4px)"
          title="${hhmm(st)}–${hhmm(en)} · ${S[l.student_id]?.name || ''} · ${l.subject}${l.topic ? ` · ${l.topic}` : ''}">
          <span class="wk-time">${hhmm(st)}–${hhmm(en)}${l.status === 'done' ? ' ✓' : ''}${move ? ' 🔁' : ''}</span>
          <b class="wk-name">${S[l.student_id]?.name || 'Ученик'}</b>
          <span class="wk-subj">${l.subject}${l.topic ? ` · ${l.topic}` : ''}</span>
        </button>`;
      })}
      ${nowTop != null ? h`<div class="wk-now" style="top:${nowTop}px"></div>` : ''}
    </div>`;
  };
  mount(view, h`
    ${pageHero({ eyebrow: 'Расписание', title: 'Календарь ', accent: 'занятий', actions: h`<button class="btn btn-primary" id="add">${I.plus}<span>Занятие</span></button>` })}
    ${scheduleTabs('week')}
    <div class="wk-toolbar">
      <a class="icon-btn" href="#/schedule/week/${ymd(prev)}" aria-label="Предыдущая неделя">‹</a>
      <a class="btn btn-ghost btn-sm" href="#/schedule/week/${ymd(new Date())}">Сегодня</a>
      <a class="icon-btn" href="#/schedule/week/${ymd(next)}" aria-label="Следующая неделя">›</a>
      <h2 class="wk-title">${weekTitle(mon)}</h2>
      <span class="muted small">${plural(active.length, 'занятие', 'занятия', 'занятий')}${totalMin ? ` · ${+(totalMin / 60).toFixed(1)} ч` : ''}</span>
    </div>
    <div class="card wk-card"><div class="wk-scroll"><div class="wk">
      <div class="wk-corner"></div>
      ${days.map((d, i) => h`<div class="wk-head ${ymd(d) === todayKey ? 'today' : ''}"><span>${WD[i]}</span><b>${d.getDate()}</b></div>`)}
      <div class="wk-times" style="height:${hours.length * HOUR_PX}px">${hours.map((x) => h`<span style="height:${HOUR_PX}px">${x}:00</span>`)}</div>
      ${days.map(col)}
    </div></div></div>
    <p class="hint">Нажмите на пустое место, чтобы запланировать занятие на это время; на занятие — чтобы провести, изменить или отменить.</p>`);
  $('#add', view).addEventListener('click', () => lessonForm(ctx, { students }));
  const L = byId(week);
  $$('[data-ev]', view).forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const l = L[b.dataset.ev];
    const m = modal({ title: `${S[l.student_id]?.name || 'Занятие'} · ${l.subject}`, body: h`<div class="list">${lessonCard(l, S[l.student_id]?.name)}</div>` });
    $$('[data-conduct],[data-report],[data-ledit],[data-lcancel]', m.el).forEach((x) => x.addEventListener('click', () => m.close(), { capture: true }));
    bindLessons(m.el, ctx, [l], students);
  }));
  $$('.wk-col', view).forEach((c) => c.addEventListener('click', (e) => {
    if (e.target.closest('[data-ev]')) return;
    const y = e.clientY - c.getBoundingClientRect().top;
    const min = Math.max(0, Math.round((y / HOUR_PX) * 2) / 2) * 60;   // шаг 30 минут
    const at = parseDay(c.dataset.day); at.setHours(h0, 0, 0, 0); at.setMinutes(min);
    lessonForm(ctx, { students, at });
  }));
  // на узком экране — показать колонку «сегодня»
  const sc = $('.wk-scroll', view), td = $('.wk-col.today', view);
  if (sc && td && td.offsetLeft + td.offsetWidth > sc.clientWidth) sc.scrollLeft = td.offsetLeft - 56;   // только если «сегодня» не видно
}

async function schedulePage(view, [mode = 'week', day], ctx) {
  if (mode === 'week') return scheduleWeek(view, ctx, day);
  return scheduleList(view, mode, ctx);
}

async function scheduleList(view, mode, ctx) {
  await loadResponses(ctx.api);
  const [students, lessons] = await Promise.all([
    ctx.api.select('students', { order: 'name' }),
    mode === 'upcoming'
      ? ctx.api.select('lessons', { eq: { status: 'planned' }, order: 'starts_at' })
      : ctx.api.select('lessons', { eq: { status: ['done', 'cancelled'] }, lt: { starts_at: new Date().toISOString() }, order: 'starts_at', asc: false, limit: 60 }),
  ]);
  const S = byId(students), t = startOfToday();
  const list = mode === 'upcoming'
    ? lessons.filter((l) => l.status === 'planned')
    : lessons.filter((l) => l.status !== 'planned' && l.starts_at < new Date().toISOString()).slice(0, 60);
  const groups = [];
  for (const l of list) {
    const k = dayKey(l.starts_at);
    if (groups.at(-1)?.k !== k) groups.push({ k, d: l.starts_at, items: [] });
    groups.at(-1).items.push(l);
  }
  mount(view, h`
    ${pageHero({ eyebrow: 'Расписание', title: 'Календарь ', accent: 'занятий', actions: h`<button class="btn btn-primary" id="add">${I.plus}<span>Занятие</span></button>` })}
    ${scheduleTabs(mode)}
    ${groups.length ? groups.map((g) => h`
      <div class="day-head ${g.d < t ? 'past' : ''}">${fmtDay(g.d)}${dayKey(g.d) === dayKey(Date.now()) ? h` <span class="badge info">сегодня</span>` : ''}</div>
      <div class="list card">${g.items.map((l) => lessonCard(l, S[l.student_id]?.name))}</div>`)
    : empty(mode === 'upcoming' ? 'Нет запланированных занятий' : 'История пуста', I.calendar)}`);
  $('#add', view).addEventListener('click', () => lessonForm(ctx, { students }));
  bindLessons(view, ctx, list, students);
}

async function reviewPage(view, _p, ctx) {
  const [pending, recent, students] = await Promise.all([
    ctx.api.select('submissions', { isNull: ['reviewed_at'], order: 'submitted_at' }),
    ctx.api.select('submissions', { notNull: ['reviewed_at'], order: 'reviewed_at', asc: false, limit: 10 }),
    ctx.api.select('students', { cols: 'id,name' }),
  ]);
  const subs = [...pending, ...recent];
  const hws = subs.length ? await ctx.api.select('homework', { eq: { id: [...new Set(subs.map((x) => x.homework_id))] } }) : [];
  const H = byId(hws), S = byId(students);
  const row = (s) => h`<div class="item"><div class="item-main">
      <div class="item-title">${H[s.homework_id]?.title}</div>
      <div class="item-meta"><b>${S[s.student_id]?.name}</b> · ${H[s.homework_id]?.subject} · сдано ${fmtDT(s.submitted_at)}${s.grade ? ` · оценка ${s.grade}` : ''}</div></div>
    <button class="btn btn-${s.reviewed_at ? 'ghost' : 'primary'} btn-sm" data-rev="${s.id}">${s.reviewed_at ? 'Открыть' : 'Проверить'}</button></div>`;
  mount(view, h`
    ${pageHero({ eyebrow: 'Проверка', title: 'Домашние ', accent: 'работы' })}
    <div class="section-head"><h2>Ждут проверки · ${pending.length}</h2></div>
    ${pending.length ? h`<div class="list card">${pending.map(row)}</div>` : empty('Все работы проверены', I.check)}
    <div id="oge-review"></div>
    ${recent.length ? h`<div class="section-head"><h2>Недавно проверенные</h2></div><div class="list card">${recent.map(row)}</div>` : ''}`);
  trainerReviewBlock(ctx).then((b) => { const el = $('#oge-review', view); if (b && el) { mount(el, b.html); b.bind(el); } });
  const SB = byId(subs);
  $$('[data-rev]', view).forEach((b) => b.addEventListener('click', () => {
    const s = SB[b.dataset.rev]; reviewForm(ctx, H[s.homework_id], s, S[s.student_id]?.name);
  }));
}

export const tutorRoutes = { theory: theoryPage, cards: cardsPage, leads: leadsPage, trainer: trainerTutor, library: libraryPage, '': dashboard, students: studentsPage, student: studentPage, schedule: schedulePage, review: reviewPage };
