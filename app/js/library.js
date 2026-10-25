// Библиотека материалов: загрузка пачкой, выбор, выдача ученикам, прикрепление к урокам и ДЗ
import { h, mount, $, $$, I, toast, modal, confirmDialog, plural, empty, SUBJECTS, safeFileName, pageHero } from './ui.js?v=202610251033';

const MAX = 20 * 1024 * 1024;
const baseName = (n) => n.replace(/\.[^.]+$/, '');
export const fmtSize = (b) => (!b ? '' : b >= 1048576 ? `${(b / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(b / 1024))} КБ`);
const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
const files = (v) => [].concat(v ?? []).filter((f) => f instanceof File && f.size);

export async function openFile(api, path) {
  const w = window.open('', '_blank');
  try { const url = await api.fileUrl(path); if (w) w.location = url; else location.href = url; }
  catch (e) { w?.close(); toast(e.message, 'error'); }
}

// Загрузить файлы прямо ученику (к уроку, к ДЗ или в общие материалы)
export async function uploadForStudent(api, studentId, list, extra = {}) {
  for (const f of files(list)) {
    if (f.size > MAX) { toast(`«${f.name}» больше 20 МБ — пропущен`, 'error'); continue; }
    const path = `${studentId}/materials/${safeFileName(f)}`;
    await api.upload(path, f);
    await api.insert('materials', {
      student_id: studentId, title: extra.title || baseName(f.name), file_path: path,
      homework_id: extra.homework_id || null, lesson_id: extra.lesson_id || null,
      subject: extra.subject || null, topic: extra.topic || null,
    });
  }
}

// Выдать элементы библиотеки ученику (без повторной загрузки файла)
export async function attachItems(api, studentId, items, extra = {}) {
  for (const it of items) {
    await api.insert('materials', {
      student_id: studentId, library_item_id: it.id, subject: it.subject, topic: it.topic || null,
      title: it.title, file_path: it.file_path || null, url: it.url || null,
      homework_id: extra.homework_id || null, lesson_id: extra.lesson_id || null,
    });
  }
}

// ---------- Окно выбора из библиотеки. Возвращает Promise<items[]> ----------
export function pickFromLibrary(api, { subject = '' } = {}) {
  return new Promise((resolve) => {
    let done = false, items = [];
    const chosen = new Set();
    const m = modal({
      title: 'Выбрать из библиотеки', wide: true, submit: 'Прикрепить',
      body: h`
        <div class="toolbar">
          <input type="search" class="lib-q" placeholder="Поиск по названию или теме" aria-label="Поиск">
          <select class="lib-s" aria-label="Предмет"><option value="">Все предметы</option>
            ${SUBJECTS.map((s) => h`<option ${s === subject ? 'selected' : ''}>${s}</option>`)}</select>
        </div>
        <div class="lib-pick"><div class="loading-block"><span class="spin"></span></div></div>
        <p class="hint lib-count">Ничего не выбрано</p>`,
      onSubmit: async () => {
        if (!chosen.size) throw new Error('Отметьте хотя бы один файл');
        done = true; resolve(items.filter((i) => chosen.has(i.id)));
      },
    });
    m.el.addEventListener('close', () => { if (!done) resolve([]); });
    const box = $('.lib-pick', m.el), q = $('.lib-q', m.el), s = $('.lib-s', m.el);
    const render = () => {
      const text = q.value.trim().toLowerCase();
      const list = items.filter((i) => (!s.value || i.subject === s.value)
        && (!text || `${i.title} ${i.topic}`.toLowerCase().includes(text)));
      if (!items.length) return mount(box, empty('Библиотека пуста. Загрузите файлы в разделе «Библиотека».', I.folder));
      if (!list.length) return mount(box, empty('Ничего не найдено', I.folder));
      mount(box, h`${groupByTopic(list).map(([topic, rows]) => h`
        <div class="lib-group">${topic || 'Без темы'}</div>
        ${rows.map((i) => h`<label class="lib-row">
          <input type="checkbox" value="${i.id}" ${chosen.has(i.id) ? 'checked' : ''}>
          <span class="item-icon">${i.file_path ? I.file : I.link}</span>
          <span class="item-main"><span class="item-title">${i.title}</span>
            <span class="item-meta">${i.subject}${i.size_bytes ? ` · ${fmtSize(i.size_bytes)}` : ''}</span></span></label>`)}`)}`);
      $$('input[type=checkbox]', box).forEach((c) => c.addEventListener('change', () => {
        c.checked ? chosen.add(c.value) : chosen.delete(c.value);
        $('.lib-count', m.el).textContent = chosen.size ? `Выбрано: ${plural(chosen.size, 'файл', 'файла', 'файлов')}` : 'Ничего не выбрано';
      }));
    };
    q.addEventListener('input', render); s.addEventListener('change', render);
    api.select('library_items', { order: 'title' }).then((r) => { items = r; render(); })
      .catch((e) => mount(box, empty(e.message, I.folder)));
  });
}

