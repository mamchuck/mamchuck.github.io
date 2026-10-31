// «Повторение» (только для преподавателя): план повторения теории с материалами по темам. Бот раз в 4 дня присылает очередную тему,
// а здесь лежит полный материал: определения, законы, ловушки, задачи с решениями, вопросы для самопроверки и источники.
import { h, mount, $, $$, I, esc, raw, toast, pageHero, spinner, empty } from './ui.js?v=202611010155';

const BASE = '../study/';
const SEC_ICON = { 'Механика': '🚀', 'Тепловые явления': '🔥', 'Электричество': '⚡', 'Магнетизм': '🧲', 'Оптика': '🔦', 'Атом и ядро': '⚛️', 'Методология': '📐' };
let tex = null;
const loadTex = async () => { tex ||= await import('../../sim/tex.js?v=202611010155'); await tex.ready(); return tex; };

// Текст с формулами: $...$ — LaTeX; переносы строк — абзацы; **жирный**
function rich(s) {
  const parts = String(s).split(/(\$[^$]+\$)/g).map((p) => (/^\$[^$]+\$$/.test(p) ? (tex ? tex.math(p.slice(1, -1)) : esc(p)) : esc(p).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')));   // переносы только в тексте: внутри формул они ломают SVG корней
  return parts.join('');
}
const LEVEL = { 'база': 'st-l1', 'ОГЭ': 'st-l2', 'повышенная': 'st-l3', 'олимпиадная': 'st-l4' };

async function progress(api) {
  try {
    const [topics, logs] = await Promise.all([api.select('study_topics', {}), api.select('study_log', { order: 'sent_at', asc: false })]);
    const byTopic = {}; for (const l of logs) (byTopic[l.topic_id] ||= []).push(l);
    return Object.fromEntries(topics.map((t) => [t.slug, { id: t.id, logs: byTopic[t.id] || [] }]));
  } catch { return {}; }
}
const fmtD = (s) => new Date(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

export async function studyPage(view, [slug], ctx) {
  await loadTex();
  const { api } = ctx;
  const [index, prog] = await Promise.all([fetch(`${BASE}index.json`).then((r) => r.json()).catch(() => []), progress(api)]);
  if (!slug) return list(view, index, prog);
  const topic = await fetch(`${BASE}${encodeURIComponent(slug)}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!topic) { mount(view, h`<a href="#/study" class="back">${I.back} Повторение</a>${empty('Такой темы нет', I.book)}`); return; }
  detail(view, topic, index, prog[slug], api);
}

function list(view, index, prog) {
  const secs = [...new Set(index.map((t) => t.section))];
  const done = index.filter((t) => prog[t.slug]?.logs.some((l) => l.done_at)).length;
  mount(view, h`${pageHero({ eyebrow: 'Для себя', title: 'Повторение ', accent: 'теории', sub: 'Раз в 4 дня бот присылает тему на 35–40 минут. Здесь лежит полный материал: определения, законы, ловушки, задачи с решениями и вопросы для самопроверки.' })}
    ${index.length ? h`<div class="st-meter"><b>${done}</b> из ${index.length} тем повторено <i><span style="width:${index.length ? (done / index.length) * 100 : 0}%"></span></i></div>` : ''}
    ${secs.map((s) => h`<section class="st-sec"><h2 class="st-sec-h"><span>${SEC_ICON[s] || '📘'}</span>${s}</h2>
      <div class="st-grid">${index.filter((t) => t.section === s).map((t) => { const p = prog[t.slug], last = p?.logs.find((l) => l.done_at); return h`
        <a class="st-tile" href="#/study/${t.slug}"><span class="st-n">${t.n}</span><b>${t.title}</b>
          <small>⏱ ${t.minutes} мин · ${t.defs} опр. · ${t.problems} задач</small>
          <em class="${last ? 'ok' : ''}">${last ? '✓ повторено ' + fmtD(last.done_at) : p?.logs.length ? 'присылал ' + fmtD(p.logs[0].sent_at) : 'ещё не было'}</em></a>`; })}</div></section>`)}
    ${index.length ? '' : empty('Материалы пока не загружены', I.book)}`);
}

function detail(view, t, index, p, api) {
  const i = index.findIndex((x) => x.slug === t.slug), prev = index[i - 1], next = index[i + 1];
  const last = p?.logs.find((l) => l.done_at);
  const block = (id, title, ic, body) => (body ? `<section class="card st-card" id="${id}"><h2><span>${ic}</span>${title}</h2>${body}</section>` : '');
  const defs = t.defs.length ? `<dl class="st-defs">${t.defs.map((d) => `<div><dt>${rich(d.t)}</dt><dd>${rich(d.d)}</dd></div>`).join('')}</dl>` : '';
  const laws = t.laws.length ? t.laws.map((l) => `<div class="st-law"><b>${rich(l.t)}</b><div class="st-tex">${tex.math(l.tex, true)}</div><p>${rich(l.d)}</p></div>`).join('') : '';
  const list = (a) => (a.length ? `<ul class="st-ul">${a.map((x) => `<li>${rich(x)}</li>`).join('')}</ul>` : '');
  const probs = t.problems.length ? t.problems.map((q, k) => `<details class="st-prob"><summary><span class="st-lv ${LEVEL[q.level] || 'st-l2'}">${esc(q.level)}</span><span class="st-pn">Задача ${k + 1}</span><span class="st-pq">${rich(q.q)}</span></summary>
      ${q.hint ? `<p class="st-hint"><b>Подсказка.</b> ${rich(q.hint)}</p>` : ''}<div class="st-sol"><b>Решение.</b> ${rich(q.a)}</div></details>`).join('') : '';
  const src = t.sources.length ? `<ul class="st-ul">${t.sources.map((s) => `<li><b>${esc(s.t)}</b> — ${rich(s.n)}</li>`).join('')}</ul>` : '';
  mount(view, h`<a href="#/study" class="back">${I.back} Повторение</a>
    <header class="st-head"><span class="st-chip">${SEC_ICON[t.section] || '📘'} ${t.section}</span><h1>${t.n}. ${t.title}</h1>
      <p class="muted">⏱ ${t.minutes} минут: 10 — определения вслух, 10 — законы и их происхождение, 15 — задачи, 5 — самопроверка.${last ? ' · ✓ повторено ' + fmtD(last.done_at) : ''}</p>
      <nav class="st-toc">${raw([['sum', 'Главное'], ['defs', 'Определения'], ['laws', 'Законы'], ['ideas', 'Глубже'], ['traps', 'Ловушки'], ['probs', 'Задачи'], ['check', 'Самопроверка'], ['src', 'Источники']].map(([a, l]) => `<a href="#/study/${t.slug}" data-go="${a}">${l}</a>`).join(''))}</nav></header>
    <div id="st-body">${raw([
      block('sum', 'Главное «на отлично»', '⚡', list(t.summary)),
      block('defs', 'Определения: выучить дословно', '📖', defs),
      block('laws', 'Законы и формулы', '🧮', laws),
      block('ideas', 'Что понимать глубже школьной программы', '🧠', list(t.ideas)),
      block('traps', 'Ловушки и типичные ошибки', '⚠️', list(t.traps)),
      block('probs', 'Задачи (сначала решай сам, потом открывай решение)', '🎯', probs),
      block('check', 'Вопросы для самопроверки', '✅', list(t.check)),
      block('src', 'Где читать дальше', '📚', src),
    ].join(''))}</div>
    <div class="st-foot">${p ? h`<button class="btn btn-primary" id="st-done">✓ Повторил</button>` : ''}
      ${prev ? h`<a class="btn btn-ghost" href="#/study/${prev.slug}">← ${prev.title}</a>` : ''}${next ? h`<a class="btn btn-ghost" href="#/study/${next.slug}">${next.title} →</a>` : ''}</div>`);
  $$('[data-go]', view).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); document.getElementById(a.dataset.go)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  $('#st-done', view)?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try { await api.insert('study_log', { topic_id: p.id, done_at: new Date().toISOString() }); toast('Записал: тема повторена'); } catch (err) { toast(err.message, 'error'); e.currentTarget.disabled = false; }
  });
}
