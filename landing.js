// Метка площадки: запоминаем на 7 дней в том же формате, что читает диагностика (diag/diag.js)
try {
  const q = (new URLSearchParams(location.search).get('src') || '').trim().toLowerCase();
  if (/^[a-z0-9_]{1,20}$/.test(q)) localStorage.setItem('diag_src', JSON.stringify({ v: q, t: Date.now() }));
} catch { /* приватный режим: метка просто не сохранится */ }

// Карточка-пример на главной: плавный 3D-наклон за курсором и подсветка под курсором.
const card = document.querySelector('.l-preview');
if (card && matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let frame = 0;
  card.addEventListener('pointermove', (e) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', `${(x - 0.5) * 10}deg`);
      card.style.setProperty('--rx', `${(0.5 - y) * 8}deg`);
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
      card.classList.add('is-tilt');
    });
  });
  card.addEventListener('pointerleave', () => {
    cancelAnimationFrame(frame);
    card.classList.remove('is-tilt');
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  });
}

// Блик на главной кнопке следует за курсором
document.querySelectorAll('.l-cta-main').forEach((b) => b.addEventListener('pointermove', (e) => {
  const r = b.getBoundingClientRect();
  b.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
}));
