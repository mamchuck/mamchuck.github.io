// Тренажёр ОГЭ: банк задач (преподаватель), решение по номерам и варианты (ученик), статистика.
// Ответы и решения ученику приходят только из trainer_check — после его попытки.
import {
  h, mount, $, $$, I, toast, modal, confirmDialog, fmtD, fmtDT, plural, empty, SUBJECTS, safeFileName, pageHero,
} from './ui.js?v=202610192250';

const MAX_NUM = { 'Математика': 25, 'Физика': 22 };
const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const isStudent = (ctx) => ctx.me.role === 'student';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

async function tableReady(api) {
  try { await api.select('oge_sets', { limit: 1 }); return true; } catch { return false; }
}
const notReady = (view) => mount(view, h`${pageHero({ eyebrow: 'Тренажёр ОГЭ', title: 'Скоро ', accent: 'здесь' })}
  ${empty('Тренажёр включится после обновления базы (supabase/005_trainer.sql).', I.target)}`);

async function img(api, path, cls = 'task-img') {
  if (!path) return h``;
  try {
    const src = /^(https?:|img\/)/.test(path) ? path : await api.fileUrl(path);
    return h`<img class="${cls}" src="${src}" alt="Иллюстрация к задаче" loading="lazy">`;
  }
  catch { return h``; }
}
async function uploadImage(api, file) {
  const path = `trainer/${safeFileName(file)}`;
  await api.upload(path, file);
  return path;
}

// Статистика по номерам из попыток: { num: {tasks:Set, ok:Set, tried:Set} }
function statsByNum(attempts, tasksById) {
  const s = {};
  for (const a of attempts) {
    const t = tasksById[a.task_id]; if (!t) continue;
    const x = (s[`${t.subject}|${t.num}`] ||= { tried: new Set(), ok: new Set() });
    x.tried.add(a.task_id);
    if (a.is_correct || (a.points != null && a.points >= a.max_points)) x.ok.add(a.task_id);
  }
  return s;
}
const levelCls = (p, tried) => (!tried ? '' : p >= 80 ? 'lv-ok' : p >= 50 ? 'lv-mid' : 'lv-bad');

const subjectSeg = (cur, list = SUBJECTS) => h`<div class="seg seg-inline">${list.map((s) => h`<button type="button" data-subj="${s}" class="${s === cur ? 'on' : ''}">${s}</button>`)}</div>`;

// ============================================================
// Преподаватель
// ============================================================

function taskForm(ctx, task, preset = {}) {
  const t = task || { subject: preset.subject || SUBJECTS[0], num: preset.num || 6, answer_type: 'short', max_points: 1, topic: '', body: '', answer: '', solution: '', source: '' };
  const m = modal({
    title: task ? 'Изменить задачу' : 'Новая задача', wide: true,
    body: h`
      <div class="row-3">
        <label class="field"><span>Предмет</span><select name="subject">${SUBJECTS.map((s) => h`<option ${s === t.subject ? 'selected' : ''}>${s}</option>`)}</select></label>
        <label class="field"><span>Номер ОГЭ</span><input name="num" type="number" min="1" max="40" required value="${t.num}"></label>
        <label class="field"><span>Баллы</span><input name="max_points" type="number" min="1" max="10" required value="${t.max_points}"></label>
      </div>
      <div class="row-2">
        <label class="field"><span>Тема</span><input name="topic" value="${t.topic}" placeholder="Например: квадратные уравнения"></label>
        <label class="field"><span>Тип ответа</span><select name="answer_type">
          <option value="short" ${t.answer_type === 'short' ? 'selected' : ''}>Краткий (проверяется сам)</option>
          <option value="full" ${t.answer_type === 'full' ? 'selected' : ''}>Развёрнутый (проверяете вы)</option></select></label>
      </div>
      <label class="field"><span>Условие</span><textarea name="body" rows="5" placeholder="Текст условия. Формулы и рисунки удобнее добавить скриншотом ниже.">${t.body}</textarea></label>
      <label class="field"><span>Скриншот условия ${t.image_path ? '(загружен — новый заменит)' : ''}</span><input type="file" name="image" accept="image/*"></label>
      ${t.image_path ? h`<label class="switch"><input type="checkbox" name="drop_image"><span>Убрать скриншот условия</span></label>` : ''}
      <label class="field"><span>Правильный ответ</span><input name="answer" value="${t.answer}" placeholder="Например: 2,5   (несколько вариантов — через |, например 2,5|5/2)"></label>
      <p class="hint">Для краткого ответа проверка не чувствительна к пробелам и регистру, 2,5 = 2.5. Для развёрнутого — ответ увидит ученик после проверки.</p>
      <label class="field"><span>Решение (ученик увидит после попытки)</span><textarea name="solution" rows="4">${t.solution}</textarea></label>
      <label class="field"><span>Скриншот решения</span><input type="file" name="solution_image" accept="image/*"></label>
      <label class="field"><span>Источник</span><input name="source" value="${t.source}" placeholder="Например: ФИПИ, задание 4E2A1B"></label>`,
    onSubmit: async (d) => {
      const row = {
        subject: d.subject, num: +d.num, max_points: +d.max_points, topic: d.topic || '', answer_type: d.answer_type,
        body: d.body || '', answer: d.answer || '', solution: d.solution || '', source: d.source || '',
      };
      if (!row.body && !d.image && !t.image_path) throw new Error('Добавьте условие текстом или скриншотом');
      if (row.answer_type === 'short' && !row.answer) throw new Error('Укажите правильный ответ');
      if (d.image) row.image_path = await uploadImage(ctx.api, d.image);
      else if (d.drop_image) row.image_path = null;
      if (d.solution_image) row.solution_image_path = await uploadImage(ctx.api, d.solution_image);
      if (task) await ctx.api.update('oge_tasks', task.id, row); else await ctx.api.insert('oge_tasks', row);
      store.set('trainer-last', JSON.stringify({ subject: row.subject, num: row.num }));
      toast(task ? 'Сохранено' : 'Задача добавлена'); ctx.refresh();
    },
  });
  return m;
}

