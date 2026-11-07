// Новая главная: появление блоков и вкладки «Платформа». Метку площадки сохраняет landing.js


// Вкладки: клик, стрелки влево/вправо, Home/End
const tabs = [...document.querySelectorAll('.n-tab')];
const select = (t, focus) => {
  tabs.forEach((x) => {
    const on = x === t;
    x.classList.toggle('on', on); x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1;
    document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
  });
  if (focus) t.focus();
};
tabs.forEach((t, i) => {
  t.addEventListener('click', () => select(t));
  t.addEventListener('keydown', (e) => {
    const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (j === undefined) return;
    e.preventDefault(); select(tabs[(j + tabs.length) % tabs.length], true);
  });
});

// Появление блоков при прокрутке. Без поддержки IntersectionObserver всё просто видно сразу
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('.n-reveal').forEach((el) => { if (el.getBoundingClientRect().top < innerHeight) el.classList.add('in'); });   // видимое сразу не мигает
  document.documentElement.classList.add('n-js');
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.n-reveal').forEach((el) => io.observe(el));
}

// Нижняя кнопка «Пройти диагностику» (телефон и компьютер) появляется, когда главная кнопка первого экрана ушла за экран,
// и прячется у финального блока, где своя такая же кнопка — без дублей
const sticky = document.querySelector('.l-sticky');
const spots = [document.querySelector('.l-hero .l-cta-main'), document.querySelector('.l-final')].filter(Boolean);
if (sticky && spots.length && 'IntersectionObserver' in window) {
  const seen = new Set(spots);
  sticky.classList.add('n-off');
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)));
    sticky.classList.toggle('n-off', seen.size > 0);
  });
  spots.forEach((el) => io.observe(el));
}
