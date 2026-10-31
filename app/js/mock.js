// «Пробный экзамен»: полный вариант по предмету ученика, таймер как на экзамене, итог и оценка после завершения.
// Вариант собирает сервер (mock_create): по задаче на номер, сначала нерешённые. Ответы проверяет trainer_check,
// но до завершения пробника итог не показывается.
import { h, mount, $, $$, I, toast, confirmDialog, fmtDT, plural, empty, SUBJECTS, safeFileName, pageHero } from './ui.js?v=202610311442';
import { img, lazyImages } from './trainer.js?v=202610311442';

const INFO = {
  'Математика': { n: 25, min: 235, max: 31, grade: [[22, 5], [15, 4], [8, 3], [0, 2]] },
  'Физика': { n: 22, min: 180, max: 39, grade: [[33, 5], [22, 4], [11, 3], [0, 2]] },
};
const gradeOf = (subj, p) => (INFO[subj]?.grade.find(([min]) => p >= min) || [0, 2])[1];
const isStudent = (ctx) => ctx.me.role === 'student';
const endOf = (s) => new Date(s.created_at).getTime() + s.duration_min * 60e3;
const isOver = (s) => !!s.finished_at || Date.now() >= endOf(s);
const hm = (min) => `${Math.floor(min / 60)} ч ${String(min % 60).padStart(2, '0')} мин`;
const clock = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

// Последняя попытка по каждой задаче пробника
function lastAttempts(attempts, setId) {
  const by = {};
  for (const a of attempts.filter((x) => x.set_id === setId).sort((x, y) => (x.created_at > y.created_at ? 1 : -1))) by[a.task_id] = a;
  return by;
}
function score(set, tasks, by) {
  let pts = 0, max = 0, pending = 0, answered = 0;
  for (const id of set.task_ids) {
    const t = tasks[id], a = by[id];
    max += t?.max_points || 0;
    if (!a) continue;
    answered++;
    if (a.points == null) pending++; else pts += a.points;
  }
  return { pts, max, pending, answered, grade: gradeOf(set.subject, pts) };
}

async function load(api, sid) {
  const [sets, attempts] = await Promise.all([
    api.select('oge_sets', { eq: { student_id: sid, kind: 'mock' }, order: 'created_at', asc: false }),
    api.select('oge_attempts', { eq: { student_id: sid } }),
  ]);
  const ids = [...new Set(sets.flatMap((s) => s.task_ids))];
  const tasks = Object.fromEntries((await api.select('oge_tasks_public', { eq: { id: ids } })).map((t) => [t.id, t]));
  return { sets, attempts, tasks };
}

