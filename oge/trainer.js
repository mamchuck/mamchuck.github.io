// Открытый тренажёр ОГЭ и ЕГЭ: 5 задач номера → проверка → решение → итог и диагностика.
import { CONFIG } from '../app/js/config.js?v=202610262010';

const main = document.querySelector('[data-num]');
const box = document.getElementById('tasks');
const SUBJECT = main.dataset.subject, NUM = +main.dataset.num;
const PART2 = main.dataset.part === '2';   // вторая часть: решение на бумаге → сравнение с эталоном
const EXAM = main.dataset.exam || 'ОГЭ';   // ОГЭ | ЕГЭ
const UP = '../../../';
const seen = [];
let score = { ok: 0, done: 0, total: 0 };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const imgSrc = (p) => (/^https?:/.test(p) ? p : `${UP}app/${p}`);

// Ученик вошёл в кабинет (сессия Supabase в этом же браузере) → решения идут в его прогресс через trainer_check
function session() {
  try {
    const k = Object.keys(localStorage).find((x) => /^sb-.+-auth-token$/.test(x));
    const s = k && JSON.parse(localStorage.getItem(k));
    return s?.access_token && s.expires_at * 1000 > Date.now() + 30e3 ? s.access_token : null;
  } catch { return null; }
}
let asStudent = !!session();