async function previewTask(ctx, t) {
  const m = modal({
    title: `${t.subject}, №${t.num}`, wide: true,
    body: h`<p class="muted">${t.topic}${t.source ? ` · ${t.source}` : ''} · ${plural(t.max_points, 'балл', 'балла', 'баллов')}</p>
      ${t.body ? h`<div class="task-body">${t.body}</div>` : ''}<div class="ti"></div>
      <div class="tf-reveal" data-answer hidden><b>Ответ:</b> ${(t.answer || '—').split('|')[0]}</div>
      <div class="tf-reveal" data-solution hidden>${t.solution ? h`<div class="pre">${t.solution}</div>` : 'Решение не добавлено'}<div class="si"></div></div>
      <div class="tf-actions"><button type="button" class="btn btn-soft btn-sm" data-toggle="answer">Показать ответ</button>
        <button type="button" class="btn btn-soft btn-sm" data-toggle="solution">Показать решение</button></div>`,
  });
  bindRevealButtons(m.el);
  mount($('.ti', m.el), await img(ctx.api, t.image_path));
  mount($('.si', m.el), await img(ctx.api, t.solution_image_path));
}

// CSV (Excel → «Сохранить как CSV»): предмет;номер;тема;тип;баллы;условие;ответ;решение;источник
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const sep = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}
const TEMPLATE = '﻿предмет;номер;тема;тип;баллы;условие;ответ;решение;источник\r\n'
  + 'Математика;9;Линейные уравнения;краткий;1;"Найдите корень уравнения 3x − 7 = 11.";6;"3x = 18, x = 6";\r\n'
  + 'Физика;20;Тепловые явления;развёрнутый;3;"Какое количество теплоты нужно, чтобы нагреть 2 кг воды на 10 °C?";84 кДж;"Q = cmΔt = 4200·2·10 = 84 000 Дж";ФИПИ\r\n';

function importForm(ctx) {
  const m = modal({
    title: 'Импорт задач из Excel', submit: 'Загрузить задачи',
    body: h`
      <p class="muted">В Excel заполните столбцы: <b>предмет; номер; тема; тип</b> (краткий/развёрнутый); <b>баллы; условие; ответ; решение; источник</b>. Затем «Файл → Сохранить как → CSV (разделители — точка с запятой)».</p>
      <button type="button" class="btn btn-soft btn-sm" id="tpl">${I.file} Скачать шаблон</button>
      <label class="dropzone"><input type="file" name="csv" accept=".csv,text/csv" required>${I.upload}<b>Выберите CSV-файл</b><span class="hint import-info"></span></label>
      <p class="hint">Скриншоты к задачам можно добавить потом — кнопкой «Изменить» у задачи.</p>`,
    onSubmit: async (d) => {
      if (!d.csv) throw new Error('Выберите файл');
      const rows = parseCSV(await d.csv.text());
      const head = rows.shift().map((x) => x.trim().toLowerCase());
      const col = (name) => head.indexOf(name);
      const need = ['предмет', 'номер', 'условие', 'ответ'];
      for (const n of need) if (col(n) < 0) throw new Error(`Нет столбца «${n}» в первой строке`);
      const items = rows.map((r) => {
        const v = (n) => (col(n) >= 0 ? (r[col(n)] || '').trim() : '');
        const subj = SUBJECTS.find((s) => s.toLowerCase().startsWith(v('предмет').toLowerCase().slice(0, 3))) || v('предмет');
        return {
          subject: subj, num: parseInt(v('номер'), 10), topic: v('тема'),
          answer_type: /разв|full|2/i.test(v('тип')) ? 'full' : 'short',
          max_points: parseInt(v('баллы'), 10) || 1, body: v('условие'), answer: v('ответ'),
          solution: v('решение'), source: v('источник'),
        };
      }).filter((x) => x.num > 0 && (x.body || x.answer));
      if (!items.length) throw new Error('Не нашёл задач в файле');
      for (let i = 0; i < items.length; i += 200) await ctx.api.insertMany('oge_tasks', items.slice(i, i + 200));
      toast(`Загружено ${plural(items.length, 'задача', 'задачи', 'задач')}`); ctx.refresh();
    },
  });
  $('#tpl', m.el).addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8' }));
    a.download = 'шаблон-задач-ОГЭ.csv'; a.click();
  });
  $('[name=csv]', m.el).addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const n = parseCSV(await f.text()).length - 1;
    $('.import-info', m.el).textContent = `${f.name}: ${plural(Math.max(n, 0), 'строка', 'строки', 'строк')} с задачами`;
  });
}

