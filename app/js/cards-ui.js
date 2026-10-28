// Шпаргалки: карточки теории по разделам → тема → просмотр на весь экран (свайп, стрелки, Esc).
// Только в кабинете (#/cards), после входа. Данные — cards/cards.json (build_cards.py).
// mountCards(root, { base, hero, trainer(topic, subject) → ссылка | null, history })
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const word = (n, one, few, many) => { const a = n % 100, b = n % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
const SECTION_ICO = { 'Механика': '🚀', 'Тепловые явления': '🔥', 'Электричество': '⚡', 'Оптика': '🔦', 'Атом и ядро': '⚛️' };

export async function mountCards(root, { base = '../', hero = '', trainer = () => null, history: useHistory = false } = {}) {
  root.innerHTML = '<div class="cd-spin"></div>';
  let data;
  try { data = await fetch(`${base}cards/cards.json`).then((r) => r.json()); }
  catch { root.innerHTML = '<p class="muted">Не удалось загрузить шпаргалки. Обновите страницу.</p>'; return; }
  const all = data.subjects.flatMap((s) => s.sections.flatMap((sec) => sec.topics.map((t) => ({ ...t, subject: s, section: sec.name }))));
  const img = (t, i, thumb) => `${base}cards/${t.subject.slug}/${t.slug}/${thumb ? 't/' : ''}${String(i).padStart(2, '0')}.jpg`;
  let subj = data.subjects[0];

  // ---------- Разделы и темы ----------
  function list() {
    const tabs = data.subjects.length > 1 ? `<div class="cd-tabs">${data.subjects.map((s) => `<button class="${s === subj ? 'on' : ''}" data-subj="${esc(s.slug)}">${esc(s.name)}</button>`).join('')}</div>` : '';
    root.innerHTML = `${hero}${tabs}
      ${subj.sections.map((sec) => `
        <section class="cd-sec">
          <h2 class="cd-sec-h"><span>${SECTION_ICO[sec.name] || '📘'}</span>${esc(sec.name)}<small>${sec.topics.length} ${word(sec.topics.length, 'тема', 'темы', 'тем')}</small></h2>
          <div class="cd-grid">${sec.topics.map((t) => `
            <button class="cd-topic" data-topic="${esc(t.slug)}">
              <span class="cd-cover"><img src="${img({ ...t, subject: subj }, 1, true)}" alt="" loading="lazy" decoding="async"></span>
              <span class="cd-topic-main"><b>${esc(t.title)}</b><small>${t.count} ${word(t.count, 'карточка', 'карточки', 'карточек')}${t.oge ? ` · ОГЭ № ${t.oge}` : ''}</small></span>
            </button>`).join('')}</div>
        </section>`).join('')}`;
    root.querySelectorAll('[data-subj]').forEach((b) => b.addEventListener('click', () => { subj = data.subjects.find((s) => s.slug === b.dataset.subj); list(); }));
    root.querySelectorAll('[data-topic]').forEach((b) => b.addEventListener('click', () => open(b.dataset.topic)));
  }

  // ---------- Тема: «главное за 30 секунд» и все карточки ----------
  function open(slug, push = true) {
    const t = all.find((x) => x.slug === slug);
    if (!t) return list();
    if (useHistory && push) history.pushState({ cd: slug }, '', `#${slug}`);
    const link = trainer(t, t.subject.name);
    root.innerHTML = `
      <button class="cd-back" data-back>← Все шпаргалки</button>
      <header class="cd-head card">
        <span class="cd-kicker">${SECTION_ICO[t.section] || '📘'} ${esc(t.subject.name)} · ${esc(t.section)}</span>
        <h1>${esc(t.title)}</h1>
        <div class="cd-intro"><b>⚡ Главное за 30 секунд</b><ul>${t.intro.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="cd-actions">
          <button class="btn btn-primary" data-view="1">Смотреть карточки →</button>
          ${link ? `<a class="btn btn-ghost" href="${link}">🎯 Задачи по теме</a>` : ''}
        </div>
      </header>
      <div class="cd-thumbs">${Array.from({ length: t.count }, (_, k) => `
        <button class="cd-thumb" data-view="${k + 1}" aria-label="Карточка ${k + 1}"><img src="${img(t, k + 1, true)}" alt="${esc(t.title)}, карточка ${k + 1}" loading="lazy" decoding="async"><span>${k + 1}</span></button>`).join('')}</div>`;
    root.querySelector('[data-back]').addEventListener('click', () => { if (useHistory && location.hash) history.back(); else list(); });
    root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => viewer(t, +b.dataset.view)));
    root.scrollIntoView?.({ block: 'start' });
  }

  // ---------- Просмотр на весь экран ----------
  function viewer(t, start) {
    let i = start;
    const ov = document.createElement('div');
    ov.className = 'cd-view'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', t.title);
    ov.innerHTML = `
      <div class="cd-view-top"><span class="cd-view-title">${esc(t.title)}</span><span class="cd-count"></span><button class="cd-x" aria-label="Закрыть">✕</button></div>
      <div class="cd-stage"><button class="cd-nav prev" aria-label="Назад">‹</button><img alt=""><button class="cd-nav next" aria-label="Дальше">›</button></div>
      <div class="cd-dots">${Array.from({ length: t.count }, (_, k) => `<i data-k="${k + 1}"></i>`).join('')}</div>`;
    document.body.appendChild(ov);
    document.body.classList.add('cd-lock');
    const im = ov.querySelector('img'), cnt = ov.querySelector('.cd-count');
    const show = () => {
      im.src = img(t, i, false); im.alt = `${t.title}, карточка ${i} из ${t.count}`;
      cnt.textContent = `${i} / ${t.count}`;
      ov.querySelectorAll('.cd-dots i').forEach((d) => d.classList.toggle('on', +d.dataset.k === i));
      ov.querySelector('.prev').disabled = i === 1; ov.querySelector('.next').disabled = i === t.count;
      if (i < t.count) new Image().src = img(t, i + 1, false);         // следующая — заранее
    };
    const go = (d) => { const n = i + d; if (n >= 1 && n <= t.count) { i = n; show(); } };
    const close = () => { ov.remove(); document.body.classList.remove('cd-lock'); removeEventListener('keydown', key); };
    const key = (e) => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); };
    addEventListener('keydown', key);
    ov.querySelector('.cd-x').addEventListener('click', close);
    ov.querySelector('.prev').addEventListener('click', () => go(-1));
    ov.querySelector('.next').addEventListener('click', () => go(1));
    ov.querySelectorAll('.cd-dots i').forEach((d) => d.addEventListener('click', () => { i = +d.dataset.k; show(); }));
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.classList.contains('cd-stage')) close(); });
    let x0 = null;                                                     // свайп
    ov.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    ov.addEventListener('pointerup', (e) => { if (x0 != null && Math.abs(e.clientX - x0) > 50) go(e.clientX < x0 ? 1 : -1); x0 = null; });
    show();
  }

  if (useHistory) addEventListener('popstate', () => { const s = location.hash.slice(1); if (s) open(s, false); else list(); });
  const start = location.hash.slice(1);
  if (useHistory && all.some((x) => x.slug === start)) open(start, false); else list();
}