async function rpc(fn, args, token) {
  const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: CONFIG.supabaseAnonKey, Authorization: `Bearer ${token || CONFIG.supabaseAnonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(r.status === 404 ? 'Тренажёр скоро заработает.' : data?.message || 'Ошибка сети');
  return data;
}

// Вторая часть: развёрнутое решение не проверить автоматически — даём эталон и самооценку
function fullCard(t, i) {
  return `
  <div class="card l-card o-task o-full" data-id="${t.id}">
    <div class="o-task-head"><span class="x-num">Задача ${i}</span><span class="hint">${esc(t.topic)} · ${t.max_points} балл${t.max_points > 1 && t.max_points < 5 ? 'а' : 'ов'}</span></div>
    <div class="x-body">${esc(t.body)}</div>
    ${t.image_path ? `<img class="x-img" src="${esc(imgSrc(t.image_path))}" alt="Рисунок к задаче" loading="lazy">` : ''}
    <p class="o-paper">✍️ Реши на листочке, оформи как на экзамене — потом сравни с эталоном.</p>
    <button type="button" class="btn btn-primary o-reveal" data-reveal>Сравнить с решением</button>
    <div class="o-result" hidden></div>
  </div>`;
}

function taskCard(t, i) {
  if (t.full) return fullCard(t, i);
  return `
  <form class="card l-card o-task" data-id="${t.id}" autocomplete="off">
    <div class="o-task-head"><span class="x-num">Задача ${i}</span><span class="hint">${esc(t.topic)}</span></div>
    <div class="x-body">${esc(t.body)}</div>
    ${t.image_path ? `<img class="x-img" src="${esc(imgSrc(t.image_path))}" alt="Рисунок к задаче" loading="lazy">` : ''}
    <div class="o-answer">
      <input class="x-input" name="a" inputmode="${EXAM === 'ЕГЭ' ? 'text' : 'decimal'}" placeholder="Ответ" aria-label="Ответ к задаче ${i}">
      <button class="btn btn-primary">Проверить</button>
    </div>
    <button type="button" class="link-btn small o-show" data-show>Не знаю — показать решение</button>
    <div class="o-result" hidden></div>
  </form>`;
}

async function load() {
  box.innerHTML = '<div class="x-spin"></div>';
  try {
    const tasks = await rpc('pt_tasks', { p_subject: SUBJECT, p_num: NUM, p_limit: 5, p_exclude: seen });
    if (!tasks.length) { box.innerHTML = '<div class="card l-card">Задачи этого номера закончились — попробуй соседний номер.</div>'; return; }
    tasks.forEach((t) => seen.push(t.id));
    score = { ok: 0, done: 0, total: tasks.length };
    box.innerHTML = tasks.map((t, i) => taskCard(t, i + 1)).join('') + '<div id="summary"></div>';
    box.querySelectorAll('.o-task').forEach((el) => (el.classList.contains('o-full') ? bindFull(el) : bind(el)));
  } catch (e) {
    box.innerHTML = `<div class="card l-card">😕 ${esc(e.message)}</div>`;
  }
}

function bind(form) {
  const check = async (answer) => {
    if (form.dataset.done) return;
    form.dataset.done = '1';
    form.querySelectorAll('button, input').forEach((el) => { el.disabled = true; });
    try {
      let r = null;
      if (asStudent) {
        // засчитать в прогресс; если аккаунт не ученика (родитель/преподаватель) — обычная проверка
        try { r = await rpc('trainer_check', { p_task: form.dataset.id, p_answer: answer }, session()); markCounted(); }
        catch { asStudent = false; }
      }
      if (!r) r = await rpc('pt_check', { p_task: form.dataset.id, p_answer: answer });
      score.done += 1; if (r.correct) score.ok += 1;
      form.classList.add(r.correct ? 'is-ok' : 'is-bad');
      const res = form.querySelector('.o-result');
      res.hidden = false;
      res.innerHTML = `
        <p class="o-verdict">${r.correct ? '✅ Верно!' : answer == null ? '💡 Разбор' : '❌ Неверно'} · ответ: <b>${esc(r.answer)}</b></p>
        ${r.solution ? `<div class="o-solution">${esc(r.solution)}</div>` : ''}
        ${r.solution_image_path ? `<img class="x-img" src="${esc(imgSrc(r.solution_image_path))}" alt="Рисунок к решению" loading="lazy">` : ''}`;
      if (score.done === score.total) summary();
    } catch (e) {
      delete form.dataset.done;
      form.querySelectorAll('button, input').forEach((el) => { el.disabled = false; });
      alert(e.message);
    }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); const v = form.a.value.trim(); if (v) check(v); else form.a.focus(); });
  form.querySelector('[data-show]').addEventListener('click', () => check(null));
}

function bindFull(card) {
  card.querySelector('[data-reveal]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const r = await rpc('pt_reveal', { p_task: card.dataset.id });
      btn.remove();
      const res = card.querySelector('.o-result');
      res.hidden = false;
      res.innerHTML = `
        <p class="o-verdict">📘 Эталонное решение · максимум ${r.max_points} балл${r.max_points > 1 && r.max_points < 5 ? 'а' : 'ов'}</p>
        <div class="o-solution">${esc(r.solution)}</div>
        ${r.solution_image_path ? `<img class="x-img o-graph" src="${esc(imgSrc(r.solution_image_path))}" alt="График к решению" loading="lazy">` : ''}
        <div class="o-self"><span>Как у тебя?</span>
          <button type="button" class="btn btn-sm o-s ok" data-mark="ok">✅ Решил верно</button>
          <button type="button" class="btn btn-sm o-s part" data-mark="part">🟡 Частично</button>
          <button type="button" class="btn btn-sm o-s no" data-mark="no">❌ Не получилось</button></div>`;
      res.querySelectorAll('[data-mark]').forEach((b) => b.addEventListener('click', () => {
        const mark = b.dataset.mark;
        res.querySelectorAll('[data-mark]').forEach((x) => { x.disabled = true; x.classList.toggle('on', x === b); });
        card.classList.add(mark === 'ok' ? 'is-ok' : mark === 'no' ? 'is-bad' : 'is-part');
        rpc('pt_self', { p_task: card.dataset.id, p_mark: mark }).catch(() => {});
        score.done += 1; if (mark === 'ok') score.ok += 1;
        if (score.done === score.total) summary();
      }));
    } catch (err) {
      btn.disabled = false;
      alert(err.message);
    }
  });
}

function markCounted() {
  if (document.querySelector('.o-counted')) return;
  const el = document.createElement('a');
  el.className = 'o-counted'; el.href = `${UP}app/#/progress`;
  el.innerHTML = '✓ Решения засчитываются в твою карту прогресса →';
  document.querySelector('.o-hero')?.appendChild(el);
}

function summary() {
  const { ok, total } = score;
  const good = ok >= total - 1;
  document.getElementById('summary').innerHTML = `
    <div class="card l-card o-summary ${good ? 'good' : ''}">
      <b class="o-score">${ok} из ${total}</b>
      <p class="muted">${good ? `Задание ${NUM} у тебя получается. А как с остальными номерами?`
        : PART2 ? `Вторая часть — это про оформление и обоснования. На занятии разберём, за что эксперт снимает баллы.`
        : `Задание ${NUM} пока проседает — это нормально, его можно закрыть за пару недель.`}</p>
      <div class="o-sum-actions">
        <a class="btn btn-primary" href="${UP}diag/${EXAM === 'ЕГЭ' ? '?ege' : ''}">Узнать прогноз на ${EXAM}</a>
        <button class="btn btn-ghost" data-more>Ещё 5 задач</button>
      </div>
    </div>`;
  document.querySelector('[data-more]').addEventListener('click', () => { load(); main.scrollIntoView({ behavior: 'smooth' }); });
}

load();
