// Онлайн-доска: у каждого ученика своя. Клетка, перья разных цветов, ластик (стирает штрих целиком), картинки/скриншоты.
// Всё хранится в базе (board_pages → board_items) и обновляется у второго участника сразу (Realtime).
// Координаты логические: лист всегда 1600 в ширину, поэтому у обоих всё выглядит одинаково при любом размере экрана.
import { esc, toast, confirmDialog, fmtD, I, $ } from './ui.js?v=202610291759';

const W = 1600, CELL = 40, MIN_H = 1800, ERASER = 16;
const COLORS = [['#1b2330', 'Чёрный'], ['#2563eb', 'Синий'], ['#e5392f', 'Красный'], ['#1f9d55', 'Зелёный'], ['#f08a00', 'Оранжевый'], ['#8b3fd9', 'Фиолетовый']];
const WIDTHS = [[3, 'Тонкое'], [6, 'Среднее'], [12, 'Толстое']];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uuid = () => crypto.randomUUID();
let dispose = null;

const IC = {
  pen: '<path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16z"/><path d="M14 7l3 3"/>',
  eraser: '<path d="M8 20h12"/><path d="M5.5 14.5 14 6a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11.5 18.5H8z"/><path d="M9 11l4.5 4.5"/>',
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.7"/><path d="m21 16-5-5-9 9"/>',
  down: '<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const ico = (k) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;

// ---------- Рисование штриха ----------
function drawStroke(ctx, d) {
  const p = d.p, n = p.length / 2;
  ctx.strokeStyle = ctx.fillStyle = d.c; ctx.lineWidth = d.w; ctx.lineCap = ctx.lineJoin = 'round';
  if (n === 1) { ctx.beginPath(); ctx.arc(p[0], p[1], d.w / 2, 0, Math.PI * 2); ctx.fill(); return; }
  ctx.beginPath(); ctx.moveTo(p[0], p[1]);
  for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(p[2 * i], p[2 * i + 1], (p[2 * i] + p[2 * i + 2]) / 2, (p[2 * i + 1] + p[2 * i + 3]) / 2);
  ctx.lineTo(p[2 * n - 2], p[2 * n - 1]); ctx.stroke();
}
const bboxOf = (it) => {
  if (it._bb) return it._bb;
  const d = it.data;
  if (it.kind === 'img') return (it._bb = [d.x, d.y, d.x + d.w, d.y + d.h]);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < d.p.length; i += 2) { x0 = Math.min(x0, d.p[i]); x1 = Math.max(x1, d.p[i]); y0 = Math.min(y0, d.p[i + 1]); y1 = Math.max(y1, d.p[i + 1]); }
  return (it._bb = [x0, y0, x1, y1]);
};
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function strokeHit(it, x, y, r) {
  const m = r + it.data.w / 2, [x0, y0, x1, y1] = bboxOf(it);
  if (x < x0 - m || x > x1 + m || y < y0 - m || y > y1 + m) return false;
  const p = it.data.p;
  if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) <= m;
  for (let i = 0; i < p.length - 2; i += 2) if (segDist(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= m) return true;
  return false;
}

