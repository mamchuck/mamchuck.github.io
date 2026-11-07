// Яндекс Метрика с согласием на cookies. Пока YM_ID = 0, файл ничего не делает: ни баннера, ни запросов.
// Номер счётчика: metrika.yandex.ru → «Добавить счётчик» → цифры из кода счётчика.
// Цели (создать в Метрике: «JavaScript-событие» с этими идентификаторами):
//   diag_open   — нажали «Пройти диагностику» на главной
//   diag_start  — начали диагностику (выбрали предмет)
//   diag_finish — увидели результат диагностики
//   diag_bot    — перешли из результата в бот за разбором
//   trial_click — нажали «Записаться на пробное»
//   bot_click   — любой другой переход в бот
const YM_ID = 0;
const KEY = 'cookie_ok';                                   // 'yes' | 'no' — выбор посетителя, спрашиваем один раз

let ready = false;
window.ymGoal = (name) => { if (ready) window.ym(YM_ID, 'reachGoal', name); };

function load() {
  if (ready || !YM_ID) return;
  window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
  window.ym.l = Date.now();
  const s = document.createElement('script'); s.async = true; s.src = 'https://mc.yandex.ru/metrika/tag.js';
  document.head.append(s);
  window.ym(YM_ID, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true });
  ready = true;
}

function ask() {
  const box = document.createElement('div');
  box.className = 'n-cookie'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Согласие на cookies');
  box.innerHTML = `<p>Сайт использует cookies и Яндекс Метрику, чтобы понимать, какие страницы полезны. Подробнее — в <a href="/legal/privacy/">политике</a>.</p>
    <div><button class="btn btn-primary" data-c="yes">Хорошо</button><button class="btn btn-ghost" data-c="no">Отказаться</button></div>`;
  box.addEventListener('click', (e) => {
    const c = e.target.closest('[data-c]')?.dataset.c; if (!c) return;
    try { localStorage.setItem(KEY, c); } catch {}
    box.remove(); if (c === 'yes') load();
  });
  document.body.append(box);
}

if (YM_ID) {
  let c = null; try { c = localStorage.getItem(KEY); } catch {}
  if (c === 'yes') load(); else if (c !== 'no') ask();
}

// Клики по кнопкам с data-goal и по ссылкам в бот
document.addEventListener('click', (e) => {
  const a = e.target.closest('a, button'); if (!a) return;
  const g = a.dataset.goal || (/t\.me\/mamchuck_bot/.test(a.href || '') ? 'bot_click' : '');
  if (g) window.ymGoal(g);
});
