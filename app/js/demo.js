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
    app_settings: [{ id: 1, reminder_minutes: 120, evening_reminder: false, evening_hour: 20, timezone: 'Europe/Moscow', bot_username: 'mamchuck_bot', bot_ready: true }],
    telegram_links: [{ user_id: P, chat_id: 1001, tg_username: 'mama_demo', tg_name: 'Мама', notify: true, linked_at: at(-3) }],
    lesson_responses: [], board_pages: [], board_items: [],
    oge_tasks: [], oge_sets: [], oge_attempts: [], oge_templates: [],
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
  db.private_notes.push({ id: uid(), student_id: A, lesson_id: null, body: 'Теряется на задачах с параметром — вернуться после квадратных уравнений.', created_at: at(-2) });
  const TK = (subject, num, topic, body, answer, solution, answer_type = 'short', max_points = 1) => {
    const x = { id: uid(), subject, num, topic, body, answer, solution, answer_type, max_points, image_path: null, source: 'демо', created_at: at(-10) };
    db.oge_tasks.push(x); return x;
  };
  const t1 = TK('Математика', 6, 'Дроби', 'Найдите значение выражения 3/4 + 5/8.', '1,375|11/8', '3/4 = 6/8; 6/8 + 5/8 = 11/8 = 1,375.');
  TK('Математика', 6, 'Десятичные дроби', 'Найдите значение выражения 2,7 · 3,5 − 1,45.', '8', '2,7 · 3,5 = 9,45; 9,45 − 1,45 = 8.');
  const t3 = TK('Математика', 9, 'Линейные уравнения', 'Найдите корень уравнения 5x − 8 = 3x + 6.', '7', '2x = 14, x = 7.');
  TK('Математика', 9, 'Квадратные уравнения', 'Решите уравнение x² − 7x + 10 = 0. Если корней несколько, запишите больший.', '5', 'По теореме Виета корни 2 и 5. Больший — 5.');
  TK('Математика', 10, 'Вероятность', 'В коробке 12 красных и 8 синих ручек. Найдите вероятность того, что случайно выбранная ручка окажется синей.', '0,4', '8 / 20 = 0,4.');
  TK('Математика', 21, 'Задачи на движение', 'Моторная лодка прошла 36 км по течению и вернулась обратно, затратив на весь путь 5 часов. Скорость течения 3 км/ч. Найдите собственную скорость лодки.', '15', '36/(v+3) + 36/(v−3) = 5 ⇒ 5v² − 72v − 45 = 0 ⇒ v = 15 км/ч.', 'full', 2);
  TK('Физика', 6, 'Плотность', 'Масса бруска 540 г, его объём 200 см³. Найдите плотность вещества бруска в г/см³.', '2,7', 'ρ = m / V = 540 / 200 = 2,7 г/см³.');
  TK('Физика', 8, 'Работа и мощность', 'Подъёмный кран поднял груз массой 500 кг на высоту 12 м за 30 с. Какую мощность развивал кран? Ответ дайте в ваттах. g = 10 Н/кг.', '2000', 'A = mgh = 500 · 10 · 12 = 60 000 Дж; N = A / t = 2000 Вт.');
  db.oge_sets.push({ id: 'set-demo', student_id: A, subject: 'Математика', kind: 'set', title: 'Вариант №1 (демо)', task_ids: [t1.id, t3.id], due_at: at(3, 20), created_at: at(-1) });
  db.oge_attempts.push({ id: uid(), task_id: t1.id, student_id: A, user_id: SA, set_id: 'set-demo', answer: '11/8', is_correct: true, points: 1, max_points: 1, created_at: at(-1) });
  const next = db.lessons.find((l) => l.student_id === A && l.status === 'planned');
  if (next) db.lesson_responses.push({ lesson_id: next.id, user_id: P, student_id: A, role: 'parent', response: 'move', created_at: at(-1) });
  // Заявки из диагностики
  const it = (bad) => [6, 8, 9, 10, 12, 13, 15, 16, 17, 18].map((num) => ({ num, ok: !bad.includes(num) }));
  db.xray_sessions = [
    { id: uid(), subject: 'Математика', created_at: at(-0.05), finished_at: at(-0.05), tg_chat_id: 1, tg_username: 'masha_oge', tg_name: 'Маша',
      trial_requested_at: at(-0.04), lead_status: 'new', result: { grade: 3, correct: 6, total: 10, items: it([9, 13, 16, 18]) } },
    { id: uid(), subject: 'Физика', created_at: at(-1), finished_at: at(-1), tg_chat_id: 2, tg_username: null, tg_name: 'Дима',
      lead_status: 'contacted', result: { grade: 4, correct: 8, total: 10, items: it([9, 15]) } },
    { id: uid(), subject: 'Математика', created_at: at(-2), finished_at: at(-2), tg_chat_id: null,
      lead_status: 'new', result: { grade: 2, correct: 3, total: 10, items: it([8, 9, 10, 12, 13, 15, 17]) } },
  ];
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

  // Те же фильтры, что у настоящего API: eq, isNull, notNull, search (без учёта регистра), order
  function filterRows(table, { eq = {}, isNull = [], notNull = [], gte = {}, gt = {}, lt = {}, lte = {}, search, order, asc = true } = {}) {
    const q = search?.q?.trim().toLowerCase();
    let rows = visible(table).filter((r) =>
      Object.entries(eq).every(([k, v]) => (Array.isArray(v) ? v.includes(r[k]) : r[k] === v))
      && isNull.every((c) => r[c] == null) && notNull.every((c) => r[c] != null)
      && Object.entries(gte).every(([c, v]) => r[c] >= v) && Object.entries(gt).every(([c, v]) => r[c] > v)
      && Object.entries(lt).every(([c, v]) => r[c] < v) && Object.entries(lte).every(([c, v]) => r[c] <= v)
      && (!q || search.fields.some((f) => String(r[f] ?? '').toLowerCase().includes(q))));
    const ord = Array.isArray(order) ? order : order ? [[order, asc]] : [];
    if (ord.length) rows = [...rows].sort((a, b) => { for (const [c, up] of ord) { if ((a[c] ?? '') > (b[c] ?? '')) return up ? 1 : -1; if ((a[c] ?? '') < (b[c] ?? '')) return up ? -1 : 1; } return 0; });
    return rows;
  }

  function visible(table) {
    if (table === 'lessons_public') {
      return db.lessons.map((l) => ({ ...l, plan: undefined, report: l.report_published ? l.report : '' }))
        .filter((l) => myStudents().includes(l.student_id));
    }
    if (table === 'oge_tasks_public') return db.oge_tasks.map(({ answer, solution, solution_image_path, source, ...t }) => t);
    if (table === 'oge_task_counts') {
      const c = {}; for (const t of db.oge_tasks) c[`${t.subject}|${t.num}`] = (c[`${t.subject}|${t.num}`] || 0) + 1;
      return Object.entries(c).map(([k, n]) => ({ subject: k.split('|')[0], num: +k.split('|')[1], n }));
    }
    const rows = db[table];
    if (!rows) throw new Error(`Нет таблицы ${table}`);
    if (table === 'app_settings') return rows;
    if (table === 'oge_tasks_public') return db.oge_tasks.map(({ answer, solution, solution_image_path, source, ...t }) => t);
    if (me.role === 'tutor') return rows;
    if (table === 'telegram_links') return rows.filter((r) => r.user_id === me.id);
    if (['invitations', 'private_notes', 'lessons', 'library_items', 'oge_tasks', 'oge_templates'].includes(table)) return [];
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

    async select(table, opts = {}) {
      await tick();
      const { limit } = opts;
      let rows = filterRows(table, opts);
      if (limit) rows = rows.slice(0, limit);
      return clone(rows);
    },
    async page(table, { from = 0, to = 24, ...opts } = {}) {
      await tick();
      const rows = filterRows(table, opts);
      return { rows: clone(rows.slice(from, to + 1)), count: rows.length };
    },
    async insertMany(table, rows) { const out = []; for (const r of rows) out.push(await this.insert(table, r)); return out; },
    async dumpAll(table) { return clone(visible(table)); },
    async insert(table, row) {
      await tick();
      if (me.role !== 'tutor' && table !== 'submissions' && !(['board_items', 'board_pages'].includes(table) && me.role === 'student')) throw new Error('Нет доступа');
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
        if (table === 'board_items' && me.role === 'student') { Object.assign(x, patch); return clone(x); }
        if (table !== 'submissions' || x.reviewed_at) throw new Error('Нет доступа');
        patch = { answer: patch.answer, file_path: patch.file_path ?? x.file_path, submitted_at: new Date().toISOString() };
      }
      Object.assign(x, patch, { updated_at: new Date().toISOString() });
      if (table === 'profiles' && id === me.id) Object.assign(me, x);
      return clone(x);
    },
    subscribe(_t, _f, _cb, onStatus) { setTimeout(() => onStatus?.('SUBSCRIBED')); return () => {}; },
    live() { return { send() {}, close() {} }; },
    async removeWhere(table, eq) { await tick(); db[table] = db[table].filter((r) => !Object.entries(eq).every(([k, v]) => r[k] === v)); },
    async remove(table, id) {
      await tick();
      if (me.role !== 'tutor' && !(table === 'board_items' && me.role === 'student')) throw new Error('Нет доступа');
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
      if (fn === 'game_state' || fn === 'game_claim') {
        const titles = { 6: 'Действия с дробями', 7: 'Числовая прямая', 8: 'Степени и корни', 9: 'Уравнения', 10: 'Вероятность', 11: 'Графики функций', 12: 'Расчёты по формулам', 13: 'Неравенства', 14: 'Прогрессии', 15: 'Треугольники', 16: 'Окружность', 17: 'Четырёхугольники', 18: 'Фигуры на клетках', 19: 'Верные утверждения', 20: 'Уравнения и системы', 21: 'Текстовая задача' };
        // [уровень 0–3, попыток, точность, точность за 20, потускнело] и подтемы: [тема, верных, попыток]
        const st = { 6: [3, 31, 100, 95], 7: [3, 27, 90, 92, true], 8: [2, 18, 90, 85], 9: [1, 9, 70, 66], 10: [0, 3, 33, 33], 15: [1, 7, 71, 71] };
        const TOP = { 6: [['Обыкновенные дроби', 6, 6], ['Десятичные дроби', 5, 5]], 8: [['Степени', 5, 5], ['Корни', 4, 5]],
          9: [['Линейные уравнения', 4, 4], ['Квадратные уравнения', 2, 4], ['Дробно-рациональные', 0, 1], ['Неполные квадратные', 0, 0]],
          10: [['Монеты и кубики', 1, 2], ['Выбор из группы', 0, 1], ['Противоположное событие', 0, 0]],
          15: [['Углы треугольника', 3, 3], ['Пифагор', 1, 2], ['Площадь', 0, 2], ['Равнобедренный', 0, 0]],
          16: [['Вписанные углы', 0, 0], ['Касательная', 0, 0], ['Хорды', 0, 0]] };
        db.game_claims = db.game_claims || [];
        if (fn === 'game_claim') db.game_claims.push({ id: uid(), reward_id: args.p_reward, status: 'requested' });
        const claimOf = (id) => db.game_claims.find((c) => c.reward_id === id)?.status || null;
        return {
          streak: { current: 5, best: 8, freezes: 1, done_today: false },
          xp: { total: 340, level: 3, level_from: 200, level_to: 450 },
          map: Object.entries(titles).map(([n, t]) => ({ subject: 'Математика', num: +n, title: t,
            module: n <= 14 ? 'Алгебра' : n <= 19 ? 'Геометрия' : 'Вторая часть',
            level: st[n] ? (st[n][4] ? 2 : st[n][0]) : 0, stale: !!st[n]?.[4], attempts: st[n]?.[1] || 0, accuracy: st[n]?.[2] ?? null, acc20: st[n]?.[3] ?? null,
            correct: st[n] ? Math.round((st[n][1] * st[n][2]) / 100) : 0,
            status: st[n]?.[0] === 3 && !st[n][4] ? 'done' : st[n] ? 'active' : 'locked',
            topics: (TOP[n] || []).map(([topic, correct, attempts]) => ({ topic, correct, attempts, done: correct >= 3 && correct >= attempts - 1 })) })),
          rewards: [['warmup', 'Разогрев', 'Значок: 3 дня подряд', '🔥', 3], ['freepass', 'Free Pass', 'ДЗ на день позже без штрафа', '🎟️', 7],
            ['extra', 'Разбор вне урока', '10 минут разбора в Telegram', '💬', 14], ['lesson', 'Бонусное занятие', '30 минут бесплатно', '🏆', 30]]
            .map(([id, title, description, icon, need]) => ({ id, code: id, title, description, icon, need, unlocked: 8 >= need, claim: claimOf(id) })),
        };
      }
      // Тренировка навыков: раунды в памяти, у Ани — немного истории для красивого прогресса
      if (fn === 'drill_state' || fn === 'drill_finish' || fn === 'drill_stats') {
        if (!db.drill_rounds) {
          const ago = (d) => new Date(now - d * day).toISOString();
          db.drill_rounds = [[ 'mul', [14, 17, 16, 21, 24, 23, 27] ], [ 'frac', [6, 8, 7, 11] ], [ 'derive', [5, 9, 12] ], [ 'trig', [9] ]]
            .flatMap(([skill, arr]) => arr.map((score, i) => ({ student_id: 's-anya', skill, score, total: score + 3, created_at: ago(arr.length - i) })));
        }
        const sid = fn === 'drill_stats' ? args.p_student : myStudents()[0];
        if (fn === 'drill_finish') {
          if (me.role !== 'student') return null;
          db.drill_rounds.push({ student_id: sid, skill: args.p_skill, score: args.p_score, total: args.p_total, created_at: new Date().toISOString() });
        }
        const mine = db.drill_rounds.filter((r) => r.student_id === sid);
        const bySkill = {};
        for (const r of mine) (bySkill[r.skill] ||= []).push(r);
        const best = (k) => Math.max(...bySkill[k].map((r) => r.score));
        if (fn === 'drill_state') return Object.fromEntries(Object.keys(bySkill).map((k) => [k, best(k)]));
        if (fn === 'drill_finish') return { best: best(args.p_skill), xp: Math.min(args.p_score, 20), streak: args.p_score >= 5, capped: false };
        const week = mine.filter((r) => r.created_at >= new Date(now - 7 * day).toISOString());
        return {
          skills: Object.entries(bySkill).map(([skill, rs]) => {
            const last = rs.slice(-12);
            return { skill, best: best(skill), rounds: rs.length, last_at: rs[rs.length - 1].created_at, recent: last.map((r) => r.score),
              acc: Math.round((100 * last.reduce((a, r) => a + r.score, 0)) / last.reduce((a, r) => a + r.total, 0)) };
          }).sort((a, b) => b.last_at.localeCompare(a.last_at)),
          week_rounds: week.length, week_correct: week.reduce((a, r) => a + r.score, 0),
          week_days: new Set(week.map((r) => r.created_at.slice(0, 10))).size, total_rounds: mine.length,
        };
      }
      if (fn === 'tg_create_link') {
        // демо: «пользователь нажал Start» через 4 секунды
        setTimeout(() => {
          db.telegram_links = db.telegram_links.filter((l) => l.user_id !== me.id);
          db.telegram_links.push({ user_id: me.id, chat_id: 2000, tg_username: 'demo_user', tg_name: me.full_name, notify: true, linked_at: new Date().toISOString() });
        }, 4000);
        return 'DEMO1234ABCD5678';
      }
      if (fn === 'tg_unlink') { db.telegram_links = db.telegram_links.filter((l) => l.user_id !== me.id); return null; }
      if (fn === 'tg_set_notify') { const l = db.telegram_links.find((x) => x.user_id === me.id); if (l) l.notify = args.p_on; return null; }
      if (fn === 'tg_test') return null;
      if (fn === 'mock_create') {
        if (me.role !== 'student') throw new Error('Пробник может начать только ученик');
        const sid = myStudents()[0], subj = args.p_subject;
        const open = db.oge_sets.find((s) => s.kind === 'mock' && s.student_id === sid && s.subject === subj && !s.finished_at);
        if (open) return open.id;
        const ids = [];   // в демо — по задаче на каждый номер, который есть в демо-банке
        for (let n = 1; n <= (subj === 'Математика' ? 25 : 22); n++) {
          const all = db.oge_tasks.filter((t) => t.subject === subj && t.num === n);
          if (all.length) ids.push(all[Math.floor(Math.random() * all.length)].id);
        }
        const s = { id: uid(), student_id: sid, subject: subj, kind: 'mock', title: 'Пробный экзамен (демо)', task_ids: ids,
          duration_min: subj === 'Математика' ? 235 : 180, finished_at: null, created_at: new Date().toISOString() };
        db.oge_sets.push(s); return s.id;
      }
      if (fn === 'oge_num_stats') {
        const st = {};
        for (const a of db.oge_attempts.filter((x) => x.student_id === args.p_student)) {
          const t = db.oge_tasks.find((x) => x.id === a.task_id); if (!t) continue;
          const k = `${t.subject}|${t.num}`; const v = (st[k] ||= { subject: t.subject, num: t.num, tried: new Set(), ok: new Set() });
          v.tried.add(a.task_id); if (a.is_correct || (a.points != null && a.points >= a.max_points)) v.ok.add(a.task_id);
        }
        return Object.values(st).map((v) => ({ subject: v.subject, num: v.num, tried: v.tried.size, ok: v.ok.size }));
      }
      if (fn === 'oge_autopick') {
        const have = new Set(args.p_have || []); const out = [];
        for (let n = Math.min(args.p_from, args.p_to); n <= Math.max(args.p_from, args.p_to); n++) {
          const pool = db.oge_tasks.filter((t) => t.subject === args.p_subject && t.num === n);
          const need = args.p_per - pool.filter((t) => have.has(t.id)).length;
          pool.filter((t) => !have.has(t.id)).sort(() => Math.random() - 0.5).slice(0, Math.max(0, need)).forEach((t) => out.push(t.id));
        }
        return out;
      }
      if (fn === 'consent_state') return { version: 'demo', pd: me.role === 'tutor' || !!db.consents?.includes(me.id) };
      if (fn === 'consent_accept') { (db.consents ||= []).push(me.id); return { ok: true }; }
      if (fn === 'mock_review') {
        const s = db.oge_sets.find((x) => x.id === args.p_set);
        return db.oge_tasks.filter((t) => s.task_ids.includes(t.id)).map((t) => ({ id: t.id, answer: t.answer.split('|')[0], solution: t.solution, solution_image_path: t.solution_image_path || null }));
      }
      if (fn === 'mock_finish') { const s = db.oge_sets.find((x) => x.id === args.p_set); if (s && !s.finished_at) s.finished_at = new Date().toISOString(); return { ok: true }; }
      // Работа над ошибками и задание дня (как srs_due / daily_quest в базе, упрощённо)
      if (fn === 'srs_due' || fn === 'daily_quest') {
        const sid = myStudents()[0];
        if (me.role !== 'student' || !sid) return null;
        const pub = ({ answer, solution, solution_image_path, source, ...t }) => t;
        const mine = db.oge_attempts.filter((a) => a.student_id === sid && a.reviewed_at);
        const last = {}; for (const a of mine.sort((x, y) => (x.created_at > y.created_at ? 1 : -1))) last[a.task_id] = a;
        if (fn === 'srs_due') {
          const wrong = Object.values(last).filter((a) => !a.is_correct).map((a) => db.oge_tasks.find((t) => t.id === a.task_id)).filter(Boolean);
          const extra = db.oge_tasks.filter((t) => t.answer_type === 'short' && !last[t.id]).slice(0, Math.max(0, 3 - wrong.length));   // в демо — пара задач для вида
          const due = [...wrong, ...extra];
          return { due: due.length, waiting: 2, mastered: 4, next_at: new Date(now + 2 * day).toISOString(), tasks: due.slice(0, args?.p_limit ?? 20).map((t) => ({ ...pub(t), step: 0 })) };
        }
        db.quest ||= { ids: db.oge_tasks.filter((t) => t.answer_type === 'short').slice(0, 3).map((t) => t.id), skill: 'frac', rewarded: false };
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tasks = db.quest.ids.map((id) => db.oge_tasks.find((t) => t.id === id)).filter(Boolean).map((t) => {
          const at = mine.filter((a) => a.task_id === t.id && a.answer != null && new Date(a.created_at) >= today);
          return { ...pub(t), done: at.length > 0, ok: at.some((a) => a.is_correct) };
        });
        const skillDone = (db.drill_rounds || []).some((r) => r.student_id === sid && r.skill === db.quest.skill && new Date(r.created_at) >= today);
        const done = tasks.filter((t) => t.done).length + (skillDone ? 1 : 0), total = tasks.length + 1, complete = done === total;
        const rewardedNow = complete && !db.quest.rewarded; if (complete) db.quest.rewarded = true;
        return { day: today.toISOString().slice(0, 10), tasks, skill: db.quest.skill, skill_done: skillDone, done, total, complete, rewarded_now: rewardedNow };
      }
      if (fn === 'trainer_check' || fn === 'trainer_reveal') {
        const t = db.oge_tasks.find((x) => x.id === args.p_task);
        if (!t) throw new Error('Задача не найдена');
        const reveal = { answer: t.answer.split('|')[0], solution: t.solution, solution_image_path: null };
        if (fn === 'trainer_reveal') return reveal;
        if (me.role !== 'student') throw new Error('Решать задачи может только ученик');
        const sid = myStudents()[0];
        const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/,/g, '.').replace(/\s+/g, '');
        if (t.answer_type === 'full' && args.p_answer != null) {
          db.oge_attempts.push({ id: uid(), task_id: t.id, student_id: sid, user_id: me.id, set_id: args.p_set, answer: args.p_answer, file_path: args.p_file, is_correct: null, points: null, max_points: t.max_points, created_at: new Date().toISOString() });
          return { pending: true };
        }
        const ok = args.p_answer != null && t.answer.split('|').some((v) => norm(v) === norm(args.p_answer) || (+norm(v) === +norm(args.p_answer) && norm(args.p_answer) !== ''));
        db.oge_attempts.push({ id: uid(), task_id: t.id, student_id: sid, user_id: me.id, set_id: args.p_set, answer: args.p_answer, is_correct: ok, points: ok ? t.max_points : 0, max_points: t.max_points, reviewed_at: new Date().toISOString(), created_at: new Date().toISOString() });
        if (db.oge_sets.find((x) => x.id === args.p_set)?.kind === 'mock') return { saved: true };
        return { correct: ok, ...reveal };
      }
      throw new Error('В демо-режиме коды приглашений не принимаются');
    },
    async upload(path, file) { await tick(); files.set(path, URL.createObjectURL(file)); return path; },
    async fileUrl(path) { return files.get(path) || '#'; },
    async removeFile(path) { files.delete(path); },
  };
}