// ---------- Главная: выбор предмета и история ----------
async function home(view, ctx) {
  const { api } = ctx;
  const student = ctx.students.find((s) => s.id === ctx.studentId);
  const subs = (student?.subjects?.length ? student.subjects : SUBJECTS).filter((s) => INFO[s]);
  const { sets, attempts, tasks } = await load(api, ctx.studentId);
  const open = Object.fromEntries(sets.filter((s) => !isOver(s)).map((s) => [s.subject, s]));
  const done = sets.filter(isOver);
  mount(view, h`
    ${pageHero({ eyebrow: 'Пробный экзамен', title: isStudent(ctx) ? 'Проверь себя ' : 'Пробники: ', accent: isStudent(ctx) ? 'как на экзамене' : student?.name || '',
      sub: 'Полный вариант: все номера, таймер и баллы по критериям экзамена. Ответы и решения откроются после завершения.' })}
    ${isStudent(ctx) ? h`<div class="grid-2">${subs.map((s) => h`
      <section class="card stack mock-card">
        <div class="card-head"><h2>${s}</h2><span class="badge info">${plural(INFO[s].n, 'задание', 'задания', 'заданий')}</span></div>
        <p class="muted">Время: ${hm(INFO[s].min)} · максимум ${plural(INFO[s].max, 'балл', 'балла', 'баллов')}.
          Краткие ответы проверяются автоматически, развёрнутые — преподавателем.</p>
        ${open[s] ? h`<a class="btn btn-primary" href="#/mock/${open[s].id}">Продолжить · осталось ${clock(endOf(open[s]) - Date.now())}</a>`
    : h`<button type="button" class="btn btn-primary" data-start="${s}">Начать пробник</button>`}
      </section>`)}</div>
      <p class="hint">Совет: решай за один подход, без подсказок и калькулятора (по физике калькулятор можно). Таймер идёт, даже если закрыть страницу.</p>`
    : ''}
    <div class="section-head"><h2>Результаты</h2></div>
    ${done.length ? h`<div class="list card">${done.map((s) => {
      const r = score(s, tasks, lastAttempts(attempts, s.id));
      return h`<a class="item item-link" href="#/mock/${s.id}"><div class="item-main">
        <div class="item-title">${s.subject} · ${r.pts} из ${r.max} б.</div>
        <div class="item-meta">${fmtDT(s.created_at)} · решено ${r.answered} из ${s.task_ids.length}${r.pending ? ` · на проверке: ${r.pending}` : ''}</div></div>
        <span class="mock-grade g${r.grade}" title="Оценка по шкале ФИПИ">${r.pending ? '≥' : ''}${r.grade}</span></a>`;
    })}</div>` : empty(isStudent(ctx) ? 'Пробников пока не было — начни первый' : 'Ученик ещё не писал пробник', I.target)}`);
  $$('[data-start]', view).forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true; b.classList.add('loading');
    try { location.hash = `#/mock/${await api.rpc('mock_create', { p_subject: b.dataset.start })}`; }
    catch (e) { toast(e.message, 'error'); b.disabled = false; b.classList.remove('loading'); }
  }));
}

