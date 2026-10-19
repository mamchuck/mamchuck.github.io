// Настройки подключения к Supabase (Project Settings → API).
// Пока поля пустые, сайт работает в демо-режиме на вымышленных данных.
// anon key — публичный ключ, его можно хранить здесь. service_role key сюда НЕ вставлять!
export const CONFIG = {
  supabaseUrl: 'https://bjnnazomdmhlvrxdqdbu.supabase.co',
  supabaseAnonKey: 'sb_publishable_7J3P-GkefqTHuXKMYrV9qw_oCo58mT8',
};

// Данные преподавателя для шапки и кнопки связи.
export const TUTOR = {
  name: 'Илья Мамчук',
  initials: 'ИМ',
  title: 'Преподаватель физики и математики',
  telegram: 'mamchuck',
};
