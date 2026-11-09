// Страница доски на весь экран: вход (кто открыл и чья доска), плавающие панели инструментов.
// Ссылка: /board/?s=<id ученика>. Ученик и родитель могут открыть /board/ без параметра — доска своего ученика.
import { CONFIG } from '../app/js/config.js?v=202611091414';
import { esc } from '../app/js/ui.js?v=202611091414';
import { mountBoard, COLORS, WIDTHS } from './engine.js?v=202611091414';

const root = document.getElementById('bd2');
const api = CONFIG.supabaseUrl ? (await import('../app/js/api.js?v=202611091414')).createApi(CONFIG) : (await import('../app/js/demo.js?v=202611091414')).createDemoApi();
const SID = /^[0-9a-z-]{1,64}$/i;                                // id ученика (uuid; в демо — короткий): только безопасные символы

const IC = {
  select: '<path d="M5 3l14 8-6 2-3 6z"/>',
  pen: '<path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16z"/><path d="M14 7l3 3"/>',
  marker: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  eraser: '<path d="M8 20h12"/><path d="M5.5 14.5 14 6a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11.5 18.5H8z"/><path d="M9 11l4.5 4.5"/>',
  hand: '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5m0-1V4.5a1.5 1.5 0 0 1 3 0V11m0-5.5a1.5 1.5 0 0 1 3 0V13m0-4a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1.2a6 6 0 0 1-4.6-2.2L4 15.5a1.6 1.6 0 0 1 2.4-2L8 15"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.7"/><path d="m21 16-5-5-9 9"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/>',
  down: '<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
};
const ico = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;
const msg = (html) => { root.innerHTML = `<div class="bd2-msg">${html}</div>`; };