async function setForm(ctx, preset = {}) {
  const { api } = ctx;
  const [students, tasks, templates, sets] = await Promise.all([
    api.select('students', { eq: { status: 'active' }, order: 'name' }),
    api.select('oge_tasks', { order: 'num' }),
    api.select('oge_templates', { order: 'created_at', asc: false }).catch(() => []),
    api.select('oge_sets', { order: 'created_at', asc: false }),
  ]);
  if (!tasks.length) { toast('Сначала добавьте задачи в банк', 'error'); return; }
  if (!students.length) { toast('Нет активных учеников', 'error'); return; }
  const S = byId(students);
  const T = byId(tasks);
  let subject = preset.subject || T[preset.taskIds?.[0]]?.subject || SUBJECTS[0];
  let tried = {};          // task_id → 'ok' | 'bad' для выбранного ученика
  const m = modal({
    title: preset.title ? 'Выдать вариант' : 'Новый вариант', wide: true, submit: 'Выдать вариант',
    body: h`
      <div class="row-2">
        <label class="field"><span>Ученик</span><select name="student_id" required>${students.map((s) => h`<option value="${s.id}" ${s.id === preset.studentId ? 'selected' : ''}>${s.name}</option>`)}</select></label>
        <label class="field"><span>Предмет</span><select name="subject">${SUBJECTS.map((s) => h`<option ${s === subject ? 'selected' : ''}>${s}</option>`)}</select></label>
      </div>
      <div class="row-2">
        <label class="field"><span>Название</span><input name="title" required value="${preset.title || `Вариант от ${fmtD(Date.now())}`}"></label>
        <label class="field"><span>Срок</span><input type="date" name="due"></label>
      </div>
      ${templates.length || sets.length ? h`<label class="field"><span>Взять задачи из шаблона или прошлого варианта</span><select name="from">
        <option value="">— не брать —</option>
        ${templates.length ? h`<optgroup label="Шаблоны">${templates.map((t) => h`<option value="tpl:${t.id}">${t.title} · ${t.subject} · ${t.task_ids.length} задач</option>`)}</optgroup>` : ''}
        ${sets.length ? h`<optgroup label="Прошлые варианты">${sets.slice(0, 40).map((x) => h`<option value="set:${x.id}">${x.title} · ${S[x.student_id]?.name || 'ученик'} · ${fmtD(x.created_at)}</option>`)}</optgroup>` : ''}
      </select></label>` : ''}
      <div class="autopick">
        <span class="field-label">Автоподбор: по одной задаче на номера</span>
        <input type="number" name="from_n" min="1" max="40" value="6" aria-label="С номера"> —
        <input type="number" name="to_n" min="1" max="40" value="19" aria-label="По номер">
        <button type="button" class="btn btn-soft btn-sm" id="pick">Подобрать</button>
      </div>
      <p class="hint">Подбираются задачи, которые ученик ещё не решал. Отметки: ✓ — решал верно, ✗ — ошибался.</p>
      <div class="set-filter"><input type="search" placeholder="Фильтр: номер или тема" aria-label="Фильтр задач"></div>
      <div class="set-tasks lib-pick"></div>
      <p class="hint set-count"></p>
      <label class="switch"><input type="checkbox" name="save_tpl"><span>Сохранить набор как шаблон (чтобы потом выдавать другим)</span></label>`,
    onSubmit: async (d) => {
      const ids = [...checked];
      if (!ids.length) throw new Error('Отметьте задачи');
      const ordered = ids.map((id) => T[id]).filter(Boolean).sort((a, b) => a.num - b.num).map((t) => t.id);
      await api.insert('oge_sets', { student_id: d.student_id, subject: d.subject, title: d.title, task_ids: ordered, due_at: d.due ? new Date(`${d.due}T20:00`).toISOString() : null });
      if (d.save_tpl) await api.insert('oge_templates', { subject: d.subject, title: d.title, task_ids: ordered }).catch(() => {});
      toast(`Вариант выдан: ${S[d.student_id]?.name || ''}`); ctx.refresh();
    },
  });
  const checked = new Set(preset.taskIds || []);
  const box = $('.set-tasks', m.el);
  const filterEl = $('.set-filter input', m.el);
  const render = () => {
    subject = $('[name=subject]', m.el).value;
    const q = filterEl.value.trim().toLowerCase();
    const list = tasks.filter((t) => t.subject === subject
      && (!q || String(t.num) === q || `№${t.num} ${t.topic} ${t.body}`.toLowerCase().includes(q)));
    mount(box, list.length ? h`${list.map((t) => h`<label class="lib-row">
        <input type="checkbox" value="${t.id}" ${checked.has(t.id) ? 'checked' : ''}>
        <span class="num-pill">№${t.num}</span>
        <span class="item-main"><span class="item-title">${t.topic || 'Без темы'} ${tried[t.id] ? h`<span class="badge ${tried[t.id] === 'ok' ? 'ok' : 'bad'}">${tried[t.id] === 'ok' ? '✓ решал' : '✗ ошибался'}</span>` : ''}</span>
          <span class="item-meta">${(t.body || 'задача со скриншотом').slice(0, 90)}${t.image_path ? ' 🖼' : ''}</span></span></label>`)}`
      : empty('Нет задач по фильтру', I.target));
    count();
  };
  const count = () => { $('.set-count', m.el).textContent = `Выбрано: ${plural(checked.size, 'задача', 'задачи', 'задач')}`; };
  const loadTried = async () => {
    const atts = await api.select('oge_attempts', { eq: { student_id: $('[name=student_id]', m.el).value } });
    tried = {};
    for (const a of atts) {
      const ok = a.is_correct || (a.points != null && a.points >= a.max_points);
      tried[a.task_id] = tried[a.task_id] === 'ok' || ok ? 'ok' : 'bad';
    }
    render();
  };
  box.addEventListener('change', (e) => { if (e.target.checked) checked.add(e.target.value); else checked.delete(e.target.value); count(); });
  filterEl.addEventListener('input', render);
  $('[name=subject]', m.el).addEventListener('change', render);
  $('[name=student_id]', m.el).addEventListener('change', loadTried);
  $('[name=from]', m.el)?.addEventListener('change', (e) => {
    const [kind, id] = e.target.value.split(':');
    const src = kind === 'tpl' ? templates.find((t) => t.id === id) : sets.find((x) => x.id === id);
    if (!src) return;
    checked.clear(); src.task_ids.forEach((tid) => T[tid] && checked.add(tid));
    $('[name=subject]', m.el).value = src.subject;
    if (!preset.title) $('[name=title]', m.el).value = src.title;
    render();
  });
  $('#pick', m.el).addEventListener('click', () => {
    const from = +$('[name=from_n]', m.el).value, to = +$('[name=to_n]', m.el).value;
    let added = 0;
    for (let n = Math.min(from, to); n <= Math.max(from, to); n++) {
      const pool = tasks.filter((t) => t.subject === subject && t.num === n);
      if (pool.some((t) => checked.has(t.id))) continue;
      const fresh = pool.filter((t) => !tried[t.id]);
      const src = fresh.length ? fresh : pool;
      if (src.length) { checked.add(src[Math.floor(Math.random() * src.length)].id); added++; }
    }
    render();
    toast(added ? `Добавлено ${plural(added, 'задача', 'задачи', 'задач')}` : 'Новых номеров для подбора нет', added ? 'ok' : 'error');
  });
  loadTried();
}

// Карточка задачи в ленте: полное условие, рисунок; ответ и решение — по кнопкам
const taskCard = (t, { used = 0, selected = false } = {}) => h`
  <article class="task-feed-card card ${selected ? 'selected' : ''}" data-tid="${t.id}">
    <header class="tf-head">
      <input type="checkbox" class="lib-check" data-bsel="${t.id}" ${selected ? 'checked' : ''} aria-label="Выбрать для варианта">
      <span class="num-pill">№${t.num}</span>
      <span class="tf-topic">${t.topic || 'Без темы'}</span>
      <span class="tf-meta">${t.answer_type === 'full' ? 'развёрнутый · ' : ''}${plural(t.max_points, 'балл', 'балла', 'баллов')}${used ? ` · в вариантах: ${used}` : ''}</span>
    </header>
    ${t.body ? h`<div class="task-body">${t.body}</div>` : ''}
    ${t.image_path ? h`<div class="tf-img" data-img="${t.image_path}"><div class="tf-img-ph"></div></div>` : ''}
    <div class="tf-reveal" data-answer hidden><b>Ответ:</b> ${t.answer ? t.answer.split('|')[0] : '—'}${t.answer && t.answer.includes('|') ? h` <span class="muted small">(принимается также: ${t.answer.split('|').slice(1).join(', ')})</span>` : ''}</div>
    <div class="tf-reveal" data-solution hidden>${t.solution ? h`<div class="pre">${t.solution}</div>` : h`<span class="muted">Решение не добавлено</span>`}
      ${t.solution_image_path ? h`<div class="tf-img" data-img="${t.solution_image_path}"><div class="tf-img-ph"></div></div>` : ''}</div>
    <footer class="tf-actions">
      <button type="button" class="btn btn-soft btn-sm" data-toggle="answer">Показать ответ</button>
      <button type="button" class="btn btn-soft btn-sm" data-toggle="solution">Показать решение</button>
      <span class="tf-spacer"></span>
      ${t.source ? h`<span class="muted small">${t.source}</span>` : ''}
      <button type="button" class="btn btn-ghost btn-sm" data-tedit="${t.id}">Изменить</button>
      <button type="button" class="icon-btn" data-tdel="${t.id}" aria-label="Удалить">${I.trash}</button>
    </footer>
  </article>`;