function groupByTopic(list) {
  const map = new Map();
  for (const i of [...list].sort((a, b) => (a.topic || '￿').localeCompare(b.topic || '￿', 'ru'))) {
    if (!map.has(i.topic || '')) map.set(i.topic || '', []);
    map.get(i.topic || '').push(i);
  }
  return [...map];
}

// Кнопка «Из библиотеки» внутри формы: показывает выбранные файлы чипами
export function libraryField(api, m, { subject } = {}) {
  const picked = [];
  const wrap = $('.lib-field', m.el);
  const draw = () => mount($('.lib-chips', wrap), h`${picked.map((i, n) => h`
    <span class="lib-chip">${I.file}<span>${i.title}</span><button type="button" data-unpick="${n}" aria-label="Убрать">✕</button></span>`)}`);
  $('.lib-add', wrap).addEventListener('click', async () => {
    const sel = await pickFromLibrary(api, { subject: typeof subject === 'function' ? subject() : subject });
    for (const i of sel) if (!picked.some((p) => p.id === i.id)) picked.push(i);
    draw();
  });
  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('[data-unpick]');
    if (b) { picked.splice(+b.dataset.unpick, 1); draw(); }
  });
  return picked;
}
export const libraryFieldHtml = (label = 'Файлы из библиотеки') => h`
  <div class="field lib-field"><span>${label}</span>
    <div class="lib-chips"></div>
    <button type="button" class="btn btn-soft btn-sm lib-add">${I.folder} Выбрать из библиотеки</button></div>`;

// ============================================================
// Страница «Библиотека»
// ============================================================

