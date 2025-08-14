export const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  synchronize: process.env.ENVIRONMENT?.toLocaleLowerCase() !== 'prod',
  charset: 'utf8mb4',
  collation: 'utf8mb4_unicode_ci',
};

export const commands = {
  stat: '📊 Статистика',
  settings: '⚙️ Настройки',
  registration: '📋 Регистрация',
  search: '🔍 Поиск',
  admin: '⚙️ Админ панель',
  receive_money: '💸 Оформить получение',
};

export const MESSAGE_DELETE_DELAY = 86400000;