// Картинки грузим, только когда карточка доезжает до экрана
function lazyImages(root, api) {
  const load = async (el) => {
    if (el.dataset.loaded) return; el.dataset.loaded = '1';
    mount(el, await img(api, el.dataset.img));
  };
  if (!('IntersectionObserver' in window)) { $$('[data-img]', root).forEach(load); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); load(e.target); } }), { rootMargin: '400px' });
  $$('[data-img]', root).forEach((el) => io.observe(el));
}

function bindRevealButtons(root) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-toggle]'); if (!b) return;
    const card = b.closest('[data-tid], .task-card, .modal-body'); const what = b.dataset.toggle;
    const box = $(`[data-${what}]`, card); if (!box) return;
    box.hidden = !box.hidden;
    b.textContent = `${box.hidden ? 'Показать' : 'Скрыть'} ${what === 'answer' ? 'ответ' : 'решение'}`;
    b.classList.toggle('on', !box.hidden);
  });
}

async function tutorBank(view, ctx) {
  const { api } = ctx;
  const [tasks, sets] = await Promise.all([api.select('oge_tasks', { order: 'num' }), api.select('oge_sets')]);
  const used = {}; for (const x of sets) for (const tid of x.task_ids) used[tid] = (used[tid] || 0) + 1;
  const T = byId(tasks);
  const sel = new Set();
  let subj = store.get('trainer-subj') || SUBJECTS[0];
  let num = store.get('trainer-num') || '';
  let shown = 0, list = [];
  const PAGE = 25;

  const more = () => {
    const feed = $('#feed', view); if (!feed) return;
    const part = list.slice(shown, shown + PAGE); shown += part.length;
    feed.insertAdjacentHTML('beforeend', part.map((t) => taskCard(t, { used: used[t.id], selected: sel.has(t.id) }).s).join(''));
    lazyImages(feed, api);
    $('#feed-more', view).hidden = shown >= list.length;
    $('#feed-count', view).textContent = `Показано ${shown} из ${list.length}`;
  };

  const draw = () => {
    const q = ($('#tq', view)?.value || '').toLowerCase();
    list = tasks.filter((t) => t.subject === subj && (!num || t.num === +num)
      && (!q || `${t.topic} ${t.body} ${t.source}`.toLowerCase().includes(q)));
    const counts = {};
    for (const t of tasks.filter((x) => x.subject === subj)) counts[t.num] = (counts[t.num] || 0) + 1;
    mount($('#bank', view), h`
      <div class="num-grid num-grid-sm">
        <button type="button" class="num-tile ${!num ? 'on' : ''}" data-num=""><b>Все</b><small>${tasks.filter((t) => t.subject === subj).length}</small></button>
        ${Array.from({ length: MAX_NUM[subj] || 25 }, (_, i) => i + 1).map((n) => h`
        <button type="button" class="num-tile ${+num === n ? 'on' : ''} ${counts[n] ? '' : 'empty'}" data-num="${n}"><b>${n}</b><small>${counts[n] || 0}</small></button>`)}</div>
      ${list.length ? h`
        <div class="feed-head"><h2>${num ? `${subj}: задание № ${num}` : `${subj}: все задания`}</h2>
          <span class="muted small" id="feed-count"></span>
          <button type="button" class="btn btn-ghost btn-sm" id="reveal-all">Показать все ответы</button></div>
        <div id="feed" class="feed"></div>
        <button type="button" class="btn btn-soft btn-block" id="feed-more">Показать ещё</button>
        <div id="feed-sentinel"></div>`
      : empty(tasks.length ? 'Нет задач с таким фильтром' : 'Банк пуст — добавьте задачи или загрузите из Excel', I.target)}`);
    shown = 0;
    if (list.length) {
      more();
      $('#feed-more', view).addEventListener('click', more);
      // автодогрузка при прокрутке вниз
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((es) => { if (es[0].isIntersecting && shown < list.length) more(); }, { rootMargin: '600px' });
        io.observe($('#feed-sentinel', view));
      }
      $('#reveal-all', view).addEventListener('click', (e) => {
        const on = e.target.dataset.on !== '1'; e.target.dataset.on = on ? '1' : '';
        e.target.textContent = on ? 'Скрыть все ответы' : 'Показать все ответы';
        $$('#feed [data-answer]', view).forEach((x) => { x.hidden = !on; });
        $$('#feed [data-toggle="answer"]', view).forEach((b) => { b.textContent = on ? 'Скрыть ответ' : 'Показать ответ'; b.classList.toggle('on', on); });
      });
    }
    $$('[data-num]', view).forEach((b) => b.addEventListener('click', () => {
      num = b.dataset.num; store.set('trainer-num', num); draw();
      $('.feed-head', view)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  };

  mount($('#tab-body', view), h`
    <div class="toolbar">${subjectSeg(subj)}<input type="search" id="tq" placeholder="Поиск по теме и условию" aria-label="Поиск">
      <button class="btn btn-ghost" id="imp">${I.upload} Импорт из Excel</button>
      <button class="btn btn-primary" id="addt">${I.plus} Задача</button></div>
    <p class="hint">Всего в банке: ${plural(tasks.length, 'задача', 'задачи', 'задач')}. Выберите номер — откроется лента задач с полными условиями. Ответ и решение — по кнопкам. Отмечайте галочками, чтобы составить вариант.</p>
    <div id="bank"></div>
    <div class="select-bar" id="bbar" hidden><span id="bbar-n"></span>
      <button class="btn btn-primary btn-sm" id="bmake">${I.target} Составить вариант</button>
      <button class="btn btn-ghost btn-sm" id="bclear">Снять выбор</button></div>`);
  const bar = () => { $('#bbar', view).hidden = !sel.size; $('#bbar-n', view).textContent = `Выбрано: ${sel.size}`; };
  // делегирование: работает и для догруженных карточек
  const bank = $('#bank', view);
  bindRevealButtons(bank);
  bank.addEventListener('change', (e) => {
    const c = e.target.closest('[data-bsel]'); if (!c) return;
    c.checked ? sel.add(c.dataset.bsel) : sel.delete(c.dataset.bsel);
    c.closest('[data-tid]').classList.toggle('selected', c.checked); bar();
  });
  bank.addEventListener('click', (e) => {
    const ed = e.target.closest('[data-tedit]'); if (ed) return taskForm(ctx, T[ed.dataset.tedit]);
    const del = e.target.closest('[data-tdel]');
    if (del) confirmDialog('Удалить задачу? Попытки учеников по ней тоже удалятся.', async () => { await api.remove('oge_tasks', del.dataset.tdel); toast('Удалено'); ctx.refresh(); });
  });
  $('#bmake', view).addEventListener('click', () => setForm(ctx, { subject: subj, taskIds: [...sel] }));
  $('#bclear', view).addEventListener('click', () => { sel.clear(); draw(); bar(); });
  $$('[data-subj]', view).forEach((b) => b.addEventListener('click', () => {
    subj = b.dataset.subj; store.set('trainer-subj', subj); num = ''; store.set('trainer-num', '');
    $$('[data-subj]', view).forEach((x) => x.classList.toggle('on', x === b)); draw();
  }));
  let timer; $('#tq', view).addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(draw, 200); });
  $('#addt', view).addEventListener('click', () => taskForm(ctx, null, { subject: subj, num: +num || undefined }));
  $('#imp', view).addEventListener('click', () => importForm(ctx));
  draw();
}

