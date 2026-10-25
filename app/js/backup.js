// Резервная копия: все данные кабинета в один ZIP (JSON для восстановления + таблицы для Excel)
import { h, $, I, toast, fmtD } from './ui.js?v=202610251033';

const TABLES = [
  ['students', 'Ученики'], ['lessons', 'Занятия'], ['homework', 'Домашние задания'],
  ['submissions', 'Ответы учеников'], ['topic_progress', 'Прогресс'], ['payments', 'Оплаты'],
  ['private_notes', 'Заметки'], ['materials', 'Материалы учеников'], ['library_items', 'Библиотека'],
  ['student_memberships', 'Доступы'], ['profiles', 'Пользователи'], ['invitations', 'Приглашения'],
];
const KEY = 'mamchuck-last-backup';
const DAYS = 14;

export const lastBackup = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const backupOverdue = () => {
  const t = lastBackup();
  return !t || Date.now() - new Date(t).getTime() > DAYS * 864e5;
};

function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = () => resolve(window.JSZip);
    s.onerror = () => reject(new Error('Не удалось загрузить архиватор. Проверьте интернет.'));
    document.head.append(s);
  });
}

// CSV для Excel: точка с запятой и BOM, чтобы кириллица открывалась корректно
const cell = (v) => {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function toCSV(rows) {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return '﻿' + [cols.join(';'), ...rows.map((r) => cols.map((c) => cell(r[c])).join(';'))].join('\r\n');
}

export async function downloadBackup(api, onStep) {
  const JSZip = await loadJSZip();
  const tables = {};
  for (const [t, label] of TABLES) {
    onStep?.(`Собираю: ${label}`);
    tables[t] = await api.dumpAll(t);
  }
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);
  const zip = new JSZip();
  zip.file('backup.json', JSON.stringify({ app: 'mamchuck', version: 1, created_at: now.toISOString(), tables }, null, 2));
  const xl = zip.folder('excel');
  for (const [t, label] of TABLES) if (tables[t].length) xl.file(`${label}.csv`, toCSV(tables[t]));
  zip.file('ПРОЧТИ.txt', [
    `Резервная копия mamchuck от ${fmtD(now)} ${now.getFullYear()}`,
    '',
    'backup.json — полная копия всех данных (нужна для восстановления или переезда).',
    'excel/ — те же данные таблицами: открываются в Excel или Numbers.',
    'Суммы оплат указаны в копейках (amount_kopecks): 800000 = 8 000 ₽.',
    'Сами PDF-файлы в копию не входят — только их названия и пути (file_path).',
    '',
    'Храните файл в надёжном месте: в нём данные учеников.',
  ].join('\r\n'));
  onStep?.('Упаковываю архив');
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mamchuck-backup-${stamp}.zip`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  try { localStorage.setItem(KEY, now.toISOString()); } catch {}
  const total = Object.values(tables).reduce((n, r) => n + r.length, 0);
  return total;
}

// Карточка для настроек
export const backupCard = () => {
  const t = lastBackup();
  return h`<section class="card stack backup-card"><div class="card-head"><h2>Резервная копия</h2>
      ${t ? h`<span class="badge ${backupOverdue() ? 'warn' : 'ok'}">последняя ${fmtD(t)}</span>` : h`<span class="badge warn">ещё не делали</span>`}</div>
    <p class="muted">Все данные кабинета одним архивом: ученики, занятия, отчёты, ДЗ, ответы, прогресс, оплаты, заметки. Внутри есть таблицы для Excel. Скачивайте раз в 1–2 недели и храните на компьютере.</p>
    <button type="button" class="btn btn-primary" data-backup>${I.folder} Скачать всё</button>
    <p class="hint backup-step"></p></section>`;
};

export function bindBackup(root, api, after) {
  root.querySelectorAll('[data-backup]').forEach((b) => b.addEventListener('click', async () => {
    const step = $('.backup-step', root);
    b.disabled = true; b.classList.add('loading');
    try {
      const n = await downloadBackup(api, (s) => { if (step) step.textContent = s; });
      toast(`Копия скачана: ${n} записей`);
      after?.();
    } catch (e) { toast(e.message, 'error'); }
    finally { b.disabled = false; b.classList.remove('loading'); if (step) step.textContent = ''; }
  }));
}
