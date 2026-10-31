// Интерфейс «свободных» сцен, где важен не ход времени, а состояние: атом и ядро, линза, электрическая цепь, приборы.
// Слева сцена, справа карточка «состояние» (её текст формирует сцена), ниже кнопки действий (распад, примеры), параметры, итоги и формулы.
// Анимация (например, вылет частицы) идёт по реальному времени; если ничего не происходит, ничего не рисуется.
import { fmt, math, ready } from './tex.js?v=202611010126';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let current = null;

export async function mountFree(root, scene, { mode = 'cabinet' } = {}) {
  current?.();
  let alive = true; const stopFlag = () => { alive = false; }; current = stopFlag;
  await ready();
  if (!alive || !root.isConnected) return;

  const P = Object.fromEntries(scene.params.map((q) => [q.id, q.def]));
  const state = { log: [] }, flags = Object.fromEntries((scene.toggles || []).map((q) => [q.id, !!q.on]));
  let d = scene.derive(P), t = 0, raf = 0, last = 0, vis = true, dirty = true, busy = false, rt = null, lastW = 0, rz = 0, timer = 0;
  const { w: SW, h: SH } = scene.stage;
  const groups = [...new Set((scene.actions || []).map((a) => a.group))];

  root.innerHTML = `
  <div class="sm sm-free sm-${mode}">
    <section class="sm-card sm-fig">
      <div class="sm-split">
        <div class="sm-stagebox" style="--ar:${((SH / SW) * 100).toFixed(2)}%"></div>
        <div class="sm-gbox sm-info"><div class="sm-info-in"></div></div>
      </div>
      ${groups.length ? `<div class="sm-acts">${groups.map((g) => `<div class="sm-actgrp"><small>${esc(g)}</small><span class="sm-actbtns">${scene.actions.filter((a) => a.group === g).map((a) => `<button type="button" class="sm-abtn" data-act="${a.id}" style="--c:${a.color || 'var(--sm-acc)'}">${a.label}</button>`).join('')}</span></div>`).join('')}</div>` : ''}
      ${(scene.toggles || []).length ? `<div class="sm-btns"><span class="sm-tog" role="group">${scene.toggles.map((q) => `<button type="button" data-tg="${q.id}" style="--c:${q.color}" class="${q.on ? 'on' : ''}" aria-pressed="${!!q.on}"><i></i>${esc(q.name)}</button>`).join('')}</span></div>` : ''}
    </section>
    <div class="sm-trio">
      <section class="sm-card"><h3>Параметры</h3>
        ${scene.params.map((q) => (q.options
          ? `<div class="sm-par"><span class="sm-par-h"><span>${esc(q.name)} ${math(q.tex)}</span><output data-o="${q.id}"></output></span>
              <span class="sm-seg sm-opts" role="group" aria-label="${esc(q.name)}">${q.options.map((o) => `<button type="button" data-po="${q.id}" data-v="${o.v}">${esc(o.label)}</button>`).join('')}</span></div>`
          : `<label class="sm-par"><span class="sm-par-h"><span>${esc(q.name)} ${math(q.tex)}</span><output data-o="${q.id}"></output></span>
              <input type="range" data-p="${q.id}" min="${q.min}" max="${q.max}" step="${q.step}" value="${q.def}" aria-label="${esc(q.name)}"></label>`)).join('')}
      </section>
      <section class="sm-card"><h3>${esc(scene.resultTitle || 'Что получается')}</h3><dl class="sm-out"></dl>${scene.note ? `<p class="sm-note">${scene.note}</p>` : ''}</section>
      <section class="sm-card sm-formulas"><h3>Формулы</h3><div class="sm-fr">${scene.formulas.map((f) => `<div class="sm-fm"><small><i style="background:${f.color}"></i>${esc(f.tag)}</small><div class="sm-f">${math(f.tex, true)}</div></div>`).join('')}</div></section>
      ${scene.extra ? `<section class="sm-card sm-extra">${scene.extra}</section>` : ''}
    </div>
  </div>`;
  const $ = (s) => root.querySelector(s), $$ = (s) => [...root.querySelectorAll(s)];
  const box = $('.sm-stagebox'), infoEl = $('.sm-info-in'), out = $('.sm-out');

  function readouts() {
    $$('[data-o]').forEach((o) => {
      const q = scene.params.find((x) => x.id === o.dataset.o); o.innerHTML = `${q.fmt ? q.fmt(P[q.id], P, d) : fmt(P[q.id], q.dec)} <small>${esc(q.unit)}</small>`;
      if (q.options) $$(`[data-po="${q.id}"]`).forEach((b) => b.classList.toggle('on', +b.dataset.v === P[q.id]));
      else { const inp = $(`[data-p="${q.id}"]`); inp.style.setProperty('--p', `${((P[q.id] - q.min) / (q.max - q.min)) * 100}%`); }
    });
    out.innerHTML = scene.readouts(P, d).map(([n, s, v]) => `<div><dt>${esc(n)} ${s ? math(s) : ''}</dt><dd>${v}</dd></div>`).join('');
    infoEl.innerHTML = scene.info(P, d, state);
  }
  function layout() { if (!alive) return; rt.resize(); rt.params(P, d); lastW = box.clientWidth; dirty = true; kick(); }
  function changed() { d = scene.derive(P); readouts(); rt.params(P, d); dirty = true; kick(); }

  function frame(ts) {
    raf = 0;
    if (!alive || !root.isConnected) return stop();
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts; t += dt;
    if (scene.animated || dirty || rt.busy?.()) { rt.update(d, flags, t, P); dirty = false; }
    if ((scene.animated || rt.busy?.()) && vis && !document.hidden) raf = requestAnimationFrame(frame); else last = 0;
  }
  function kick() { if (!raf && vis && alive) { last = 0; raf = requestAnimationFrame(frame); } }

  $$('[data-tg]').forEach((b) => b.addEventListener('click', () => { flags[b.dataset.tg] = !flags[b.dataset.tg]; b.classList.toggle('on', flags[b.dataset.tg]); b.setAttribute('aria-pressed', flags[b.dataset.tg]); dirty = true; kick(); }));
  $$('[data-p]').forEach((inp) => inp.addEventListener('input', () => { P[inp.dataset.p] = +inp.value; changed(); }));
  $$('[data-po]').forEach((b) => b.addEventListener('click', () => { P[b.dataset.po] = +b.dataset.v; changed(); }));
  const lock = (on) => $$('.sm-abtn').forEach((b) => { b.disabled = on; });
  $$('.sm-abtn').forEach((b) => b.addEventListener('click', () => {
    if (busy) return;
    const r = scene.act(b.dataset.act, P, d, state); if (!r) return;
    const apply = () => {
      if (r.log) state.log.unshift(r.log); state.log.length = Math.min(state.log.length, 6);
      Object.assign(P, r.set || {}); for (const k of Object.keys(r.set || {})) { const inp = $(`[data-p="${k}"]`); if (inp) inp.value = P[k]; }
      busy = false; lock(false); changed();
    };
    if (r.anim) { busy = true; lock(true); rt.animate(r.anim, t, P, d); dirty = true; kick(); timer = setTimeout(apply, scene.animMs || 1000); } else apply();
  }));
  root.addEventListener('keydown', () => {});

  const ro = new ResizeObserver(() => { if (Math.abs(box.clientWidth - lastW) < 1) return; clearTimeout(rz); rz = setTimeout(layout, 90); }); ro.observe(box);
  const io = new IntersectionObserver(([en]) => { vis = en.isIntersecting; if (vis) kick(); }); io.observe(box);
  const onVis = () => { if (!document.hidden) kick(); };
  document.addEventListener('visibilitychange', onVis);
  function stop() { alive = false; cancelAnimationFrame(raf); clearTimeout(rz); clearTimeout(timer); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); if (current === stopFlag || current === stop) current = null; }
  current = stop;

  rt = scene.mount(box, P, d);
  readouts(); layout();
  return { stop };
}