export async function mountBoard(root, { api, studentId, canWrite = true, isTutor = false }) {
  dispose?.();
  root.innerHTML = '<div class="loading-block"><span class="spin"></span></div>';

  let pages = await api.select('board_pages', { eq: { student_id: studentId }, order: 'created_at' });
  if (!pages.length && isTutor) pages = [await api.insert('board_pages', { student_id: studentId, title: '' })];
  if (!pages.length) {
    root.innerHTML = `<div class="empty">${I.note?.s || ''}<p>Доска появится, когда преподаватель откроет её на занятии.</p></div>`;
    return;
  }

  // ---------- Состояние ----------
  let page = pages[pages.length - 1];
  const items = new Map();                      // id → { id, kind, data, created_by }
  const mine = [];                              // id моих последних объектов (для «отменить»)
  const live = new Map();                       // чужие штрихи, которые ещё пишутся: id → { d, t }
  const imgCache = new Map();                   // path → { el, p, failed }
  let tool = 'pen', color = COLORS[1][0], width = WIDTHS[1][0];
  let fingerDraw = false, selected = null, cur = null, drag = null, pending = 0, H = MIN_H, scale = 1, raf = 0, loadToken = 0;
  const unsub = [];

  root.innerHTML = `
    <div class="bd">
      <div class="bd-bar card">
        ${canWrite ? `
        <div class="bd-grp" role="group" aria-label="Инструменты">
          <button class="bd-btn on" data-tool="pen" title="Перо (P)" aria-label="Перо">${ico('pen')}</button>
          <button class="bd-btn" data-tool="eraser" title="Ластик (E)" aria-label="Ластик">${ico('eraser')}</button>
          <button class="bd-btn" data-tool="move" title="Двигать картинки (V)" aria-label="Двигать картинки">${ico('move')}</button>
        </div>
        <div class="bd-grp" role="group" aria-label="Цвет">${COLORS.map(([c, n], i) => `<button class="bd-dot${i === 1 ? ' on' : ''}" data-color="${c}" style="--c:${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div>
        <div class="bd-grp" role="group" aria-label="Толщина">${WIDTHS.map(([w, n], i) => `<button class="bd-w${i === 1 ? ' on' : ''}" data-w="${w}" title="${n}" aria-label="${n}"><i style="height:${Math.round(w / 2) + 1}px"></i></button>`).join('')}</div>
        <div class="bd-grp">
          <button class="bd-btn" id="bd-undo" title="Отменить (Ctrl+Z)" aria-label="Отменить">${ico('undo')}</button>
          <button class="bd-btn" id="bd-img" title="Добавить картинку или скриншот (можно просто вставить Ctrl+V)" aria-label="Добавить картинку">${ico('image')}</button>
          <button class="bd-btn bd-touch" id="bd-finger" title="Рисовать пальцем" aria-pressed="false" aria-label="Рисовать пальцем">☝</button>
        </div>` : ''}
        <div class="bd-grp bd-right">
          <span class="bd-status" id="bd-status" aria-live="polite"></span>
          <button class="bd-btn" id="bd-save" title="Скачать лист картинкой" aria-label="Скачать лист">${ico('down')}</button>
        </div>
      </div>
      <div class="bd-pages" id="bd-pages"></div>
      <div class="bd-scroll" id="bd-scroll"><div class="bd-sheet" id="bd-sheet"><canvas id="bd-cv"></canvas></div></div>
      <input type="file" id="bd-file" accept="image/*" hidden>
    </div>`;
  const scroll = $('#bd-scroll', root), sheet = $('#bd-sheet', root), cv = $('#bd-cv', root), ctx = cv.getContext('2d');
  const status = $('#bd-status', root);

  // ---------- Размер и отрисовка ----------
  function fit() {
    const cssW = sheet.clientWidth || 800, dpr = Math.min(2, window.devicePixelRatio || 1);
    scale = cssW / W;
    let bottom = 0; for (const it of items.values()) bottom = Math.max(bottom, bboxOf(it)[3]);
    if (cur) bottom = Math.max(bottom, cur.d.p[cur.d.p.length - 1] ?? 0);
    H = Math.max(MIN_H, Math.ceil((bottom + 700) / CELL) * CELL);
    const pw = Math.round(cssW * dpr), ph = Math.round(H * scale * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    cv.style.height = `${H * scale}px`;
    sheet.style.setProperty('--cell', `${CELL * scale}px`);
    ctx.setTransform(pw / W, 0, 0, pw / W, 0, 0);
  }
  function paint() {
    raf = 0; if (!root.isConnected) return;
    fit(); ctx.clearRect(0, 0, W, H);
    for (const it of items.values()) if (it.kind === 'img') {
      const el = getImg(it.data.path), d = it.data;
      if (el) ctx.drawImage(el, d.x, d.y, d.w, d.h);
      else { ctx.fillStyle = '#eef3f9'; ctx.fillRect(d.x, d.y, d.w, d.h); ctx.fillStyle = '#8aa0b8'; ctx.font = '28px sans-serif'; ctx.fillText(imgCache.get(d.path)?.failed ? 'Не удалось загрузить' : 'Загрузка…', d.x + 20, d.y + 44); }
    }
    for (const it of items.values()) if (it.kind === 'stroke') drawStroke(ctx, it.data);
    for (const l of live.values()) drawStroke(ctx, l.d);
    if (cur) drawStroke(ctx, cur.d);
    const sel = selected && items.get(selected);
    if (sel) {
      const d = sel.data; ctx.save(); ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.strokeRect(d.x, d.y, d.w, d.h); ctx.setLineDash([]);
      ctx.fillStyle = '#2563eb'; ctx.fillRect(d.x + d.w - 14, d.y + d.h - 14, 28, 28); ctx.restore();
    }
  }
  const redraw = () => { if (!raf) raf = requestAnimationFrame(paint); };

  // ---------- Картинки ----------
  function loadImg(path) {
    let e = imgCache.get(path);
    if (e) return e.p;
    e = { el: null, failed: false };
    e.p = api.fileUrl(path).then((url) => new Promise((res) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { e.el = im; res(im); redraw(); };
      im.onerror = () => { e.failed = true; res(null); redraw(); };
      im.src = url;
    })).catch(() => { e.failed = true; redraw(); return null; });
    imgCache.set(path, e);
    return e.p;
  }
  const getImg = (path) => { const e = imgCache.get(path); if (!e) { loadImg(path); return null; } return e.el; };

  async function addImage(file) {
    if (!canWrite || !file || !file.type.startsWith('image/')) return;
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 1600 / bmp.width), c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
      const path = `${studentId}/board/${uuid()}.jpg`;
      const w = Math.min(c.width, 900), hgt = Math.round(w * c.height / c.width);
      const data = { path, x: 40, y: Math.round(scroll.scrollTop / scale) + 40, w, h: hgt };
      const id = uuid(), item = { id, kind: 'img', data };
      imgCache.set(path, { el: c, p: Promise.resolve(c), failed: false });
      items.set(id, item); selected = id; setTool('move'); redraw();
      setPending(1);
      try { await api.upload(path, blob); await api.insert('board_items', { id, page_id: page.id, student_id: studentId, kind: 'img', data }); mine.push(id); }
      catch (e) { items.delete(id); selected = null; toast(`Не удалось добавить картинку: ${e.message}`, 'error'); redraw(); }
      setPending(-1);
    } catch { toast('Не удалось прочитать картинку', 'error'); }
  }

  // ---------- Сохранение ----------
  function setPending(d) {
    pending += d; status.textContent = pending > 0 ? 'Сохраняю…' : '✓ Сохранено';
    status.classList.toggle('busy', pending > 0);
  }
  async function persist(item) {
    setPending(1);
    for (let t = 0; t < 3; t++) {
      try { await api.insert('board_items', { id: item.id, page_id: item.page_id, student_id: studentId, kind: item.kind, data: item.data }); setPending(-1); return; }
      catch (e) { if (t === 2) { items.delete(item.id); redraw(); toast(`Штрих не сохранился: ${e.message}`, 'error'); setPending(-1); return; } await sleep(700 * (t + 1)); }
    }
  }
  function del(it, { file = true } = {}) {
    items.delete(it.id); if (selected === it.id) selected = null;
    const i = mine.indexOf(it.id); if (i >= 0) mine.splice(i, 1);
    setPending(1);
    api.remove('board_items', it.id).catch((e) => toast(`Не удалось удалить: ${e.message}`, 'error')).finally(() => setPending(-1));
    if (file && it.kind === 'img') api.removeFile(it.data.path).catch(() => {});
    redraw();
  }

  // ---------- Живой штрих ----------
  const chan = api.live(`board-live:${studentId}`, (m) => {
    if (!root.isConnected || !m || m.page !== page.id || items.has(m.id)) return;
    let l = live.get(m.id); if (!l) live.set(m.id, l = { d: { c: m.c, w: m.w, p: [] } });
    l.t = Date.now(); l.d.p.push(...m.p);
    if (m.end) setTimeout(() => { if (live.delete(m.id)) redraw(); }, 4000);   // если сохранённый штрих так и не пришёл
    redraw();
  });
  function sendLive(force = false, end = false) {
    const now = Date.now();
    if (!cur || (!force && now - cur.t < 70)) return;
    const p = cur.d.p, from = Math.max(0, cur.sent - 2);       // с запасом в одну точку, чтобы линия не рвалась
    chan.send({ id: cur.id, page: page.id, c: cur.d.c, w: cur.d.w, p: p.slice(from), end });
    cur.sent = p.length; cur.t = now;
  }

  // ---------- Указатель ----------
  const pt = (e) => { const r = cv.getBoundingClientRect(), k = W / r.width; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; };
  const imgAt = (x, y) => { const l = [...items.values()].filter((i) => i.kind === 'img'); for (let i = l.length - 1; i >= 0; i--) { const d = l[i].data; if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return l[i]; } return null; };
  const eraseAt = (x, y) => { for (const it of [...items.values()]) if (it.kind === 'stroke' && strokeHit(it, x, y, ERASER)) del(it); };

  function down(e) {
    if (!canWrite || e.button > 0) return;
    if (e.pointerType === 'touch' && !fingerDraw) return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    const [x, y] = pt(e);
    if (tool === 'pen') {
      cur = { id: uuid(), sent: 0, t: 0, d: { c: color, w: width, p: [Math.round(x), Math.round(y)] } };
      sendLive(true);
      ctx.strokeStyle = ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, width / 2, 0, Math.PI * 2); ctx.fill();
    } else if (tool === 'eraser') { drag = { erase: true }; eraseAt(x, y); }
    else if (tool === 'move') {
      const sel = selected && items.get(selected), d = sel?.data;
      if (d && Math.abs(x - (d.x + d.w)) < 30 && Math.abs(y - (d.y + d.h)) < 30) drag = { id: sel.id, resize: true, x0: x, w0: d.w, h0: d.h, moved: false };
      else { const hit = imgAt(x, y); selected = hit ? hit.id : null; drag = hit ? { id: hit.id, x0: x, y0: y, ox: hit.data.x, oy: hit.data.y, moved: false } : null; redraw(); }
    }
  }
  function move(e) {
    if (!cur && !drag) return;
    const co = cur && e.getCoalescedEvents?.(), evs = co?.length ? co : [e];
    for (const ev of evs) {
      const [x, y] = pt(ev);
      if (cur) {
        const p = cur.d.p, lx = p[p.length - 2], ly = p[p.length - 1], rx = Math.round(x), ry = Math.round(y);
        if (Math.hypot(rx - lx, ry - ly) < 1.5) continue;
        p.push(rx, ry); sendLive();
        if (ry > H - 300) { redraw(); continue; }
        ctx.strokeStyle = cur.d.c; ctx.lineWidth = cur.d.w; ctx.lineCap = ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(rx, ry); ctx.stroke();
      } else if (drag?.erase) eraseAt(x, y);
      else if (drag) {
        const it = items.get(drag.id); if (!it) continue; const d = { ...it.data };
        if (drag.resize) { const nw = Math.max(80, drag.w0 + (x - drag.x0)); d.w = Math.round(nw); d.h = Math.round(nw * drag.h0 / drag.w0); }
        else { d.x = Math.round(drag.ox + x - drag.x0); d.y = Math.round(drag.oy + y - drag.y0); }
        drag.moved = true; it.data = d; it._bb = null; redraw();
      }
    }
  }
  function up() {
    if (cur) {
      sendLive(true, true);
      const item = { id: cur.id, page_id: page.id, kind: 'stroke', data: cur.d };
      items.set(item.id, item); mine.push(item.id); cur = null; redraw(); persist(item);
    } else if (drag && !drag.erase && drag.moved) {
      const it = items.get(drag.id);
      if (it) { setPending(1); api.update('board_items', it.id, { data: it.data }).catch((e) => toast(`Не удалось сохранить: ${e.message}`, 'error')).finally(() => setPending(-1)); }
    }
    drag = null;
  }
  cv.addEventListener('pointerdown', down);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);

  // ---------- Панель ----------
  function setTool(t) {
    tool = t; if (t !== 'move') selected = null;
    root.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
    sheet.dataset.tool = t; redraw();
  }
  function undo() {
    const id = mine[mine.length - 1], it = id && items.get(id);
    if (!it) { mine.pop(); if (mine.length) undo(); return; }
    del(it);
  }
  root.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  root.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => {
    color = b.dataset.color; root.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('on', x === b)); setTool('pen');
  }));
  root.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', () => {
    width = +b.dataset.w; root.querySelectorAll('[data-w]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('#bd-undo', root)?.addEventListener('click', undo);
  $('#bd-img', root)?.addEventListener('click', () => $('#bd-file', root).click());
  $('#bd-file', root).addEventListener('change', (e) => { [...e.target.files].forEach(addImage); e.target.value = ''; });
  $('#bd-finger', root)?.addEventListener('click', (e) => {
    fingerDraw = !fingerDraw; e.currentTarget.classList.toggle('on', fingerDraw); e.currentTarget.setAttribute('aria-pressed', fingerDraw);
    sheet.classList.toggle('finger', fingerDraw);
  });
  $('#bd-save', root).addEventListener('click', exportPng);

  const onKey = (e) => {
    if (!root.isConnected) return stop();
    if (!canWrite || e.target.closest?.('input, textarea, select, [contenteditable], .modal')) return;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); undo(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); const it = items.get(selected); if (it) del(it); }
    else if (!e.ctrlKey && !e.metaKey && !e.altKey) { const t = { KeyP: 'pen', KeyE: 'eraser', KeyV: 'move' }[e.code]; if (t) setTool(t); }
  };
  const onPaste = (e) => {
    if (!root.isConnected || !canWrite) return;
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); addImage(f); }
  };
  addEventListener('keydown', onKey); addEventListener('paste', onPaste);
  sheet.addEventListener('dragover', (e) => { if (canWrite) e.preventDefault(); });
  sheet.addEventListener('drop', (e) => { if (!canWrite) return; e.preventDefault(); [...e.dataTransfer.files].forEach(addImage); });
  const ro = new ResizeObserver(redraw); ro.observe(sheet);
  setPending(0); status.textContent = '';

  // ---------- Листы ----------
  function renderPages() {
    const box = $('#bd-pages', root);
    box.innerHTML = `${pages.map((p, i) => `<button class="bd-tab${p.id === page.id ? ' on' : ''}" data-page="${p.id}">Лист ${i + 1}<small>${esc(fmtD(p.created_at))}</small></button>`).join('')}
      ${isTutor ? `<button class="bd-tab bd-add" id="bd-newpage" title="Новый лист">${ico('plus')} Лист</button>
        <span class="bd-sp"></span><button class="btn btn-ghost btn-sm" id="bd-clear">Очистить лист</button><button class="btn btn-ghost btn-sm" id="bd-delpage">Удалить лист</button>` : ''}`;
    box.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => { const p = pages.find((x) => x.id === b.dataset.page); if (p && p.id !== page.id) openPage(p); }));
    $('#bd-newpage', box)?.addEventListener('click', async () => {
      try { const p = await api.insert('board_pages', { student_id: studentId, title: '' }); if (!pages.some((x) => x.id === p.id)) pages.push(p); openPage(p); }
      catch (e) { toast(e.message, 'error'); }
    });
    $('#bd-clear', box)?.addEventListener('click', () => confirmDialog('Стереть всё на этом листе? Вернуть нельзя.', async () => {
      await api.removeWhere('board_items', { page_id: page.id }); items.clear(); mine.length = 0; selected = null; redraw();
    }, 'Очистить'));
    $('#bd-delpage', box)?.addEventListener('click', () => confirmDialog('Удалить лист целиком вместе с записями?', async () => {
      const gone = page.id; await api.remove('board_pages', gone); pages = pages.filter((p) => p.id !== gone);
      if (!pages.length) pages = [await api.insert('board_pages', { student_id: studentId, title: '' })];
      openPage(pages[pages.length - 1]);
    }));
  }
  async function openPage(p) {
    page = p; const token = ++loadToken;
    items.clear(); live.clear(); mine.length = 0; selected = null; cur = null; drag = null; renderPages(); scroll.scrollTop = 0;
    let rows;
    try { rows = await api.select('board_items', { eq: { page_id: p.id }, order: 'created_at' }); }
    catch (e) { toast(`Не удалось загрузить доску: ${e.message}`, 'error'); return; }
    if (token !== loadToken) return;
    for (const r of rows) items.set(r.id, { id: r.id, kind: r.kind, data: r.data });
    redraw();
  }

  // ---------- Живые обновления ----------
  function onItem(ev) {
    if (!root.isConnected) return stop();
    const n = ev.new, o = ev.old;
    if (ev.eventType === 'INSERT') { if (live.delete(n.id)) { /* штрих дописан */ } if (n.page_id === page.id && !items.has(n.id)) items.set(n.id, { id: n.id, kind: n.kind, data: n.data }); }
    else if (ev.eventType === 'DELETE') { if (items.delete(o.id) && selected === o.id) selected = null; }
    else if (ev.eventType === 'UPDATE') { const it = items.get(n.id); if (it && drag?.id !== n.id) { it.data = n.data; it._bb = null; } }
    redraw();
  }
  function onPage(ev) {
    if (!root.isConnected) return stop();
    if (ev.eventType === 'INSERT' && !pages.some((p) => p.id === ev.new.id)) { pages.push(ev.new); renderPages(); }
    else if (ev.eventType === 'DELETE') {
      pages = pages.filter((p) => p.id !== ev.old.id);
      if (ev.old.id === page.id && pages.length) openPage(pages[pages.length - 1]); else renderPages();
    }
  }
  // Запасной вариант, если Realtime не подключился: раз в 4 секунды подтягиваем новое
  let poll = null;
  const startPoll = () => {
    if (poll) return;
    poll = setInterval(async () => {
      if (!root.isConnected) return stop();
      try {
        const rows = await api.select('board_items', { eq: { page_id: page.id }, order: 'created_at' });
        const ids = new Set(rows.map((r) => r.id)); let ch = false;
        for (const r of rows) if (!items.has(r.id)) { items.set(r.id, { id: r.id, kind: r.kind, data: r.data }); ch = true; }
        for (const id of [...items.keys()]) if (!ids.has(id) && !pending) { items.delete(id); ch = true; }
        if (ch) redraw();
      } catch { /* повторим */ }
    }, 4000);
  };
  const onStatus = (s) => { if (s === 'SUBSCRIBED') { clearInterval(poll); poll = null; } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') startPoll(); };
  unsub.push(api.subscribe('board_items', `student_id=eq.${studentId}`, onItem, onStatus));
  unsub.push(api.subscribe('board_pages', `student_id=eq.${studentId}`, onPage));
  const watchdog = setInterval(() => { if (!root.isConnected) stop(); }, 3000);

  // ---------- Скачать лист ----------
  async function exportPng() {
    const list = [...items.values()];
    await Promise.all(list.filter((i) => i.kind === 'img').map((i) => loadImg(i.data.path)));
    let bottom = 0; for (const it of list) bottom = Math.max(bottom, bboxOf(it)[3]);
    const h = Math.max(900, Math.ceil((bottom + 60) / CELL) * CELL), c = document.createElement('canvas');
    c.width = W; c.height = h; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, h); g.strokeStyle = '#d6e4f4'; g.lineWidth = 1; g.beginPath();
    for (let x = 0; x <= W; x += CELL) { g.moveTo(x + .5, 0); g.lineTo(x + .5, h); }
    for (let y = 0; y <= h; y += CELL) { g.moveTo(0, y + .5); g.lineTo(W, y + .5); }
    g.stroke();
    for (const it of list) if (it.kind === 'img') { const el = imgCache.get(it.data.path)?.el; if (el) g.drawImage(el, it.data.x, it.data.y, it.data.w, it.data.h); }
    for (const it of list) if (it.kind === 'stroke') drawStroke(g, it.data);
    try {
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `доска-${new Date(page.created_at).toISOString().slice(0, 10)}.png`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch { toast('Не удалось сохранить картинку', 'error'); }
  }

  function stop() {
    unsub.forEach((f) => { try { f(); } catch {} }); unsub.length = 0;
    clearInterval(poll); clearInterval(watchdog); ro.disconnect(); chan.close();
    removeEventListener('keydown', onKey); removeEventListener('paste', onPaste);
    if (dispose === stop) dispose = null;
  }
  dispose = stop;

  sheet.dataset.tool = 'pen';
  await openPage(page);
}