async function tutorSets(view, ctx, filterSid = '') {
  const { api } = ctx;
  const [sets, students, attempts, templates] = await Promise.all([
    api.select('oge_sets', { order: 'created_at', asc: false }), api.select('students', { order: 'name' }), api.select('oge_attempts'),
    api.select('oge_templates', { order: 'created_at', asc: false }).catch(() => []),
  ]);
  const S = byId(students);
  const list = filterSid ? sets.filter((s) => s.student_id === filterSid) : sets;
  mount($('#tab-body', view), h`
    <div class="section-head"><h2>Шаблоны вариантов</h2><button class="btn btn-primary btn-sm" id="adds">${I.plus} Вариант</button></div>
    ${templates.length ? h`<div class="list card">${templates.map((t) => h`<div class="item">
        <div class="item-main"><div class="item-title">${t.title}</div><div class="item-meta">${t.subject} · ${plural(t.task_ids.length, 'задача', 'задачи', 'задач')} · ${fmtD(t.created_at)}</div></div>
        <div class="actions"><button class="btn btn-soft btn-sm" data-give="${t.id}">Выдать</button>
          <button class="icon-btn" data-tpldel="${t.id}" aria-label="Удалить шаблон">${I.trash}</button></div></div>`)}</div>`
    : h`<p class="hint">Шаблонов пока нет. При выдаче варианта отметьте «Сохранить набор как шаблон» — и его можно будет выдавать любому ученику в один клик.</p>`}
    <div class="section-head"><h2>История выданных вариантов</h2>
      <select id="fs" aria-label="Ученик"><option value="">Все ученики</option>${students.map((s) => h`<option value="${s.id}" ${s.id === filterSid ? 'selected' : ''}>${s.name}</option>`)}</select></div>
    ${list.length ? h`<div class="list card">${list.map((s) => {
      const at = attempts.filter((a) => a.set_id === s.id);
      const done = new Set(at.map((a) => a.task_id)).size, n = s.task_ids.length;
      const pts = at.reduce((x, a) => x + (a.points || 0), 0);
      const pending = at.some((a) => a.points == null);
      return h`<div class="item"><a class="item-main item-link-plain" href="#/trainer/set/${s.id}">
          <div class="item-title">${s.title}</div>
          <div class="item-meta"><b>${S[s.student_id]?.name || ''}</b> · ${s.subject} · ${plural(n, 'задача', 'задачи', 'задач')} · выдан ${fmtD(s.created_at)}${s.due_at ? ` · до ${fmtD(s.due_at)}` : ''}</div></a>
        <div class="actions">
          <span class="badge ${done === n ? 'ok' : done ? 'info' : 'muted'}">${done}/${n}${done ? ` · ${pts} б.` : ''}</span>
          ${pending ? h`<span class="badge warn">на проверке</span>` : ''}
          <button class="btn btn-ghost btn-sm" data-again="${s.id}">Выдать снова</button></div></div>`;
    })}</div>` : empty('Вариантов пока нет', I.target)}`);
  const TP = byId(templates), SE = byId(sets);
  $('#adds', view).addEventListener('click', () => setForm(ctx));
  $('#fs', view).addEventListener('change', (e) => tutorSets(view, ctx, e.target.value));
  $$('[data-give]', view).forEach((b) => b.addEventListener('click', () => {
    const t = TP[b.dataset.give]; setForm(ctx, { subject: t.subject, taskIds: t.task_ids, title: t.title });
  }));
  $$('[data-again]', view).forEach((b) => b.addEventListener('click', () => {
    const x = SE[b.dataset.again]; setForm(ctx, { subject: x.subject, taskIds: x.task_ids, title: x.title });
  }));
  $$('[data-tpldel]', view).forEach((b) => b.addEventListener('click', () =>
    confirmDialog('Удалить шаблон? Выданные по нему варианты останутся.', async () => { await api.remove('oge_templates', b.dataset.tpldel); ctx.refresh(); })));
}

async function tutorResults(view, ctx, sidParam) {
  const { api } = ctx;
  const students = await api.select('students', { eq: { status: 'active' }, order: 'name' });
  const sid = sidParam || store.get('trainer-res') || students[0]?.id;
  if (!sid) { mount($('#tab-body', view), empty('Нет учеников', I.users)); return; }
  const [tasks, attempts] = await Promise.all([api.select('oge_tasks'), api.select('oge_attempts', { eq: { student_id: sid } })]);
  mount($('#tab-body', view), h`
    <div class="toolbar"><select id="rs" aria-label="Ученик">${students.map((s) => h`<option value="${s.id}" ${s.id === sid ? 'selected' : ''}>${s.name}</option>`)}</select></div>
    <div id="res"></div>`);
  $('#rs', view).addEventListener('change', (e) => { store.set('trainer-res', e.target.value); location.hash = `#/trainer/results/${e.target.value}`; });
  mount($('#res', view), statsBlock(tasks, attempts, true));
}

