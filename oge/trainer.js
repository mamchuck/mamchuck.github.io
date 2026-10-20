// Открытый тренажёр ОГЭ: 5 задач номера → проверка → решение → итог и диагностика.
import { CONFIG } from '../app/js/config.js';

const main = document.querySelector('[data-num]');
const box = document.getElementById('tasks');
const SUBJECT = main.dataset.subject, NUM = +main.dataset.num;
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

function taskCard(t, i) {
  return `
  <form class="card l-card o-task" data-id="${t.id}" autocomplete="off">
    <div class="o-task-head"><span class="x-num">Задача ${i}</span><span class="hint">${esc(t.topic)}</span></div>
    <div class="x-body">${esc(t.body)}</div>
    ${t.image_path ? `<img class="x-img" src="${esc(imgSrc(t.image_path))}" alt="Рисунок к задаче" loading="lazy">` : ''}
    <div class="o-answer">
      <input class="x-input" name="a" inputmode="decimal" placeholder="Ответ" aria-label="Ответ к задаче ${i}">
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
    box.querySelectorAll('.o-task').forEach(bind);
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
      <p class="muted">${good ? `Задание ${NUM} у тебя получается. А как с остальными номерами?` : `Задание ${NUM} пока проседает — это нормально, его можно закрыть за пару недель.`}</p>
      <div class="o-sum-actions">
        <a class="btn btn-primary" href="${UP}diag/">Узнать прогноз на ОГЭ</a>
        <button class="btn btn-ghost" data-more>Ещё 5 задач</button>
      </div>
    </div>`;
  document.querySelector('[data-more]').addEventListener('click', () => { load(); main.scrollIntoView({ behavior: 'smooth' }); });
}

load();
