// Шпаргалки в кабинете (#/cards): видны только после входа. Интерфейс — cards-ui.js.
import { pageHero } from './ui.js?v=202610291936';
import { mountCards } from './cards-ui.js?v=202610291936';

export function cardsPage(view, _params, ctx) {
  view.innerHTML = '<div class="cd-root"></div>';
  mountCards(view.firstElementChild, {
    base: '../',
    hero: pageHero({ eyebrow: 'Шпаргалки', title: 'Карточки ', accent: 'по темам',
      sub: 'Формулы, определения и главное по каждой теме. Открой тему — и листай карточки.' }).s,
    trainer: (t) => (ctx.me.role !== 'tutor' && t.oge ? `#/trainer/num/${encodeURIComponent(t.subject.name)}/${t.oge}` : null),
  });
}