// Сетка номеров со статистикой (для преподавателя и ученика)
function statsBlock(tasks, attempts, forTutor = false, linkFor = null) {
  const T = byId(tasks);
  const st = statsByNum(attempts, T);
  const subjects = SUBJECTS.filter((s) => tasks.some((t) => t.subject === s));
  if (!subjects.length) return empty('В банке пока нет задач', I.target);
  return h`${subjects.map((subj) => {
    const total = {}; for (const t of tasks.filter((x) => x.subject === subj)) total[t.num] = (total[t.num] || 0) + 1;
    const nums = Array.from({ length: MAX_NUM[subj] || 25 }, (_, i) => i + 1).filter((n) => total[n] || st[`${subj}|${n}`]);
    const all = Object.entries(st).filter(([k]) => k.startsWith(subj + '|'));
    const tried = all.reduce((x, [, v]) => x + v.tried.size, 0), ok = all.reduce((x, [, v]) => x + v.ok.size, 0);
    return h`<section class="card trainer-card">
      <div class="card-head"><h2>${subj}</h2><span class="muted small">${tried ? `решено верно ${ok} из ${tried} · ${pct(ok, tried)}%` : 'ещё не решал(а)'}</span></div>
      <div class="num-grid">${nums.map((n) => {
        const x = st[`${subj}|${n}`]; const tr = x?.tried.size || 0; const p = pct(x?.ok.size || 0, tr);
        const inner = h`<b>№${n}</b><small>${tr ? `${p}%` : `${total[n] || 0} задач`}</small>${tr ? h`<i>${x.ok.size}/${tr}</i>` : ''}`;
        return linkFor && total[n]
          ? h`<a class="num-tile ${levelCls(p, tr)}" href="${linkFor(subj, n)}">${inner}</a>`
          : h`<div class="num-tile ${levelCls(p, tr)} ${total[n] ? '' : 'empty'}">${inner}</div>`;
      })}</div>
      ${forTutor ? h`<p class="hint">Зелёный — ≥80% верно, жёлтый — 50–79%, красный — меньше 50%. В плитке: % верных и сколько задач решено.</p>` : ''}
    </section>`;
  })}`;
}

async function tutorSetDetail(view, ctx, id) {
  const { api } = ctx;
  const [[s], tasks, attempts, students] = await Promise.all([
    api.select('oge_sets', { eq: { id } }), api.select('oge_tasks'), api.select('oge_attempts', { eq: { set_id: id } }), api.select('students'),
  ]);
  if (!s) return mount(view, empty('Вариант не найден', I.target));
  const T = byId(tasks), S = byId(students);
  const last = {}; for (const a of attempts.sort((x, y) => (x.created_at > y.created_at ? 1 : -1))) last[a.task_id] = a;
  const pts = s.task_ids.reduce((x, tid) => x + (last[tid]?.points || 0), 0);
  const max = s.task_ids.reduce((x, tid) => x + (T[tid]?.max_points || 1), 0);
  mount(view, h`
    <a href="#/trainer/sets" class="back">${I.back} Варианты</a>
    ${pageHero({ eyebrow: `${S[s.student_id]?.name || ''} · ${s.subject}`, title: s.title, sub: `${s.due_at ? `Срок: ${fmtD(s.due_at)} · ` : ''}Набрано ${pts} из ${max} баллов`,
      actions: h`<button class="btn btn-soft" id="again">${I.users}<span>Выдать другому</span></button>
        <button class="btn btn-ghost" id="tpl">${I.folder}<span>В шаблоны</span></button>
        <button class="btn btn-ghost" id="dels">${I.trash}<span>Удалить</span></button>` })}
    <div class="list card">${s.task_ids.map((tid, i) => {
      const t = T[tid], a = last[tid];
      const st = !a ? ['не решено', 'muted'] : a.points == null ? ['ждёт проверки', 'warn'] : a.is_correct || a.points >= a.max_points ? [`верно · ${a.points} б.`, 'ok'] : a.answer == null ? ['посмотрел ответ', 'bad'] : [`${a.points}/${a.max_points} б.`, 'bad'];
      return h`<div class="item"><span class="num-pill">${i + 1}</span><div class="item-main">
        <div class="item-title">№${t?.num} · ${t?.topic || ''}</div>
        <div class="item-meta">${a ? `ответ ученика: ${a.answer ?? '—'}${t?.answer_type === 'short' ? ` · верный: ${t.answer}` : ''} · ${fmtDT(a.created_at)}` : ''}</div></div>
        <span class="badge ${st[1]}">${st[0]}</span></div>`;
    })}</div>`);
  $('#dels', view).addEventListener('click', () => confirmDialog('Удалить вариант вместе с попытками?', async () => { await api.remove('oge_sets', id); location.hash = '#/trainer/sets'; }));
  $('#again', view).addEventListener('click', () => setForm(ctx, { subject: s.subject, taskIds: s.task_ids, title: s.title }));
  $('#tpl', view).addEventListener('click', async () => {
    try { await api.insert('oge_templates', { subject: s.subject, title: s.title, task_ids: s.task_ids }); toast('Сохранено в шаблоны'); }
    catch (e) { toast(e.message, 'error'); }
  });
}

export async function trainerTutor(view, params, ctx) {
  if (!(await tableReady(ctx.api))) return notReady(view);
  const [tab = 'bank', arg] = params;
  if (tab === 'set') return tutorSetDetail(view, ctx, arg);
  const TABS = [['bank', 'Банк задач'], ['sets', 'Варианты'], ['results', 'Результаты учеников']];
  mount(view, h`
    ${pageHero({ eyebrow: 'Тренажёр ОГЭ', title: 'Банк задач и ', accent: 'варианты', sub: 'Краткие ответы проверяются автоматически, развёрнутые — в разделе «Проверка».' })}
    <nav class="tabs">${TABS.map(([t, l]) => h`<a href="#/trainer${t === 'bank' ? '' : '/' + t}" class="${t === tab ? 'on' : ''}">${l}</a>`)}</nav>
    <div id="tab-body">${h`<div class="loading-block"><span class="spin"></span></div>`}</div>`);
  if (tab === 'sets') return tutorSets(view, ctx);
  if (tab === 'results') return tutorResults(view, ctx, arg);
  return tutorBank(view, ctx);
}