// ---------- Пробник идёт ----------
async function run(view, ctx, set, tasks, by) {
  const { api } = ctx;
  const list = set.task_ids.map((id) => tasks[id]).filter(Boolean);
  let i = Math.max(0, list.findIndex((t) => !by[t.id]));
  let timer = null;
  const finish = async (auto = false) => {
    clearInterval(timer);
    try { await api.rpc('mock_finish', { p_set: set.id }); } catch (e) { if (!auto) return toast(e.message, 'error'); }
    if (auto) toast('Время вышло — пробник завершён');
    ctx.refresh();
  };
  const tick = () => {
    const el = $('#mock-clock', view);
    if (!el || !el.isConnected) { clearInterval(timer); return; }
    const left = endOf(set) - Date.now();
    el.textContent = clock(left);
    el.classList.toggle('low', left < 10 * 60e3);
    if (left <= 0) finish(true);
  };
  const draw = async () => {
    const t = list[i], a = by[t.id];
    const n = Object.keys(by).length;
    mount(view, h`
      <a href="#/mock" class="back">${I.back} Пробник</a>
      <div class="mock-bar card">
        <div><b>${set.subject}</b> <span class="muted">· отвечено ${n} из ${list.length}</span></div>
        <span class="mock-clock" id="mock-clock" aria-label="Осталось времени">${clock(endOf(set) - Date.now())}</span>
        <button type="button" class="btn btn-soft btn-sm" id="mock-finish">Завершить</button>
      </div>
      <div class="steps">${list.map((x, k) => h`<button type="button" class="step ${by[x.id] ? 'done' : ''} ${k === i ? 'on' : ''}" data-go="${k}">${x.num}</button>`)}</div>
      <section class="card task-card">
        <div class="card-head"><span class="num-pill num-pill-lg">№${t.num}</span><span class="muted small">${t.answer_type === 'full' ? 'развёрнутый ответ · ' : ''}${plural(t.max_points, 'балл', 'балла', 'баллов')}</span></div>
        ${t.body ? h`<div class="task-body">${t.body}</div>` : ''}
        <div class="ti"></div>
        ${a ? h`<div class="result result-wait">Ответ сохранён${a.answer && a.answer !== '(фото)' ? h`: <b>${a.answer}</b>` : a.file_path ? ' (фото)' : ''}. Можно изменить — засчитается последний.</div>` : ''}
        ${t.answer_type === 'full' ? h`<form class="stack" id="af">
            <label class="field"><span>Решение (текстом, если удобно)</span><textarea name="answer" rows="4"></textarea></label>
            <label class="field"><span>Фото решения в тетради</span><input type="file" name="file" accept="image/*"></label>
            <button class="btn btn-primary">${a ? 'Отправить заново' : 'Сохранить решение'}</button></form>`
    : h`<form class="answer-row" id="af">
            <input name="answer" autocomplete="off" placeholder="${a ? 'Новый ответ' : 'Ваш ответ'}" aria-label="Ответ" required>
            <button class="btn btn-primary">Сохранить</button></form>`}
        <div class="solver-nav">
          ${i > 0 ? h`<button type="button" class="btn btn-ghost" data-step="-1">← Назад</button>` : h`<span></span>`}
          ${i < list.length - 1 ? h`<button type="button" class="btn btn-ghost" data-step="1">${a ? 'Следующая →' : 'Пропустить →'}</button>` : h`<span></span>`}
        </div>
      </section>`);
    mount($('.ti', view), await img(api, t.image_path));
    $$('[data-go]', view).forEach((b) => b.addEventListener('click', () => { i = +b.dataset.go; draw(); }));
    $$('[data-step]', view).forEach((b) => b.addEventListener('click', () => { i += +b.dataset.step; draw(); }));
    $('#mock-finish', view).addEventListener('click', () => {
      const left = list.length - Object.keys(by).length;
      confirmDialog(left ? `Без ответа ${plural(left, 'задание', 'задания', 'заданий')}. Завершить пробник? Изменить ответы будет нельзя.`
        : 'Завершить пробник и посмотреть результат?', () => finish(), 'Завершить');
    });
    $('#af', view).addEventListener('submit', (e) => { e.preventDefault(); submit(e.target); });
    if (t.answer_type !== 'full') $('[name=answer]', view)?.focus();
    tick();
  };
  const submit = async (form) => {
    const t = list[i];
    const btn = $('button', form); btn.disabled = true; btn.classList.add('loading');
    try {
      let file = null, answer = form.answer.value.trim();
      if (t.answer_type === 'full') {
        const f = form.file.files[0];
        if (!answer && !f) throw new Error('Напишите решение или прикрепите фото');
        if (f) { file = `${ctx.studentId}/submissions/${safeFileName(f)}`; await api.upload(file, f); }
        if (!answer) answer = '(фото)';
      }
      await api.rpc('trainer_check', { p_task: t.id, p_answer: answer, p_set: set.id, p_file: file });
      by[t.id] = { task_id: t.id, answer, file_path: file };
      const next = list.findIndex((x, k) => k > i && !by[x.id]);
      if (next >= 0) i = next; else if (i < list.length - 1) i++;
      draw();
    } catch (e) {
      toast(e.message, 'error'); btn.disabled = false; btn.classList.remove('loading');
      if (/завершён/.test(e.message)) ctx.refresh();
    }
  };
  await draw();
  timer = setInterval(tick, 1000);
}

// ---------- Итог: карточка на каждый номер — условие, твой ответ, верный ответ, решение ----------
const STATUS = {
  ok: ['✅', 'Верно'], part: ['🟡', 'Частично'], bad: ['❌', 'Неверно'], none: ['➖', 'Нет ответа'], wait: ['⏳', 'На проверке'],
};
function statusOf(t, a) {
  if (!a) return 'none';
  if (a.points == null) return 'wait';
  return a.points >= t.max_points ? 'ok' : a.points > 0 ? 'part' : 'bad';
}

