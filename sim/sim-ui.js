// Общий интерфейс песочницы: сцена, графики, шкала времени, ползунки параметров, таблица «Положения», формулы.
// Один и тот же модуль работает на открытой странице и в кабинете. Сцену описывает отдельный файл (spring.js).
// Плавность: кадры считаются по реальному времени (не по числу кадров); на паузе и вне экрана ничего не рисуется;
// неподвижный фон сцены и графиков лежит в готовых слоях, поэтому кадр — это несколько быстрых копирований.
import { layer, fitCanvas, fmt, tex } from './tex.js?v=202610311416';
import { Graphs } from './graph.js?v=202610311416';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sym = (s) => esc(s).replace(/^([A-Za-zα-ωφ])_?(\w*)$/, (_, a, b) => `<i>${a}</i>${b ? `<sub>${b}</sub>` : ''}`);
const symTex = (s) => s.replace(/_\{([^}]+)\}|_(\w+)/g, (_, a, b) => `<sub>${a || b}</sub>`).replace(/^[A-Za-z]/, (c) => `<i>${c}</i>`);

let current = null;                                           // прошлая сцена на странице закрывается при открытии новой

export function mountSim(root, scene, { mode = 'cabinet' } = {}) {
  current?.();
  const P = Object.fromEntries(scene.params.map((q) => [q.id, q.def]));
  let d = scene.derive(P), T4 = scene.window(d), t = 0, speed = 0.5, run = true, dirty = true, raf = 0, last = 0, vis = true, tick = 0, lastRows = 0;
  const flags = Object.fromEntries(scene.toggles.map((q) => [q.id, false]));
  const on = new Set(scene.panels.filter((q) => q.on).map((q) => q.id));

  root.innerHTML = `
  <div class="sm sm-${mode}">
    <div class="sm-grid">
      <div class="sm-main">
        <section class="sm-card sm-stage-card"><canvas class="sm-stage" role="img" aria-label="${esc(scene.stage.label)}"></canvas></section>
        <section class="sm-card sm-ctl" aria-label="Управление временем">
          <input type="range" class="sm-scrub" min="0" max="1000" value="0" aria-label="Момент времени">
          <div class="sm-ticks"></div>
          <div class="sm-btns">
            <button class="sm-btn sm-play" type="button"></button>
            <button class="sm-btn sm-ghost sm-reset" type="button" aria-label="В начало">Сброс</button>
            <span class="sm-seg" role="group" aria-label="Скорость">${[0.25, 0.5, 1].map((v) => `<button type="button" data-sp="${v}" class="${v === speed ? 'on' : ''}">${String(v).replace('.', ',')}×</button>`).join('')}</span>
            <span class="sm-tog" role="group" aria-label="Показать векторы">${scene.toggles.map((q) => `<button type="button" data-tg="${q.id}" style="--c:${q.color}" aria-pressed="false">${esc(q.name)}</button>`).join('')}</span>
          </div>
        </section>
        <section class="sm-card sm-graphs-card">
          <div class="sm-chips" role="group" aria-label="Графики">${scene.panels.map((q) => `<button type="button" data-pn="${q.id}" class="${on.has(q.id) ? 'on' : ''}" aria-pressed="${on.has(q.id)}">${symTex(q.name)}</button>`).join('')}</div>
          <canvas class="sm-graph" role="img" aria-label="Графики величин от времени"></canvas>
        </section>
      </div>
      <aside class="sm-side">
        <section class="sm-card"><h3>Параметры</h3>
          ${scene.params.map((q) => `<label class="sm-par"><span class="sm-par-h"><span>${esc(q.name)} ${sym(q.sym)}</span><output data-o="${q.id}"></output></span>
            <input type="range" data-p="${q.id}" min="${q.min}" max="${q.max}" step="${q.step}" value="${q.def}" aria-label="${esc(q.name)}"></label>`).join('')}
        </section>
        <section class="sm-card"><h3>Положения</h3>
          <table class="sm-tab"><thead><tr><th></th>${scene.table.cols.map((c, i) => `<th>${symTex(c)}<small>${esc(scene.table.units[i])}</small></th>`).join('')}</tr></thead>
            <tbody>${scene.table.rows.map((r) => `<tr data-r="${r.id}"><th>${esc(r.name)}</th>${scene.table.cols.map(() => '<td></td>').join('')}</tr>`).join('')}
              <tr class="sm-now"><th>Сейчас</th>${scene.table.cols.map(() => '<td></td>').join('')}</tr></tbody></table>
          <p class="sm-note">Строка подсвечивается, когда груз проходит это положение. На графиках такие моменты отмечены вертикалями того же цвета: оранжевые — крайнее положение, синие — равновесие.</p>
        </section>
        <section class="sm-card"><h3>Что получается</h3><dl class="sm-out"></dl></section>
      </aside>
    </div>
    <section class="sm-card sm-formulas"><h3>Формулы</h3><div class="sm-fr">${scene.formulas.map((f) => `<div><small>${esc(f.tag)}</small><span class="sm-f">${f.html}</span></div>`).join('')}</div></section>
  </div>`;
  const $ = (s) => root.querySelector(s), $$ = (s) => [...root.querySelectorAll(s)];
  const stage = $('.sm-stage'), gcv = $('.sm-graph'), scrub = $('.sm-scrub'), play = $('.sm-play'), out = $('.sm-out');
  const graphs = new Graphs(gcv);
  let sctx, sbase;

  // ---------- Пересборка слоёв (размер окна, параметры) ----------
  const S_ = { at: (tt) => scene.at(P, d, tt), get d() { return d; } };
  function layout() {
    const fs = scene.fit ? scene.fit(stage.clientWidth || scene.stage.w) : 1;
    sctx = fitCanvas(stage, scene.stage.w, scene.stage.h);
    sbase = layer(stage); const bc = sbase.getContext('2d'); bc.setTransform(stage.width / scene.stage.w, 0, 0, stage.height / scene.stage.h, 0, 0);
    scene.drawStatic(bc, P, d);
    const panels = scene.panels.filter((q) => on.has(q.id)).map((q) => ({ label: q.label, unit: q.unit, signed: q.signed, max: q.max(P, d), curves: q.curves(S_).map((c) => ({ ...c })) }));
    graphs.setup({ panels, T: T4, period: d.T, marks: scene.marks(P, d, T4) });
    if (!panels.length) { gcv.style.height = '0'; }
    dirty = true; kick();
  }
  function readouts() {
    $$('[data-o]').forEach((o) => { const q = scene.params.find((x) => x.id === o.dataset.o); o.innerHTML = `${fmt(P[q.id], q.dec)} <small>${esc(q.unit)}</small>`; });
    out.innerHTML = scene.readouts(P, d).map(([n, s, v]) => `<div><dt>${esc(n)} ${symTex(s)}</dt><dd>${v}</dd></div>`).join('');
    scene.table.rows.forEach((r) => { const tds = $(`[data-r="${r.id}"]`).querySelectorAll('td'); r.vals(P, d).forEach((v, i) => { tds[i].textContent = fmt(v, v >= 10 ? 1 : 2); }); });
  }
  function ticks() {
    $('.sm-ticks').innerHTML = [1, 2, 3, 4].map((k) => `<span style="left:${(k / 4) * 100}%">${k === 1 ? '<i>T</i>' : `${k}<i>T</i>`}</span>`).join('');
  }

  // ---------- Кадр ----------
  function render() {
    const s = scene.at(P, d, t);
    sctx.save(); sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.drawImage(sbase, 0, 0); sctx.restore();
    scene.drawDynamic(sctx, P, d, s, t, flags);
    graphs.draw(t);
    const now = performance.now();
    if (now - lastRows > 70) {                              // таблицу и шкалу обновляем реже, чем рисуем
      lastRows = now;
      scrub.value = Math.round((t / T4) * 1000);
      scene.table.rows.forEach((r) => $(`[data-r="${r.id}"]`).classList.toggle('hot', r.test(s, P)));
      const tds = $('.sm-now').querySelectorAll('td'); scene.table.now(s).forEach((v, i) => { tds[i].textContent = fmt(v, v >= 10 ? 1 : 2); });
    }
  }
  function frame(ts) {
    raf = 0;
    if (!root.isConnected) return stop();
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
    if (run) t = (t + dt * speed) % T4;
    if (run || dirty) { render(); dirty = false; }
    if (run && vis && !document.hidden) raf = requestAnimationFrame(frame); else last = 0;
  }
  function kick() { if (!raf && vis) { last = 0; raf = requestAnimationFrame(frame); } }

  // ---------- Управление ----------
  const setPlay = () => { play.innerHTML = run ? '<span class="sm-ic">❚❚</span> Пауза' : '<span class="sm-ic">▶</span> Пуск'; play.setAttribute('aria-pressed', String(run)); };
  play.addEventListener('click', () => { run = !run; setPlay(); kick(); });
  $('.sm-reset').addEventListener('click', () => { t = 0; dirty = true; kick(); });
  $$('[data-sp]').forEach((b) => b.addEventListener('click', () => { speed = +b.dataset.sp; $$('[data-sp]').forEach((x) => x.classList.toggle('on', x === b)); }));
  $$('[data-tg]').forEach((b) => b.addEventListener('click', () => { flags[b.dataset.tg] = !flags[b.dataset.tg]; b.classList.toggle('on', flags[b.dataset.tg]); b.setAttribute('aria-pressed', flags[b.dataset.tg]); dirty = true; kick(); }));
  $$('[data-pn]').forEach((b) => b.addEventListener('click', () => {
    if (on.has(b.dataset.pn)) { if (on.size === 1) return; on.delete(b.dataset.pn); } else on.add(b.dataset.pn);
    $$('[data-pn]').forEach((x) => { x.classList.toggle('on', on.has(x.dataset.pn)); x.setAttribute('aria-pressed', on.has(x.dataset.pn)); });
    layout();
  }));
  let relayout = 0;
  $$('[data-p]').forEach((inp) => inp.addEventListener('input', () => {
    P[inp.dataset.p] = +inp.value; d = scene.derive(P); T4 = scene.window(d); t = 0; readouts();
    if (!relayout) relayout = requestAnimationFrame(() => { relayout = 0; layout(); });   // не чаще раза за кадр, пока тянут ползунок
  }));
  scrub.addEventListener('input', () => { t = (+scrub.value / 1000) * T4; if (run) { run = false; setPlay(); } dirty = true; kick(); });
  root.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.target.closest('input, button, select, textarea')) { e.preventDefault(); play.click(); }
  });

  const ro = new ResizeObserver(() => { layout(); }); ro.observe(stage);
  const io = new IntersectionObserver(([en]) => { vis = en.isIntersecting; if (vis) kick(); }); io.observe(stage);
  const onVis = () => { if (!document.hidden) kick(); };
  document.addEventListener('visibilitychange', onVis);
  function stop() { cancelAnimationFrame(raf); cancelAnimationFrame(relayout); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); if (current === stop) current = null; }
  current = stop;

  setPlay(); ticks(); readouts(); layout();
  return { stop };
}
