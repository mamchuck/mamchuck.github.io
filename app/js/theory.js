// «Теория»: шпаргалки и физическая песочница в одном разделе кабинета (#/theory, #/theory/sim, #/theory/sim/<сцена>).
import { h, mount, $, I, pageHero, esc } from './ui.js?v=202610311455';
import { cardsInto } from './cards.js?v=202610311455';
import { mountSim } from '../../sim/sim-ui.js?v=202610311455';
import { spring } from '../../sim/spring.js?v=202610311455';

const SCENES = { spring };
// Каталог песочниц: готовые открываются, остальные помечены «скоро» (порядок — по плану)
const CATALOG = [
  { id: 'spring', topic: 'Колебания и волны', title: 'Пружинный маятник', text: 'Груз на пружине: период, амплитуда, энергия и графики от времени.' },
  { id: 'projectile', topic: 'Баллистика', title: 'Бросок под углом', text: 'Траектория, дальность и время полёта при разных углах и скоростях.', soon: true },
  { id: 'kinematics', topic: 'Кинематика', title: 'Равноускоренное движение', text: 'Графики x(t), v(t), a(t) и как они связаны между собой.', soon: true },
  { id: 'incline', topic: 'Динамика', title: 'Силы и трение', text: 'Тело на наклонной плоскости: когда оно начинает скользить.', soon: true },
  { id: 'ohm', topic: 'Постоянный ток', title: 'Закон Ома', text: 'Реостат, последовательное и параллельное соединение, показания приборов.', soon: true },
];

const tabs = (cur) => h`<nav class="tabs" aria-label="Разделы теории">
  <a href="#/theory" class="${cur === 'cards' ? 'on' : ''}">Шпаргалки</a>
  <a href="#/theory/sim" class="${cur === 'sim' ? 'on' : ''}">Песочница</a></nav>`;

export async function theoryPage(view, params, ctx) {
  const [tab = 'cards', id] = params;
  if (tab === 'sim' && id && SCENES[id]) {
    const sc = SCENES[id];
    mount(view, h`<a href="#/theory/sim" class="back">${I.back} Песочница</a>
      <header class="sm-head"><h1>${sc.title}</h1><p class="muted">${sc.lead}</p></header><div id="sim-root"></div>`);
    mountSim($('#sim-root', view), sc);
    return;
  }
  if (tab === 'sim') {
    mount(view, h`${pageHero({ eyebrow: 'Теория', title: 'Песочница: ', accent: 'увидь физику', sub: 'Меняй параметры и смотри, как ведёт себя система. Связывай формулу с реальным движением.' })}
      ${tabs('sim')}
      <div class="sm-list">${CATALOG.map((c) => c.soon
        ? h`<div class="sm-tile soon"><span class="sm-tile-t">${c.topic}</span><b>${c.title}</b><p>${c.text}</p><span class="sm-soon">Скоро</span></div>`
        : h`<a class="sm-tile" href="#/theory/sim/${c.id}"><span class="sm-tile-t">${c.topic}</span><b>${c.title}</b><p>${c.text}</p><span class="sm-open">Открыть</span></a>`)}</div>`);
    return;
  }
  mount(view, h`${pageHero({ eyebrow: 'Теория', title: 'Формулы и ', accent: 'главное по темам', sub: 'Карточки по каждой теме: открой тему и листай. А в «Песочнице» всё это можно покрутить руками.' })}
    ${tabs('cards')}<div id="cards-root"></div>`);
  cardsInto($('#cards-root', view), ctx);
}