async function start() {
  const me = await api.me().catch(() => null);
  if (!me) return msg('<b>Войдите в кабинет</b><p>Доска открывается после входа.</p><a class="btn btn-primary" href="../app/">Войти</a>');
  if (me.role === 'pending') return msg('<b>Кабинет ещё не подключён</b><a class="btn btn-primary" href="../app/">В кабинет</a>');
  const isTutor = me.role === 'tutor';

  let sid = new URLSearchParams(location.search).get('s');
  if (!sid || !SID.test(sid)) {
    if (isTutor) return msg('<b>Откройте доску из карточки ученика</b><a class="btn btn-primary" href="../app/#/students">Ученики</a>');
    const ms = await api.select('student_memberships');
    let saved = null; try { saved = sessionStorage.getItem('tutoros-child'); } catch {}
    sid = ms.find((m) => m.student_id === saved)?.student_id || ms[0]?.student_id;
    if (!sid) return msg('<b>Ученик ещё не подключён</b><a class="btn btn-primary" href="../app/">В кабинет</a>');
  }
  const st = (await api.select('students', { eq: { id: sid } }))[0];
  if (!st) return msg('<b>Нет доступа к этой доске</b><a class="btn btn-primary" href="../app/">В кабинет</a>');
  document.title = `Доска · ${st.name}`;
  const canWrite = isTutor || me.role === 'student';
  const backHref = isTutor ? `../app/#/student/${sid}` : '../app/#/';

  root.innerHTML = `
    <div class="bd2-canvas" id="bd2-c"></div>
    <header class="bd2-top bd2-l">
      <a class="bd2-b" href="${backHref}" title="В кабинет" aria-label="В кабинет">${ico('back')}</a>
      <span class="bd2-title">${esc(st.name)}</span>
    </header>
    <div class="bd2-top bd2-r">
      <span class="bd2-note" id="bd2-note" aria-live="polite"></span>
      <span class="bd2-conn" id="bd2-conn" role="img" aria-label="Связь"></span>
      <button class="bd2-b" data-a="out" title="Уменьшить (−)" aria-label="Уменьшить">${ico('minus')}</button>
      <button class="bd2-zoom" data-a="reset" title="Масштаб 100%" aria-label="Масштаб 100%" id="bd2-z">100%</button>
      <button class="bd2-b" data-a="in" title="Увеличить (+)" aria-label="Увеличить">${ico('plus')}</button>
      <button class="bd2-b" data-a="fit" title="Показать всё (0)" aria-label="Показать всё">${ico('fit')}</button>
      <button class="bd2-b bd2-wide" data-a="png" title="Скачать картинкой" aria-label="Скачать картинкой">${ico('down')}</button>
      ${isTutor ? `<button class="bd2-b bd2-wide" data-a="clear" title="Очистить доску" aria-label="Очистить доску">${ico('trash')}</button>` : ''}
    </div>
    ${canWrite ? `
    <nav class="bd2-tools" aria-label="Инструменты">
      <button class="bd2-b" data-t="select" title="Выделить и двигать (V)" aria-label="Выделить и двигать">${ico('select')}</button>
      <button class="bd2-b" data-t="pen" title="Перо (P)" aria-label="Перо">${ico('pen')}</button>
      <button class="bd2-b" data-t="marker" title="Маркер (M)" aria-label="Маркер">${ico('marker')}</button>
      <button class="bd2-b" data-t="eraser" title="Ластик (E)" aria-label="Ластик">${ico('eraser')}</button>
      <button class="bd2-b" data-t="hand" title="Двигать доску (H или пробел)" aria-label="Двигать доску">${ico('hand')}</button>
      <i class="bd2-sep"></i>
      <button class="bd2-b bd2-color" id="bd2-color" title="Цвет и толщина" aria-label="Цвет и толщина" aria-expanded="false"><span></span></button>
      <i class="bd2-sep"></i>
      <button class="bd2-b" data-a="undo" title="Отменить (Ctrl+Z, на планшете — касание двумя пальцами)" aria-label="Отменить">${ico('undo')}</button>
      <button class="bd2-b" data-a="redo" title="Повторить (Ctrl+Shift+Z)" aria-label="Повторить">${ico('redo')}</button>
      <button class="bd2-b" data-a="img" title="Картинка или скриншот (можно вставить Ctrl+V)" aria-label="Добавить картинку">${ico('image')}</button>
    </nav>
    <div class="bd2-pop" id="bd2-pop" hidden>
      <div class="bd2-colors">${COLORS.map(([c, n]) => `<button class="bd2-dot" data-c="${c}" style="--c:${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div>
      <div class="bd2-widths">${WIDTHS.map(([w, n]) => `<button class="bd2-w" data-w="${w}" title="${n}" aria-label="${n}"><i style="height:${Math.round(w / 2) + 1}px"></i></button>`).join('')}</div>
      <label class="bd2-finger"><input type="checkbox" id="bd2-finger"> Рисовать пальцем</label>
    </div>
    <div class="bd2-selbar" id="bd2-sel" hidden><span></span><button class="btn btn-danger" data-a="del">${ico('trash')} Удалить</button></div>
    <input type="file" id="bd2-file" accept="image/*" hidden>` : '<div class="bd2-ro">Только просмотр</div>'}`;

  const B = await mountBoard(document.getElementById('bd2-c'), { api, studentId: sid, canWrite, isTutor });
  const $ = (s) => root.querySelector(s), $$ = (s) => [...root.querySelectorAll(s)];
  const pop = $('#bd2-pop');

  const sync = () => {
    const s = B.state;
    $$('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === s.tool));
    $$('[data-c]').forEach((b) => b.classList.toggle('on', b.dataset.c === s.color));
    $$('[data-w]').forEach((b) => b.classList.toggle('on', +b.dataset.w === s.width));
    const cb = $('#bd2-color'); if (cb) cb.style.setProperty('--c', s.color);
    const f = $('#bd2-finger'); if (f) f.checked = s.fingerDraw;
    const u = $('[data-a="undo"]'), r = $('[data-a="redo"]'); if (u) u.disabled = !s.canUndo; if (r) r.disabled = !s.canRedo;
    $('#bd2-z').textContent = `${Math.round(s.zoom * 100)}%`;
    const sb = $('#bd2-sel'); if (sb) { sb.hidden = !s.selected; sb.querySelector('span').textContent = `Выделено: ${s.selected}`; }
    const n = $('#bd2-note'); n.textContent = s.status.text; n.dataset.s = s.status.s;
    const c = $('#bd2-conn'); c.classList.toggle('ok', s.online); c.title = s.online ? 'На связи: изменения видны сразу' : 'Связь восстанавливается';
  };
  B.onChange(sync); sync();

  const showPop = (on) => { if (!pop) return; pop.hidden = !on; $('#bd2-color').setAttribute('aria-expanded', on); };
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-t]'); if (t) { B.setTool(t.dataset.t); showPop(false); return; }
    const c = e.target.closest('[data-c]'); if (c) { B.setColor(c.dataset.c); return; }
    const w = e.target.closest('[data-w]'); if (w) { B.setWidth(+w.dataset.w); return; }
    if (e.target.closest('#bd2-color')) { showPop(pop.hidden); return; }
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) { if (pop && !pop.hidden && !e.target.closest('#bd2-pop')) showPop(false); return; }
    ({ undo: B.undo, redo: B.redo, del: B.deleteSel, fit: B.fit, in: B.zoomIn, out: B.zoomOut, reset: B.zoomReset, png: B.exportPng, clear: B.clearAll,
       img: () => $('#bd2-file').click() })[a]?.();
  });
  $('#bd2-finger')?.addEventListener('change', (e) => B.setFinger(e.target.checked));
  $('#bd2-file')?.addEventListener('change', (e) => { [...e.target.files].forEach(B.addImage); e.target.value = ''; });
  root.addEventListener('pointerdown', (e) => { if (pop && !pop.hidden && !e.target.closest('#bd2-pop, #bd2-color')) showPop(false); });
}

start().catch((e) => msg(`<b>Не удалось открыть доску</b><p>${esc(e.message)}</p><a class="btn btn-primary" href="../app/">В кабинет</a>`));
