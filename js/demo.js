// Демо-режим: тот же интерфейс, что у api.js, но данные вымышленные и живут в памяти браузера.
const uid = () => crypto.randomUUID();
const now = Date.now();
const day = 864e5;
const at = (d, hh = 16, mm = 0) => { const x = new Date(now + d * day); x.setHours(hh, mm, 0, 0); return x.toISOString(); };

function seed() {
  const T = 'u-tutor', SA = 'u-anya', P = 'u-parent';
  const A = 's-anya', M = 's-misha';
  const db = {
    profiles: [
      { id: T, role: 'tutor', full_name: 'Илья (демо)', email: 'tutor@demo' },
      { id: SA, role: 'student', full_name: 'Аня', email: 'anya@demo' },
      { id: P, role: 'parent', full_name: 'Мама Ани и Миши', email: 'parent@demo' },
    ],
    students: [
      { id: A, name: 'Аня К.', grade: 9, subjects: ['Математика', 'Физика'], goals: 'ОГЭ по математике на 5, физика — уверенная 4', status: 'active', created_at: at(-60) },
      { id: M, name: 'Миша К.', grade: 8, subjects: ['Математика'], goals: 'Подтянуть алгебру к концу четверти', status: 'active', created_at: at(-30) },
    ],
    student_memberships: [
      { student_id: A, user_id: SA, role: 'student' },
      { student_id: A, user_id: P, role: 'parent' },
      { student_id: M, user_id: P, role: 'parent' },
    ],
    lessons: [], homework: [], materials: [], submissions: [], topic_progress: [],
    payments: [], invitations: [], private_notes: [], library_items: [],
  };
  const L = (student_id, d, subject, topic, status, report = '', pub = false, hh = 16) =>
    db.lessons.push({ id: uid(), student_id, starts_at: at(d, hh), duration_min: 60, subject, topic, plan: '', status, report, report_published: pub, created_at: at(d - 3) });
  L(A, -7, 'Математика', 'Линейные уравнения', 'done', 'Разобрали линейные уравнения и типичные ошибки с переносом слагаемых. Аня решает уверенно.', true);
  L(A, -4, 'Физика', 'Законы Ньютона', 'done', 'Второй закон Ньютона, задачи на силу трения.', true, 17);
  L(A, -2, 'Математика', 'Квадратные уравнения', 'done', 'Дискриминант, теорема Виета. Нужно больше практики.', true);
  L(A, 1, 'Математика', 'Квадратные уравнения: практика', 'planned');
  L(A, 4, 'Физика', 'Работа и мощность', 'planned', '', false, 17);
  L(M, -3, 'Математика', 'Формулы сокращённого умножения', 'done', 'Квадрат суммы и разности. Миша путает знаки — потренируемся.', true, 15);
  L(M, 2, 'Математика', 'Разложение на множители', 'planned', '', false, 15);

  const HW = (student_id, subject, title, description, due) => {
    const x = { id: uid(), student_id, lesson_id: null, subject, title, description, due_at: at(due, 20), created_at: at(due - 4) };
    db.homework.push(x); return x;
  };
  const h1 = HW(A, 'Математика', 'Квадратные уравнения — 10 задач', 'Решить №1–10 из файла. Записывать дискриминант полностью.', 1);
  const h2 = HW(A, 'Физика', 'Задачи на силу трения', 'Решить 5 задач, в каждой нарисовать силы на рисунке.', -1);
  const h3 = HW(A, 'Математика', 'Линейные уравнения', 'Вариант 3 из сборника.', -5);
  HW(M, 'Математика', 'ФСУ — тренировка', 'Раскрыть скобки в 15 выражениях.', 2);

  db.submissions.push(
    { id: uid(), homework_id: h2.id, student_id: A, author_id: SA, answer: 'Решила все 5, в 4-й не уверена с направлением силы.', file_path: null, submitted_at: at(-1, 18), grade: null, feedback: null, reviewed_at: null },
    { id: uid(), homework_id: h3.id, student_id: A, author_id: SA, answer: 'Готово, ответы в тетради: x=3, x=-2, x=0,5…', file_path: null, submitted_at: at(-6, 19), grade: '5', feedback: 'Отлично, ошибок нет. Обрати внимание на оформление последней задачи.', reviewed_at: at(-5, 10) },
  );
  const LIB = (subject, topic, title, size) => {
    const x = { id: uid(), subject, topic, title, file_path: null, url: `https://example.com/${encodeURIComponent(title)}.pdf`, size_bytes: size, created_at: at(-30) };
    db.library_items.push(x); return x;
  };
  const lf = LIB('Математика', 'Справочники', 'Формулы ОГЭ по математике', 812000);
  LIB('Математика', 'Квадратные уравнения', 'Теория: дискриминант и теорема Виета', 1450000);
  const lq = LIB('Математика', 'Квадратные уравнения', 'Тренажёр: 40 уравнений', 640000);
  LIB('Математика', 'Текстовые задачи', 'Задачи на движение', 990000);
  LIB('Физика', 'Механика', 'Механика: Спринт 1 — презентация', 4200000);
  LIB('Физика', 'Механика', 'Законы Ньютона — конспект', 730000);
  LIB('Физика', 'Справочники', 'Формулы ОГЭ по физике', 560000);
  const M_ = (student_id, it, extra = {}) => db.materials.push({ id: uid(), student_id, library_item_id: it.id, subject: it.subject, topic: it.topic, title: it.title, file_path: null, url: it.url, homework_id: null, lesson_id: null, created_at: at(-20), ...extra });
  M_(A, lf); M_(M, lf);
  M_(A, lq, { homework_id: h1.id, created_at: at(-2) });
  const P1 = (student_id, subject, topic, level) =>
    db.topic_progress.push({ id: uid(), student_id, subject, topic, level, checked_at: at(-2).slice(0, 10) });
  P1(A, 'Математика', 'Линейные уравнения', 100);
  P1(A, 'Математика', 'Квадратные уравнения', 50);
  P1(A, 'Математика', 'Текстовые задачи', 25);
  P1(A, 'Физика', 'Законы Ньютона', 75);
  P1(A, 'Физика', 'Работа и мощность', 0);
  P1(M, 'Математика', 'Формулы сокращённого умножения', 50);
  db.payments.push(
    { id: uid(), student_id: A, amount_kopecks: 800000, currency: 'RUB', lessons_count: 4, paid_at: at(-10).slice(0, 10), comment: 'Пакет 4 занятия' },
    { id: uid(), student_id: M, amount_kopecks: 200000, currency: 'RUB', lessons_count: 1, paid_at: at(-4).slice(0, 10), comment: '' },
  );
  db.private_notes.push({ id: uid(), student_id: A, lesson_id: null, body: 'Теряется на задачах с параметром — вернуться после квадратных уравнений.', created_at: at(-2) });
  return db;
}