// Развёрнутые решения на проверку — блок для страницы «Проверка»
export async function trainerReviewBlock(ctx) {
  try {
    const [atts, tasks, students] = await Promise.all([
      ctx.api.select('oge_attempts', { order: 'created_at' }), ctx.api.select('oge_tasks'), ctx.api.select('students'),
    ]);
    const pending = atts.filter((a) => a.points == null);
    if (!pending.length) return null;
    const T = byId(tasks), S = byId(students);
    return {
      html: h`<div class="section-head"><h2>Тренажёр: развёрнутые решения · ${pending.length}</h2></div>
        <div class="list card">${pending.map((a) => h`<div class="item"><span class="num-pill">№${T[a.task_id]?.num}</span>
          <div class="item-main"><div class="item-title">${S[a.student_id]?.name} · ${T[a.task_id]?.subject}</div>
            <div class="item-meta">${T[a.task_id]?.topic || ''} · ${fmtDT(a.created_at)}</div></div>
          <button class="btn btn-primary btn-sm" data-oge="${a.id}">Проверить</button></div>`)}</div>`,
      bind(view) {
        const A = byId(pending);
        $$('[data-oge]', view).forEach((b) => b.addEventListener('click', () => reviewAttempt(ctx, A[b.dataset.oge], T[A[b.dataset.oge].task_id], S)));
      },
    };
  } catch { return null; }
}

async function reviewAttempt(ctx, a, t, S) {
  const m = modal({
    title: `Проверка: ${t.subject}, №${t.num}`, wide: true, submit: 'Поставить баллы',
    body: h`<p class="muted">${S[a.student_id]?.name} · ${fmtDT(a.created_at)}</p>
      <div class="task-body">${t.body}</div><div class="ti"></div>
      <h3>Решение ученика</h3>
      ${a.answer && a.answer !== '(фото)' ? h`<div class="answer">${a.answer}</div>` : ''}
      <div class="si"></div>
      ${t.solution || t.answer ? h`<details><summary>Эталон</summary><div class="answer">${t.answer ? h`Ответ: <b>${t.answer}</b><br>` : ''}${t.solution}</div></details>` : ''}
      <div class="row-2">
        <label class="field"><span>Баллы (из ${t.max_points})</span><select name="points">${Array.from({ length: t.max_points + 1 }, (_, i) => h`<option value="${i}">${i}</option>`)}</select></label>
      </div>
      <label class="field"><span>Комментарий</span><textarea name="feedback" rows="3"></textarea></label>`,
    onSubmit: async (d) => {
      await ctx.api.update('oge_attempts', a.id, { points: +d.points, is_correct: +d.points >= t.max_points, feedback: d.feedback || '', reviewed_at: new Date().toISOString() });
      toast('Проверено'); ctx.refresh();
    },
  });
  mount($('.ti', m.el), await img(ctx.api, t.image_path));
  mount($('.si', m.el), await img(ctx.api, a.file_path, 'task-img sub-img'));
}

// ============================================================
// Ученик и родитель
// ============================================================

