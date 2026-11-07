// Новая главная: появление блоков, вкладки «Платформа», недели до экзамена. Метку площадки сохраняет landing.js

// Недели до основного периода. Официальное расписание 2027 года ещё не утверждено, поэтому ориентир — 20 мая
// (так начинался основной период в прошлые годы); после этой даты считаем до следующего года
const weeksEl = document.getElementById('n-weeks');
if (weeksEl) {
  const now = new Date();
  let target = new Date(now.getFullYear(), 4, 20);
  if (now > target) target = new Date(now.getFullYear() + 1, 4, 20);
  weeksEl.textContent = Math.max(1, Math.ceil((target - now) / (7 * 864e5)));
}

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
