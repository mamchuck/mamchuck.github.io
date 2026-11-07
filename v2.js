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

// Нижняя кнопка на телефоне появляется, только когда главная кнопка первого экрана ушла за экран (без дубля)
const sticky = document.querySelector('.l-sticky'), heroCta = document.querySelector('.l-hero .l-cta-main');
if (sticky && heroCta && 'IntersectionObserver' in window) {
  sticky.classList.add('n-off');
  new IntersectionObserver(([e]) => sticky.classList.toggle('n-off', e.isIntersecting)).observe(heroCta);
}
