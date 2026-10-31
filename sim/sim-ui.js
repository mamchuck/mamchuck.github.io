// Общий интерфейс песочницы: сцена, шкала времени, графики, ползунки параметров, таблица «Положения», формулы (LaTeX).
// Один и тот же модуль работает на открытой странице и в кабинете. Сцену описывает отдельный файл (spring.js).
// Плавность: движение считается по реальному времени; на паузе и вне экрана ничего не рисуется; фон сцены и графиков —
// отдельные слои, которые не перерисовываются; в кадре — пружина, груз и пара линий курсора, без копирования больших картинок.
import { fmt, math, ready } from './tex.js?v=202610311433';
import { Graphs } from './graph.js?v=202610311433';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let current = null;                                           // прошлая сцена на странице закрывается при открытии новой

export async function mountSim(root, scene, { mode = 'cabinet' } = {}) {
  current?.();
  let alive = true; const stopFlag = () => { alive = false; }; current = stopFlag;
  await ready();                                              // KaTeX и его шрифты: чтобы первый кадр сразу был в LaTeX
  if (!alive || !root.isConnected) return;

  const P = Object.fromEntries(scene.params.map((q) => [q.id, q.def]));
  let d = scene.derive(P), T4 = scene.window(d), t = 0, speed = 0.5, run = true, dirty = true, raf = 0, last = 0, vis = true, lastUi = 0, lastClock = '', rt = null, lastW = 0, relayout = 0, holding = false;
  const flags = Object.fromEntries(scene.toggles.map((q) => [q.id, false]));
  const on = new Set(scene.panels.filter((q) => q.on).map((q) => q.id));
  const { w: SW, h: SH } = scene.stage;

  root.innerHTML = `
  <div class="sm sm-${mode}">
    <div class="sm-grid">
      <div class="sm-main">
        <section class="sm-card sm-fig">
          <div class="sm-stagebox" style="aspect-ratio:${SW} / ${SH}">
            <div class="sm-clock"><b>0,00</b> с</div>
          </div>
          <div class="sm-scrubrow"><input type="range" class="sm-scrub" min="0" max="1000" value="0" aria-label="Момент времени"><div class="sm-ticks"></div></div>
          <div class="sm-btns">
            <button class="sm-btn sm-play" type="button"></button>
            <button class="sm-btn sm-ghost sm-reset" type="button"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/></svg>Сброс</button>
            <span class="sm-seg" role="group" aria-label="Скорость">${[0.25, 0.5, 1].map((v) => `<button type="button" data-sp="${v}" class="${v === speed ? 'on' : ''}">${String(v).replace('.', ',')}×</button>`).join('')}</span>
            <span class="sm-tog" role="group" aria-label="Показать векторы">${scene.toggles.map((q) => `<button type="button" data-tg="${q.id}" style="--c:${q.color}" aria-pressed="false"><i></i>${esc(q.name)}</button>`).join('')}</span>
          </div>
        </section>
        <section class="sm-card sm-gcard">
          <div class="sm-chips" role="group" aria-label="Какие графики показать"><span class="sm-chips-l">Графики</span>${scene.panels.map((q) => `<button type="button" data-pn="${q.id}" class="${on.has(q.id) ? 'on' : ''}" aria-pressed="${on.has(q.id)}">${math(q.tex)}</button>`).join('')}</div>
          <div class="sm-gwrap"></div>
        </section>
      </div>
      <aside class="sm-side">
        <section class="sm-card"><h3>Параметры</h3>
          ${scene.params.map((q) => `<label class="sm-par"><span class="sm-par-h"><span>${esc(q.name)} ${math(q.tex)}</span><output data-o="${q.id}"></output></span>
            <input type="range" data-p="${q.id}" min="${q.min}" max="${q.max}" step="${q.step}" value="${q.def}" aria-label="${esc(q.name)}"></label>`).join('')}
        </section>
        <section class="sm-card"><h3>Положения</h3>
          <table class="sm-tab"><thead><tr><th></th>${scene.table.cols.map((c, i) => `<th>${math(c)}<small>${esc(scene.table.units[i])}</small></th>`).join('')}</tr></thead>
            <tbody>${scene.table.rows.map((r) => `<tr data-r="${r.id}"><th><i class="sm-dot sm-dot-${r.id}"></i>${esc(r.name)}</th>${scene.table.cols.map(() => '<td></td>').join('')}</tr>`).join('')}
              <tr class="sm-now"><th>Сейчас</th>${scene.table.cols.map(() => '<td></td>').join('')}</tr></tbody></table>
          <p class="sm-note">Строка подсвечивается, когда груз проходит это положение. На графиках такие моменты отмечены вертикалями того же цвета: оранжевые — крайнее положение, синие — равновесие.</p>
        </section>
        <section class="sm-card"><h3>Что получается</h3><dl class="sm-out"></dl></section>
      </aside>
    </div>
    <section class="sm-card sm-formulas"><h3>Формулы</h3><div class="sm-fr">${scene.formulas.map((f) => `<div class="sm-fm"><small><i style="background:${f.color}"></i>${esc(f.tag)}</small><div class="sm-f">${math(f.tex, true)}</div></div>`).join('')}</div></section>
  </div>`;
  const $ = (s) => root.querySelector(s), $$ = (s) => [...root.querySelectorAll(s)];
  const box = $('.sm-stagebox'), scrub = $('.sm-scrub'), play = $('.sm-play'), out = $('.sm-out'), clockEl = $('.sm-clock b');
  const graphs = new Graphs($('.sm-gwrap'));

  // ---------- Пересборка слоёв (размер окна, параметры, набор графиков) ----------
  const S_ = { at: (tt) => scene.at(P, d, tt), get d() { return d; } };
  function graphsSetup() {
    const panels = scene.panels.filter((q) => on.has(q.id)).map((q) => ({ label: q.label, unit: q.unit, signed: q.signed, max: q.max(P, d), curves: q.curves(S_).map((c) => ({ ...c })) }));
    graphs.setup({ panels, T: T4, period: d.T, marks: scene.marks(P, d, T4) });
  }
  function layout() {                                         // полная пересборка: размер окна или набор графиков
    if (!alive) return;
    rt.resize(); rt.params(P); graphsSetup();
    lastW = box.clientWidth; dirty = true; kick();
  }
  function relayout_() {                                      // только параметры: фон сцены (деления оси) и графики
    if (!alive) return;
    rt.params(P); graphsSetup(); dirty = true; kick();
  }
  function ticks() { $('.sm-ticks').innerHTML = [1, 2, 3, 4].map((k) => `<span style="left:${(k / 4) * 100}%">${math(k === 1 ? 'T' : `${k}T`)}</span>`).join(''); }
  function readouts() {
    $$('[data-o]').forEach((o) => { const q = scene.params.find((x) => x.id === o.dataset.o); o.innerHTML = `${fmt(P[q.id], q.dec)} <small>${esc(q.unit)}</small>`; const inp = $(`[data-p="${q.id}"]`); inp.style.setProperty('--p', `${((P[q.id] - q.min) / (q.max - q.min)) * 100}%`); });
    out.innerHTML = scene.readouts(P, d).map(([n, s, v]) => `<div><dt>${esc(n)} ${math(s)}</dt><dd>${v}</dd></div>`).join('');
    scene.table.rows.forEach((r) => { const tds = $(`[data-r="${r.id}"]`).querySelectorAll('td'); r.vals(P, d).forEach((v, i) => { tds[i].textContent = fmt(v, v >= 10 ? 1 : 2); }); });
  }

  // ---------- Кадр ----------
  function render() {
    const s = scene.at(P, d, t);
    rt.update(s, d, flags);
    graphs.draw(t);
    const now = performance.now();
    if (now - lastUi > 80) {                                // текст и подсветку обновляем реже, чем рисуем, и только если что-то изменилось
      lastUi = now;
      const c = fmt(t, 2); if (c !== lastClock) { lastClock = c; clockEl.textContent = c; }
      scrub.value = Math.round((t / T4) * 1000); scrub.style.setProperty('--p', `${(t / T4) * 100}%`);
      scene.table.rows.forEach((r) => { const el = $(`[data-r="${r.id}"]`), h = r.test(s, P); if (el.classList.contains('hot') !== h) el.classList.toggle('hot', h); });
      const tds = $('.sm-now').querySelectorAll('td'); scene.table.now(s).forEach((v, i) => { const x = fmt(v, v >= 10 ? 1 : 2); if (tds[i].textContent !== x) tds[i].textContent = x; });
    }
  }
  function frame(ts) {
    raf = 0;
    if (!alive || !root.isConnected) return stop();
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
    if (run && !holding) t = (t + dt * speed) % T4;
    if ((run && !holding) || dirty) { render(); dirty = false; }
    if (run && !holding && vis && !document.hidden) raf = requestAnimationFrame(frame); else last = 0;
  }
  function kick() { if (!raf && vis && alive) { last = 0; raf = requestAnimationFrame(frame); } }

  // ---------- Управление ----------
  const IC = { pause: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>', play: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.9l11-6.8a1 1 0 0 0 0-1.8l-11-6.8A1 1 0 0 0 8 5.2z"/></svg>' };
  const setPlay = () => { play.innerHTML = `${run ? IC.pause : IC.play}${run ? 'Пауза' : 'Пуск'}`; play.setAttribute('aria-pressed', String(run)); };
  play.addEventListener('click', () => { run = !run; setPlay(); kick(); });
  $('.sm-reset').addEventListener('click', () => { t = 0; dirty = true; kick(); });
  $$('[data-sp]').forEach((b) => b.addEventListener('click', () => { speed = +b.dataset.sp; $$('[data-sp]').forEach((x) => x.classList.toggle('on', x === b)); }));
  $$('[data-tg]').forEach((b) => b.addEventListener('click', () => { flags[b.dataset.tg] = !flags[b.dataset.tg]; b.classList.toggle('on', flags[b.dataset.tg]); b.setAttribute('aria-pressed', flags[b.dataset.tg]); dirty = true; kick(); }));
  $$('[data-pn]').forEach((b) => b.addEventListener('click', () => {
    if (on.has(b.dataset.pn)) { if (on.size === 1) return; on.delete(b.dataset.pn); } else on.add(b.dataset.pn);
    $$('[data-pn]').forEach((x) => { x.classList.toggle('on', on.has(x.dataset.pn)); x.setAttribute('aria-pressed', on.has(x.dataset.pn)); });
    layout();
  }));
  const schedule = () => { if (!relayout) relayout = requestAnimationFrame(() => { relayout = 0; relayout_(); }); };      // не чаще раза за кадр, пока тянут ползунок
  $$('[data-p]').forEach((inp) => inp.addEventListener('input', () => {
    P[inp.dataset.p] = +inp.value; d = scene.derive(P); T4 = scene.window(d); t = 0; readouts(); schedule();
  }));
  scrub.addEventListener('input', () => { t = (+scrub.value / 1000) * T4; if (run) { run = false; setPlay(); } dirty = true; kick(); });
  root.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.target.closest('input, button, select, textarea')) { e.preventDefault(); play.click(); } });

  // Грузик можно оттянуть мышью или пальцем и отпустить (сцена сама решает, что значит «оттянуть»)
  if (scene.grab) {
    let drag = null;
    box.addEventListener('pointerdown', (e) => {
      const r = box.getBoundingClientRect(), lx = ((e.clientX - r.left) / r.width) * SW, ly = ((e.clientY - r.top) / r.height) * SH;
      if (!scene.grab.hit(P, d, scene.at(P, d, t), lx, ly)) return;
      drag = e.pointerId; holding = true; box.setPointerCapture(drag); box.classList.add('grab'); e.preventDefault();
    });
    box.addEventListener('pointermove', (e) => {
      if (drag !== e.pointerId) return;
      const r = box.getBoundingClientRect(), lx = ((e.clientX - r.left) / r.width) * SW, set = scene.grab.to(P, lx);
      Object.assign(P, set); d = scene.derive(P); T4 = scene.window(d); t = 0;
      for (const k of Object.keys(set)) $(`[data-p="${k}"]`).value = P[k];
      readouts(); schedule(); dirty = true; kick();
    });
    const release = (e) => { if (drag !== e.pointerId) return; drag = null; holding = false; box.classList.remove('grab'); if (!run) { run = true; setPlay(); } kick(); };
    box.addEventListener('pointerup', release); box.addEventListener('pointercancel', release);
  }

  let rz = 0;
  const ro = new ResizeObserver(() => { if (Math.abs(box.clientWidth - lastW) < 1) return; clearTimeout(rz); rz = setTimeout(layout, 90); }); ro.observe(box);
  const io = new IntersectionObserver(([en]) => { vis = en.isIntersecting; if (vis) kick(); }); io.observe(box);
  const onVis = () => { if (!document.hidden) kick(); };
  document.addEventListener('visibilitychange', onVis);
  function stop() { alive = false; cancelAnimationFrame(raf); cancelAnimationFrame(relayout); clearTimeout(rz); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); if (current === stopFlag) current = null; }
  current = stop;

  rt = scene.mount(box, P, d);
  setPlay(); ticks(); readouts(); layout();
  return { stop };
}