async function result(view, ctx, set, tasks, by) {
  const { api } = ctx;
  const list = set.task_ids.map((id) => tasks[id]).filter(Boolean);
  const r = score(set, tasks, by);
  // ответы и решения ко всем заданиям (mock_review); если функции ещё нет в базе — только к решённым
  let rev = {};
  try { rev = Object.fromEntries((await api.rpc('mock_review', { p_set: set.id })).map((x) => [x.id, x])); }
  catch {
    await Promise.all(list.filter((t) => by[t.id]?.points != null).map(async (t) => {
      try { rev[t.id] = await api.rpc('trainer_reveal', { p_task: t.id }); } catch {}
    }));
  }
  const st = Object.fromEntries(list.map((t) => [t.id, statusOf(t, by[t.id])]));
  const count = (...k) => list.filter((t) => k.includes(st[t.id])).length;
  const part = (lo, hi) => list.filter((t) => t.num >= lo && t.num <= hi)
    .reduce((acc, t) => [acc[0] + (by[t.id]?.points || 0), acc[1] + t.max_points], [0, 0]);
  const parts = set.subject === 'Математика' ? [['Часть 1', ...part(1, 19)], ['Часть 2', ...part(20, 25)]] : [];
  const lost = list.filter((t) => ['bad', 'part', 'none'].includes(st[t.id])).map((t) => t.num);
  const lv = { ok: 'lv-ok', part: 'lv-mid', wait: 'lv-mid', bad: 'lv-bad', none: '' };
  const yours = (a) => (!a ? '—' : a.answer === '(фото)' ? 'фото решения' : a.answer || '—');

  mount(view, h`
    <a href="#/mock" class="back">${I.back} Пробник</a>
    <section class="card mock-total">
      <span class="mock-grade big g${r.grade}">${r.pending ? '≥' : ''}${r.grade}</span>
      <div><h1>${r.pts} из ${r.max} баллов</h1>
        <p class="muted">${set.subject} · ${fmtDT(set.created_at)} · решено ${r.answered} из ${list.length}</p>
        ${r.pending ? h`<p class="result result-wait">✍️ ${plural(r.pending, 'развёрнутое решение ждёт', 'развёрнутых решения ждут', 'развёрнутых решений ждут')} проверки — оценка может вырасти.</p>` : ''}
        ${set.subject === 'Математика' ? h`<p class="hint">На экзамене для «3» и выше нужно ещё хотя бы 2 балла за геометрию (№ 15–19, 23–25).</p>` : ''}</div>
    </section>
    <div class="stats mock-stats">
      <div class="stat"><span>Верно</span><b>${count('ok')}</b></div>
      <div class="stat"><span>Ошибки</span><b>${count('bad', 'part')}</b></div>
      <div class="stat"><span>Без ответа</span><b>${count('none')}</b></div>
      ${parts.map(([n, p, m]) => h`<div class="stat"><span>${n}</span><b>${p} / ${m}</b></div>`)}
    </div>
    ${lost.length && lost.length < list.length ? h`<div class="section-head"><h2>Что подтянуть</h2></div>
      <div class="chips">${lost.map((n) => h`<a class="btn btn-soft btn-sm" href="#/trainer/num/${encodeURIComponent(set.subject)}/${n}">№${n}</a>`)}</div>
      <p class="hint">Нажми на номер — откроется тренировка по нему.</p>` : ''}
    <div class="section-head mock-review-head"><h2>Разбор по заданиям</h2>
      <div class="seg seg-inline" role="tablist">
        <button type="button" class="on" data-f="all">Все · ${list.length}</button>
        <button type="button" data-f="bad">Ошибки · ${count('bad', 'part', 'none')}</button>
        <button type="button" data-f="ok">Верно · ${count('ok')}</button>
        ${count('wait') ? h`<button type="button" data-f="wait">На проверке · ${count('wait')}</button>` : ''}
      </div></div>
    <div class="steps">${list.map((t) => h`<button type="button" class="step ${lv[st[t.id]]}" data-jump="${t.num}">${t.num}</button>`)}</div>
    <div class="mock-review">${list.map((t) => {
      const a = by[t.id], s = st[t.id], x = rev[t.id], ok = s === 'ok';
      const sol = x ? h`${x.solution ? h`<div class="pre">${x.solution}</div>` : h`<p class="muted">Решение к этой задаче не добавлено.</p>`}
        ${x.solution_image_path ? h`<div class="tf-img" data-img="${x.solution_image_path}"><div class="tf-img-ph"></div></div>` : ''}` : '';
      return h`<article class="card mock-item st-${s}" id="q-${t.num}" data-st="${s}">
        <header class="mock-item-head">
          <span class="num-pill num-pill-lg">№${t.num}</span>
          <span class="mock-item-topic muted small">${t.topic || ''}</span>
          <span class="mock-badge st-${s}">${STATUS[s][0]} ${STATUS[s][1]}</span>
          <span class="mock-pts">${a?.points ?? 0}<small>/${t.max_points}</small></span>
        </header>
        ${t.body ? h`<div class="task-body">${t.body}</div>` : ''}
        ${t.image_path ? h`<div class="tf-img" data-img="${t.image_path}"><div class="tf-img-ph"></div></div>` : ''}
        <div class="mock-ans">
          <div class="mock-ans-cell your st-${s}"><small>Твой ответ</small><b>${yours(a)}</b></div>
          <div class="mock-ans-cell right"><small>Правильный ответ</small><b>${x ? x.answer || '—' : '—'}</b></div>
        </div>
        ${a?.feedback ? h`<div class="answer">💬 ${a.feedback}</div>` : ''}
        ${x ? (ok ? h`<details class="mock-sol"><summary>Посмотреть решение</summary>${sol}</details>`
    : h`<div class="mock-sol open"><div class="mock-sol-title">Решение</div>${sol}</div>`) : ''}
        ${['bad', 'part', 'none'].includes(s) ? h`<a class="link-btn mock-train" href="#/trainer/num/${encodeURIComponent(set.subject)}/${t.num}">Потренировать № ${t.num} →</a>` : ''}
      </article>`;
    })}</div>`);
  lazyImages(view, api);
  $$('[data-jump]', view).forEach((b) => b.addEventListener('click', () => {
    const el = $(`#q-${b.dataset.jump}`, view);
    if (el.hidden) { $('[data-f="all"]', view).click(); }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  $$('[data-f]', view).forEach((b) => b.addEventListener('click', () => {
    $$('[data-f]', view).forEach((x) => x.classList.toggle('on', x === b));
    const f = b.dataset.f, want = { all: null, bad: ['bad', 'part', 'none'], ok: ['ok'], wait: ['wait'] }[f];
    $$('.mock-item', view).forEach((el) => { el.hidden = !!want && !want.includes(el.dataset.st); });
  }));
}

export async function mockView(view, params, ctx) {
  if (!ctx.studentId) return mount(view, empty('Кабинет не подключён', I.users));
  const id = params[0];
  if (!id) return home(view, ctx);
  const [set] = await ctx.api.select('oge_sets', { eq: { id } });
  if (!set || set.kind !== 'mock') return mount(view, h`<a href="#/mock" class="back">${I.back} Пробник</a>${empty('Пробник не найден', I.target)}`);
  if (isOver(set) && !set.finished_at && isStudent(ctx)) { try { await ctx.api.rpc('mock_finish', { p_set: id }); } catch {} }
  const { attempts, tasks } = await load(ctx.api, ctx.studentId);
  const by = lastAttempts(attempts, id);
  return isOver(set) || !isStudent(ctx) ? result(view, ctx, set, tasks, by) : run(view, ctx, set, tasks, by);
}
