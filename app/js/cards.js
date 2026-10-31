// Шпаргалки в кабинете: показываются во вкладке «Теория» (theory.js), видны только после входа. Интерфейс — cards-ui.js.
import { mountCards } from './cards-ui.js?v=202610311602';

export function cardsInto(el, ctx) {
  return mountCards(el, {
    base: '../',
    hero: '',
    trainer: (t) => (ctx.me.role !== 'tutor' && t.oge ? `#/trainer/num/${encodeURIComponent(t.subject.name)}/${t.oge}` : null),
  });
}
// Старая ссылка #/cards ведёт в «Теорию»
export function cardsPage() { location.replace('#/theory'); }
