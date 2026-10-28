// Тренировка навыков (/razminka/) — открытая страница. Интерфейс общий с кабинетом: drill-ui.js.
// Вошедшему в кабинет ученику (сессия Supabase в этом же браузере) раунд засчитывается в XP, серию и прогресс.
import { CONFIG } from '../app/js/config.js?v=202610290022';
import { startFx } from '../diag/fx.js?v=202610290022';
import { mountDrill } from './drill-ui.js?v=202610290022';

function session() {
  try {
    const k = Object.keys(localStorage).find((x) => /^sb-.+-auth-token$/.test(x));
    const s = k && JSON.parse(localStorage.getItem(k));
    return s?.access_token && s.expires_at * 1000 > Date.now() + 30e3 ? s.access_token : null;
  } catch { return null; }
}
async function rpc(fn, args) {
  const token = session();
  if (!token || !CONFIG.supabaseUrl) return null;
  const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST', body: JSON.stringify(args),
    headers: { apikey: CONFIG.supabaseAnonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return r.ok ? r.json().catch(() => null) : null;
}

const start = location.hash.slice(1);
if (start) history.replaceState(null, '', location.pathname + location.search);
mountDrill(document.getElementById('rz'), {
  rpc, fx: startFx(), history: true, start,
  hero: `<span class="l-chip">⚡ 60 секунд · бесплатно · без регистрации</span>
    <h1 class="x-title">Тренировка: <span class="x-grad">навыки на автомате</span></h1>
    <p class="x-sub">Счёт, дроби, степени, тригонометрия, формулы и единицы физики. Минута в день — и на экзамене руки делают это сами, а голова занята задачей.</p>`,
  note: session() ? '<p class="rz-note">✓ Ты вошёл в кабинет — раунды сохраняются в прогресс, дают XP и держат 🔥 серию.</p>'
    : '<p class="rz-note">Занимаешься со мной? Войди в <a href="../app/">кабинет</a> — результаты будут сохраняться в прогресс.</p>',
  cta: `<div class="card rz-cta"><b>Хочешь так же уверенно решать задачи?</b><p class="muted">Диагностика за 12 минут покажет, какие номера экзамена проседают.</p>
    <a class="btn btn-primary" href="../diag/">Пройти диагностику</a></div>`,
});