async function familyHome(view, ctx) {
  const { api } = ctx;
  const sid = ctx.studentId;
  const student = ctx.students.find((s) => s.id === sid);
  const [tasks, sets, attempts] = await Promise.all([
    api.select('oge_tasks_public', { order: 'num' }),
    api.select('oge_sets', { eq: { student_id: sid }, order: 'created_at', asc: false }),
    api.select('oge_attempts', { eq: { student_id: sid } }),
  ]);
  const subs = (student?.subjects || SUBJECTS).filter((s) => tasks.some((t) => t.subject === s));
  const visible = tasks.filter((t) => subs.includes(t.subject));
  mount(view, h`
    ${pageHero({ eyebrow: 'Тренажёр ОГЭ', title: isStudent(ctx) ? 'Решай и ' : 'Тренажёр: ', accent: isStudent(ctx) ? 'тренируйся' : student?.name || '',
      sub: isStudent(ctx) ? 'Краткий ответ проверяется сразу, после попытки откроется решение.' : 'Здесь видно, какие номера ОГЭ получаются, а какие нужно подтянуть.' })}
    <div class="section-head"><h2>Задано преподавателем</h2></div>
    ${sets.length ? h`<div class="list card">${sets.map((s) => {
      const done = new Set(attempts.filter((a) => a.set_id === s.id).map((a) => a.task_id)).size, n = s.task_ids.length;
      return h`<a class="item item-link" href="#/trainer/set/${s.id}"><div class="item-main">
        <div class="item-title">${s.title}</div>
        <div class="item-meta">${s.subject} · ${plural(n, 'задача', 'задачи', 'задач')}${s.due_at ? ` · до ${fmtD(s.due_at)}` : ''}</div></div>
        <span class="badge ${done === n ? 'ok' : s.due_at && new Date(s.due_at) < new Date() ? 'bad' : done ? 'info' : 'warn'}">${done === n ? 'готово' : `${done}/${n}`}</span></a>`;
    })}</div>` : empty('Пока ничего не задано', I.target)}
    <div class="section-head"><h2>Тренировка по номерам</h2></div>
    ${statsBlock(visible, attempts, false, (subj, n) => `#/trainer/num/${encodeURIComponent(subj)}/${n}`)}
    <p class="hint">Цвет плитки: зелёный — ≥80% верно, жёлтый — 50–79%, красный — меньше 50%.</p>`);
}

// Решение задач по одной: list — массив задач, setId — если это вариант
async function solver(view, ctx, { list, setId, title, back, startIndex = 0 }) {
  const { api } = ctx;
  const attempts = await api.select('oge_attempts', { eq: { student_id: ctx.studentId } });
  const lastBy = {}; for (const a of attempts.filter((x) => !setId || x.set_id === setId).sort((x, y) => (x.created_at > y.created_at ? 1 : -1))) lastBy[a.task_id] = a;
  let i = startIndex;
  const chip = (t, k) => {
    const a = lastBy[t.id];
    const c = !a ? '' : a.points == null ? 'lv-mid' : a.is_correct || a.points >= a.max_points ? 'lv-ok' : 'lv-bad';
    return h`<button type="button" class="step ${c} ${k === i ? 'on' : ''}" data-go="${k}">${setId ? k + 1 : t.num}</button>`;
  };
  const draw = async () => {
    const t = list[i];
    const a = lastBy[t.id];
    mount(view, h`
      <a href="${back}" class="back">${I.back} Тренажёр</a>
      <div class="page-head"><div><h1>${title}</h1><p class="muted">Задача ${i + 1} из ${list.length}</p></div></div>
      ${list.length > 1 ? h`<div class="steps">${list.map(chip)}</div>` : ''}
      <section class="card task-card">
        <div class="card-head"><span class="num-pill num-pill-lg">№${t.num}</span><span class="muted small">${t.subject}${t.topic ? ` · ${t.topic}` : ''} · ${plural(t.max_points, 'балл', 'балла', 'баллов')}</span></div>
        ${t.body ? h`<div class="task-body">${t.body}</div>` : ''}
        <div class="ti"></div>
        <div id="answer-zone"></div>
      </section>`);
    mount($('.ti', view), await img(api, t.image_path));
    $$('[data-go]', view).forEach((b) => b.addEventListener('click', () => { i = +b.dataset.go; draw(); }));
    const zone = $('#answer-zone', view);
    if (a) return showResult(zone, t, a);
    if (!isStudent(ctx)) { mount(zone, h`<p class="hint">Решает ученик — здесь появится его ответ.</p>${nav()}`); bindNav(zone); return; }
    if (t.answer_type === 'full') {
      mount(zone, h`<form class="stack" id="af">
        <label class="field"><span>Решение (текстом, если удобно)</span><textarea name="answer" rows="4"></textarea></label>
        <label class="field"><span>Фото решения в тетради</span><input type="file" name="file" accept="image/*"></label>
        <button class="btn btn-primary">Отправить на проверку</button></form>${nav()}`);
    } else {
      mount(zone, h`<form class="answer-row" id="af">
        <input name="answer" autocomplete="off" placeholder="Ваш ответ" aria-label="Ответ" required>
        <button class="btn btn-primary">Проверить</button></form>
        <button type="button" class="link-btn giveup">Не знаю — показать ответ</button>${nav()}`);
      $('.giveup', zone).addEventListener('click', () => submit(null));
    }
    bindNav(zone);
    $('#af', zone).addEventListener('submit', (e) => { e.preventDefault(); submit(e.target); });
    $('[name=answer]', zone)?.focus();
  };
  const submit = async (form) => {
    const t = list[i];
    const btn = form && $('button', form); if (btn) { btn.disabled = true; btn.classList.add('loading'); }
    try {
      let file = null, answer = form ? form.answer.value.trim() : null;
      if (form && t.answer_type === 'full') {
        const f = form.file.files[0];
        if (!answer && !f) throw new Error('Напишите решение или прикрепите фото');
        if (f) { file = `${ctx.studentId}/submissions/${safeFileName(f)}`; await api.upload(file, f); }
        if (!answer) answer = '(фото)';
      }
      const r = await api.rpc('trainer_check', { p_task: t.id, p_answer: answer, p_set: setId || null, p_file: file });
      lastBy[t.id] = { task_id: t.id, answer, is_correct: r.correct ?? null, points: r.pending ? null : (r.correct ? t.max_points : 0), max_points: t.max_points, _reveal: r };
      draw();
    } catch (e) { toast(e.message, 'error'); if (btn) { btn.disabled = false; btn.classList.remove('loading'); } }
  };
  const showResult = async (zone, t, a) => {
    let rev = a._reveal;
    if (!rev && a.points != null) { try { rev = await api.rpc('trainer_reveal', { p_task: t.id }); } catch { rev = null; } }
    const ok = a.is_correct || (a.points != null && a.points >= a.max_points);
    mount(zone, h`
      ${a.points == null ? h`<div class="result result-wait">⏳ Решение отправлено — преподаватель проверит и поставит баллы.</div>`
    : h`<div class="result ${ok ? 'result-ok' : 'result-bad'}">${ok ? '✅ Верно!' : a.answer == null ? '👀 Ответ показан' : '❌ Неверно'}
        ${a.answer && a.answer !== '(фото)' ? h`<span class="muted"> Ваш ответ: <b>${a.answer}</b></span>` : ''}
        ${a.points != null && t.answer_type === 'full' ? h`<span> · ${a.points} из ${a.max_points} б.</span>` : ''}</div>`}
      ${a.feedback ? h`<div class="answer">💬 ${a.feedback}</div>` : ''}
      ${rev ? h`<div class="solution"><div><b>Правильный ответ:</b> ${rev.answer || '—'}</div>${rev.solution ? h`<div class="pre">${rev.solution}</div>` : ''}<div class="si"></div></div>` : ''}
      ${nav(true)}`);
    if (rev?.solution_image_path) mount($('.si', zone), await img(api, rev.solution_image_path));
    bindNav(zone);
  };
  const nav = (primary = false) => h`<div class="solver-nav">
    ${i > 0 ? h`<button type="button" class="btn btn-ghost" data-prev>← Назад</button>` : h`<span></span>`}
    ${i < list.length - 1 ? h`<button type="button" class="btn ${primary ? 'btn-primary' : 'btn-ghost'}" data-next>Следующая →</button>`
    : h`<a class="btn ${primary ? 'btn-primary' : 'btn-ghost'}" href="${back}">Готово</a>`}</div>`;
  const bindNav = (zone) => {
    $('[data-prev]', zone)?.addEventListener('click', () => { i--; draw(); });
    $('[data-next]', zone)?.addEventListener('click', () => { i++; draw(); });
  };
  if (!list.length) return mount(view, h`<a href="${back}" class="back">${I.back} Тренажёр</a>${empty('Задач нет', I.target)}`);
  draw();
}

export async function trainerFamily(view, params, ctx) {
  if (!ctx.studentId) return mount(view, empty('Кабинет не подключён', I.users));
  if (!(await tableReady(ctx.api))) return notReady(view);
  const [mode, a1, a2] = params;
  if (mode === 'num') {
    const subj = decodeURIComponent(a1), num = +a2;
    const [tasks, attempts] = await Promise.all([
      ctx.api.select('oge_tasks_public', { eq: { subject: subj, num } }),
      ctx.api.select('oge_attempts', { eq: { student_id: ctx.studentId } }),
    ]);
    const tried = new Set(attempts.map((x) => x.task_id));
    const list = [...tasks.filter((t) => !tried.has(t.id)), ...tasks.filter((t) => tried.has(t.id))];
    return solver(view, ctx, { list, title: `${subj}: задание №${num}`, back: '#/trainer' });
  }
  if (mode === 'set') {
    const [s] = await ctx.api.select('oge_sets', { eq: { id: a1 } });
    if (!s) return mount(view, empty('Вариант не найден', I.target));
    const tasks = byId(await ctx.api.select('oge_tasks_public', { eq: { id: s.task_ids } }));
    return solver(view, ctx, { list: s.task_ids.map((id) => tasks[id]).filter(Boolean), setId: s.id, title: s.title, back: '#/trainer' });
  }
  return familyHome(view, ctx);
}