function uploadForm(ctx, topics, preset = {}) {
  const m = modal({
    title: 'Загрузить в библиотеку', submit: 'Загрузить',
    body: h`
      <div class="row-2">
        <label class="field"><span>Предмет</span><select name="subject">${SUBJECTS.map((s) => h`<option ${s === preset.subject ? 'selected' : ''}>${s}</option>`)}</select></label>
        <label class="field"><span>Тема</span><input name="topic" list="lib-topics" value="${preset.topic || ''}" placeholder="Например: Механика">
          <datalist id="lib-topics">${topics.map((t) => h`<option value="${t}">`)}</datalist></label>
      </div>
      <label class="dropzone"><input type="file" name="files" multiple accept=".pdf,image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx">
        ${I.file}<b>Выберите файлы или перетащите сюда</b><span class="hint">Можно сразу много. PDF, картинки, Word, PowerPoint — до 20 МБ каждый</span>
        <span class="drop-list"></span></label>
      <div class="divider"><span>или ссылка</span></div>
      <div class="row-2">
        <label class="field"><span>Ссылка</span><input type="url" name="url" placeholder="https://"></label>
        <label class="field"><span>Название ссылки</span><input name="url_title"></label>
      </div>
      <p class="hint upload-progress"></p>`,
    onSubmit: async (d) => {
      const list = files(d.files);
      if (!list.length && !d.url) throw new Error('Выберите файлы или вставьте ссылку');
      const prog = $('.upload-progress', m.el);
      let n = 0;
      for (const f of list) {
        if (f.size > MAX) { toast(`«${f.name}» больше 20 МБ — пропущен`, 'error'); continue; }
        prog.textContent = `Загружаю ${++n} из ${list.length}: ${f.name}`;
        const path = `library/${safeFileName(f)}`;
        await ctx.api.upload(path, f);
        await ctx.api.insert('library_items', { subject: d.subject, topic: d.topic || '', title: baseName(f.name), file_path: path, size_bytes: f.size });
      }
      if (d.url) await ctx.api.insert('library_items', { subject: d.subject, topic: d.topic || '', title: d.url_title || d.url, url: d.url });
      toast(`Добавлено: ${plural(n + (d.url ? 1 : 0), 'материал', 'материала', 'материалов')}`); ctx.refresh();
    },
  });
  const input = $('input[type=file]', m.el), zone = $('.dropzone', m.el);
  const show = () => mount($('.drop-list', m.el), h`${[...input.files].map((f) => h`<span>${f.name}</span>`)}`);
  input.addEventListener('change', show);
  ['dragover', 'dragenter'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, () => zone.classList.remove('over')));
  zone.addEventListener('drop', (e) => { e.preventDefault(); input.files = e.dataTransfer.files; show(); });
}

function editForm(ctx, it, topics) {
  modal({
    title: 'Изменить материал',
    body: h`
      <label class="field"><span>Название</span><input name="title" required value="${it.title}"></label>
      <div class="row-2">
        <label class="field"><span>Предмет</span><select name="subject">${SUBJECTS.map((s) => h`<option ${s === it.subject ? 'selected' : ''}>${s}</option>`)}</select></label>
        <label class="field"><span>Тема</span><input name="topic" list="lib-topics2" value="${it.topic}"><datalist id="lib-topics2">${topics.map((t) => h`<option value="${t}">`)}</datalist></label>
      </div>`,
    onSubmit: async (d) => {
      const patch = { title: d.title, subject: d.subject, topic: d.topic || '' };
      await ctx.api.update('library_items', it.id, patch);
      const copies = await ctx.api.select('materials', { eq: { library_item_id: it.id } });
      for (const c of copies) await ctx.api.update('materials', c.id, patch);
      toast('Сохранено'); ctx.refresh();
    },
  });
}

// Выдать выбранные материалы ученикам
async function shareForm(ctx, items) {
  const [students, mats] = await Promise.all([
    ctx.api.select('students', { eq: { status: 'active' }, order: 'name' }),
    ctx.api.select('materials', { eq: { library_item_id: items.map((i) => i.id) } }),
  ]);
  const has = new Set(mats.filter((m) => !m.homework_id && !m.lesson_id).map((m) => `${m.student_id}:${m.library_item_id}`));
  const subjects = [...new Set(items.map((i) => i.subject))];
  const m = modal({
    title: `Выдать: ${plural(items.length, 'материал', 'материала', 'материалов')}`, submit: 'Выдать',
    body: students.length ? h`
      <div class="chips">${subjects.map((s) => h`<button type="button" class="btn btn-soft btn-sm" data-all="${s}">Все, кто учит: ${s}</button>`)}</div>
      <div class="lib-pick">${students.map((s) => h`<label class="lib-row">
        <input type="checkbox" name="sid" value="${s.id}">
        <span class="avatar">${s.name[0]}</span>
        <span class="item-main"><span class="item-title">${s.name}</span><span class="item-meta">${s.subjects.join(', ')}</span></span></label>`)}</div>
      <p class="hint">Ученик увидит материалы в разделе «Материалы». Уже выданные повторно не добавятся.</p>`
      : empty('Нет активных учеников', I.users),
    onSubmit: async (d) => {
      const ids = [].concat(d.sid ?? []);
      if (!ids.length) throw new Error('Выберите учеников');
      let n = 0;
      for (const sid of ids) {
        const fresh = items.filter((i) => !has.has(`${sid}:${i.id}`));
        await attachItems(ctx.api, sid, fresh); n += fresh.length;
      }
      toast(n ? `Выдано: ${plural(ids.length, 'ученику', 'ученикам', 'ученикам')}` : 'У этих учеников уже есть эти материалы');
      ctx.refresh();
    },
  });
  $$('[data-all]', m.el).forEach((b) => b.addEventListener('click', () => {
    const sub = b.dataset.all;
    $$('input[name=sid]', m.el).forEach((c) => { if (students.find((s) => s.id === c.value)?.subjects.includes(sub)) c.checked = true; });
  }));
}

