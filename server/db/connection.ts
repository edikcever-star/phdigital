/**
 * ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ SQLite
 *
 * Настройки для надёжной работы на локальном сервере:
 * - WAL mode: множество читателей, один писатель
 * - foreign_keys: обеспечивают целостность ссылок
 * - busy_timeout: ждём освобождения блокировки вместо ошибки
 * - synchronous = NORMAL: баланс скорости и надёжности
 *
 * ВАЖНО: SQLite — синхронная БД. Drizzle better-sqlite3 driver
 * использует синхронные методы (.get(), .all(), .run()).
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { join } from "path";
import * as schema from "../../shared/schema";

// Путь к файлу БД — рядом с сервером, в корне проекта
const DB_PATH = join(process.cwd(), "phdigital.db");

// Создаём экземпляр SQLite с оптимальными настройками
const sqlite = new Database(DB_PATH);

// --- Обязательные PRAGMA для надёжной работы ---

// WAL mode: позволяет множеству читателей работать параллельно с одним писателем
sqlite.pragma("journal_mode = WAL");

// NORMAL: данные записываются при flush, но не при каждой операции
// Баланс между скоростью и надёжностью для локального сервера
sqlite.pragma("synchronous = NORMAL");

// Внешние ключи: без этого CASCADE DELETE и FK-constraints не работают
sqlite.pragma("foreign_keys = ON");

// Таймаут ожидания блокировки: 5 секунд (вместо немедленной ошибки SQLITE_BUSY)
sqlite.pragma("busy_timeout = 5000");

// WAL checkpoint автоматически: при достижении ~1000 страниц
sqlite.pragma("wal_autocheckpoint = 1000");

// Экземпляр Drizzle ORM с полной типизацией schema
export const db = drizzle(sqlite, { schema });

// --- АВТОМАТИЧЕСКИЙ ФИКС БАЗЫ ДАННЫХ ---
// Добавляем колонку planned_participants, если её нет в физической БД
try {
  sqlite.exec('ALTER TABLE competitions ADD COLUMN planned_participants INTEGER DEFAULT 0;');
  console.log('[db] Миграция: Колонка planned_participants успешно добавлена в таблицу competitions!');
} catch (err: any) {
  // Ошибка "duplicate column name" означает, что колонка уже есть — это нормально
  if (!err.message.includes('duplicate column name')) {
    console.error('[db] Ошибка авто-миграции:', err.message);
  }
}
// --- АВТОМАТИЧЕСКИЙ ФИКС ДЛЯ ФИДЖИТАЛ-ЭТАПОВ ---
try {
  sqlite.exec('ALTER TABLE match_team_players ADD COLUMN played_digital INTEGER NOT NULL DEFAULT 1;');
  console.log('[db] Миграция: Колонка played_digital успешно добавлена!');
} catch (err: any) {
  if (!err.message.includes('duplicate column name')) {
    console.error('[db] Ошибка авто-миграции played_digital:', err.message);
  }
}

try {
  sqlite.exec('ALTER TABLE match_team_players ADD COLUMN played_physical INTEGER NOT NULL DEFAULT 1;');
  console.log('[db] Миграция: Колонка played_physical успешно добавлена!');
} catch (err: any) {
  if (!err.message.includes('duplicate column name')) {
    console.error('[db] Ошибка авто-миграции played_physical:', err.message);
  }
}

export { sqlite };

export default db;