export function createDemoApi() {
  const db = seed();
  const files = new Map();
  let me = null;
  try { const r = sessionStorage.getItem('demo-user'); if (r) me = db.profiles.find((p) => p.id === r) || null; } catch {}

  const myStudents = () =>
    me.role === 'tutor' ? db.students.map((s) => s.id)
      : db.student_memberships.filter((m) => m.user_id === me.id).map((m) => m.student_id);
  const isParentOf = (sid) => db.student_memberships.some((m) => m.user_id === me.id && m.student_id === sid && m.role === 'parent');

  function visible(table) {
    if (table === 'lessons_public') {
      return db.lessons.map((l) => ({ ...l, plan: undefined, report: l.report_published ? l.report : '' }))
        .filter((l) => myStudents().includes(l.student_id));
    }
    if (table === 'student_balance') {
      return db.students.map((s) => {
        const paid = db.payments.filter((p) => p.student_id === s.id).reduce((a, p) => a + p.lessons_count, 0);
        const done = db.lessons.filter((l) => l.student_id === s.id && l.status === 'done').length;
        return { student_id: s.id, lessons_paid: paid, lessons_done: done, lessons_left: paid - done };
      }).filter((b) => me.role === 'tutor' || isParentOf(b.student_id));
    }
    const rows = db[table];
    if (!rows) throw new Error(`Нет таблицы ${table}`);
    if (me.role === 'tutor') return rows;
    if (['invitations', 'private_notes', 'lessons', 'library_items'].includes(table)) return [];
    if (table === 'payments') return rows.filter((r) => isParentOf(r.student_id));
    if (table === 'profiles') return rows.filter((r) => r.id === me.id);
    if (table === 'students') return rows.filter((r) => myStudents().includes(r.id));
    if (table === 'student_memberships') return rows.filter((r) => r.user_id === me.id);
    return rows.filter((r) => myStudents().includes(r.student_id));
  }
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const tick = () => new Promise((r) => setTimeout(r, 120));

  return {
    demo: true,
    profiles: db.profiles,
    onAuth() {},
    async demoLogin(id) { me = db.profiles.find((p) => p.id === id); try { sessionStorage.setItem('demo-user', id); } catch {} },
    async signIn() { throw new Error('В демо-режиме выберите роль кнопкой ниже'); },
    async signUp() { throw new Error('Регистрация недоступна в демо-режиме'); },
    async signOut() { me = null; try { sessionStorage.removeItem('demo-user'); } catch {} },
    async resetPassword() { throw new Error('Недоступно в демо-режиме'); },
    async updatePassword() { await tick(); },
    async me() { return me && clone(me); },

    async select(table, { eq = {}, order, asc = true, limit } = {}) {
      await tick();
      let rows = visible(table).filter((r) =>
        Object.entries(eq).every(([k, v]) => (Array.isArray(v) ? v.includes(r[k]) : r[k] === v)));
      if (order) rows = [...rows].sort((a, b) => ((a[order] ?? '') > (b[order] ?? '') ? 1 : -1) * (asc ? 1 : -1));
      if (limit) rows = rows.slice(0, limit);
      return clone(rows);
    },
    async dumpAll(table) { return clone(visible(table)); },
    async insert(table, row) {
      await tick();
      if (me.role !== 'tutor' && table !== 'submissions') throw new Error('Нет доступа');
      const x = { id: uid(), created_at: new Date().toISOString(), ...row };
      if (table === 'lessons') Object.assign(x, { status: 'planned', report: '', report_published: false, plan: '', ...row });
      if (table === 'submissions') {
        if (db.submissions.some((s) => s.homework_id === row.homework_id)) throw new Error('Ответ уже отправлен');
        Object.assign(x, { author_id: me.id, submitted_at: x.created_at, grade: null, feedback: null, reviewed_at: null });
      }
      db[table].push(x); return clone(x);
    },
    async update(table, id, patch) {
      await tick();
      const x = db[table].find((r) => r.id === id);
      if (!x) throw new Error('Запись не найдена');
      if (table === 'profiles' && id === me.id) { delete patch.role; }
      else if (me.role !== 'tutor') {
        if (table !== 'submissions' || x.reviewed_at) throw new Error('Нет доступа');
        patch = { answer: patch.answer, file_path: patch.file_path ?? x.file_path, submitted_at: new Date().toISOString() };
      }
      Object.assign(x, patch, { updated_at: new Date().toISOString() });
      if (table === 'profiles' && id === me.id) Object.assign(me, x);
      return clone(x);
    },
    async remove(table, id) {
      await tick();
      if (me.role !== 'tutor') throw new Error('Нет доступа');
      db[table] = db[table].filter((r) => r.id !== id);
      if (table === 'homework') db.submissions = db.submissions.filter((s) => s.homework_id !== id);
      if (table === 'library_items') db.materials = db.materials.filter((m) => m.library_item_id !== id);
    },
    async rpc(fn, args) {
      await tick();
      if (fn === 'create_invitation') {
        const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        db.invitations.push({ id: uid(), student_id: args.p_student_id, role: args.p_role, code_hash: '—', expires_at: new Date(now + 7 * day).toISOString(), used_at: null, created_at: new Date().toISOString() });
        return code;
      }
      throw new Error('В демо-режиме коды приглашений не принимаются');
    },
    async upload(path, file) { await tick(); files.set(path, URL.createObjectURL(file)); return path; },
    async fileUrl(path) { return files.get(path) || '#'; },
    async removeFile(path) { files.delete(path); },
  };
}