export async function libraryPage(view, _p, ctx) {
  const { api } = ctx;
  const [items, shared] = await Promise.all([
    api.select('library_items', { order: 'title' }),
    api.select('materials', { order: 'created_at' }),
  ]);
  const usage = {};
  for (const m of shared) if (m.library_item_id) (usage[m.library_item_id] ||= new Set()).add(m.student_id);
  const topics = [...new Set(items.map((i) => i.topic).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
  const I_ = byId(items);
  const sel = new Set();
  let subj = '';

  mount(view, h`
    ${pageHero({ eyebrow: 'Библиотека', title: 'Мои ', accent: 'материалы', sub: `${plural(items.length, 'файл', 'файла', 'файлов')} — загрузите один раз и выдавайте любым ученикам`,
      actions: h`<button class="btn btn-primary" id="up">${I.plus}<span>Загрузить</span></button>` })}
    <div class="toolbar">
      <div class="seg seg-inline lib-subj">${['', ...SUBJECTS].map((s) => h`<button type="button" data-subj="${s}" class="${s === subj ? 'on' : ''}">${s || 'Все'}</button>`)}</div>
      <input type="search" id="q" placeholder="Поиск по названию или теме" aria-label="Поиск">
    </div>
    <div id="lib"></div>
    <div class="select-bar" id="bar" hidden>
      <span id="bar-n"></span>
      <button class="btn btn-primary btn-sm" id="bar-share">${I.users} Выдать ученикам</button>
      <button class="btn btn-ghost btn-sm" id="bar-clear">Снять выбор</button>
    </div>`);

  const bar = () => {
    $('#bar', view).hidden = !sel.size;
    $('#bar-n', view).textContent = `Выбрано: ${sel.size}`;
  };
  const render = () => {
    const text = $('#q', view).value.trim().toLowerCase();
    const list = items.filter((i) => (!subj || i.subject === subj) && (!text || `${i.title} ${i.topic}`.toLowerCase().includes(text)));
    const box = $('#lib', view);
    if (!list.length) {
      mount(box, items.length ? empty('Ничего не найдено', I.folder) : h`<div class="card">${empty('Загрузите первые материалы — PDF, презентации, ссылки', I.folder)}
        <button class="btn btn-soft btn-block" data-up2>${I.plus} Загрузить файлы</button></div>`);
      $('[data-up2]', box)?.addEventListener('click', () => uploadForm(ctx, topics));
      return;
    }
    const bySubj = SUBJECTS.filter((s) => list.some((i) => i.subject === s));
    mount(box, h`${bySubj.map((s) => h`
      <section class="card lib-card"><div class="card-head"><h2>${s}</h2>
        <span class="muted small">${plural(list.filter((i) => i.subject === s).length, 'файл', 'файла', 'файлов')}</span></div>
      ${groupByTopic(list.filter((i) => i.subject === s)).map(([topic, rows]) => h`
        <div class="lib-group"><span>${topic || 'Без темы'}</span>
          <button class="link-btn" data-seltopic="${s}|${topic}">выбрать все</button>
          <button class="link-btn" data-addto="${s}|${topic}">+ добавить</button></div>
        <div class="list">${rows.map((i) => h`
          <div class="item lib-item ${sel.has(i.id) ? 'selected' : ''}">
            <input type="checkbox" class="lib-check" data-sel="${i.id}" ${sel.has(i.id) ? 'checked' : ''} aria-label="Выбрать">
            <span class="item-icon">${i.file_path ? I.file : I.link}</span>
            <div class="item-main"><div class="item-title">${i.title}</div>
              <div class="item-meta">${i.size_bytes ? fmtSize(i.size_bytes) + ' · ' : ''}${usage[i.id]?.size ? `выдано ${plural(usage[i.id].size, 'ученику', 'ученикам', 'ученикам')}` : 'ещё не выдано'}</div></div>
            <div class="actions">
              ${i.file_path ? h`<button class="btn btn-ghost btn-sm" data-open="${i.file_path}">Открыть</button>` : h`<a class="btn btn-ghost btn-sm" href="${i.url}" target="_blank" rel="noopener noreferrer">Открыть</a>`}
              <button class="btn btn-soft btn-sm" data-share="${i.id}">Выдать</button>
              <button class="icon-btn" data-edit="${i.id}" aria-label="Изменить">${I.settings}</button>
              <button class="icon-btn" data-ldel="${i.id}" aria-label="Удалить">${I.trash}</button>
            </div></div>`)}</div>`)}
      </section>`)}`);

    $$('[data-sel]', box).forEach((c) => c.addEventListener('change', () => {
      c.checked ? sel.add(c.dataset.sel) : sel.delete(c.dataset.sel);
      c.closest('.lib-item').classList.toggle('selected', c.checked); bar();
    }));
    $$('[data-seltopic]', box).forEach((b) => b.addEventListener('click', () => {
      const [s, t] = b.dataset.seltopic.split('|');
      list.filter((i) => i.subject === s && (i.topic || '') === t).forEach((i) => sel.add(i.id));
      render(); bar();
    }));
    $$('[data-addto]', box).forEach((b) => b.addEventListener('click', () => {
      const [s, t] = b.dataset.addto.split('|'); uploadForm(ctx, topics, { subject: s, topic: t });
    }));
    $$('[data-open]', box).forEach((b) => b.addEventListener('click', () => openFile(api, b.dataset.open)));
    $$('[data-share]', box).forEach((b) => b.addEventListener('click', () => shareForm(ctx, [I_[b.dataset.share]])));
    $$('[data-edit]', box).forEach((b) => b.addEventListener('click', () => editForm(ctx, I_[b.dataset.edit], topics)));
    $$('[data-ldel]', box).forEach((b) => b.addEventListener('click', () => {
      const it = I_[b.dataset.ldel], n = usage[it.id]?.size || 0;
      confirmDialog(`Удалить «${it.title}»?${n ? ` Он пропадёт и у ${plural(n, 'ученика', 'учеников', 'учеников')}.` : ''}`, async () => {
        await api.remove('library_items', it.id);
        if (it.file_path) await api.removeFile(it.file_path).catch(() => {});
        toast('Удалено'); ctx.refresh();
      });
    }));
  };

  render();
  $('#q', view).addEventListener('input', render);
  $$('[data-subj]', view).forEach((b) => b.addEventListener('click', () => {
    subj = b.dataset.subj; $$('[data-subj]', view).forEach((x) => x.classList.toggle('on', x === b)); render();
  }));
  $('#up', view).addEventListener('click', () => uploadForm(ctx, topics, { subject: subj }));
  $('#bar-share', view).addEventListener('click', () => shareForm(ctx, [...sel].map((id) => I_[id])));
  $('#bar-clear', view).addEventListener('click', () => { sel.clear(); render(); bar(); });
}
