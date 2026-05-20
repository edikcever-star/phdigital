/**
 * ИНИЦИАЛИЗАЦИЯ СХЕМЫ БАЗЫ ДАННЫХ
 *
 * Вместо файловых миграций используем прямое создание таблиц через SQL.
 * Это проще для локального деплоя без сложной инфраструктуры миграций.
 *
 * Логика idempotent: CREATE TABLE IF NOT EXISTS — безопасно запускать повторно.
 * При первом запуске создаёт все таблицы и заполняет начальные данные.
 *
 * Вызывается из server/index.ts при старте приложения.
 */

import { sqlite } from "./connection";
import { log } from "../index";

export function initializeDatabase(): void {
  log("Инициализация базы данных...", "db");

  // Создаём все таблицы в правильном порядке (с учётом внешних ключей)
  sqlite.exec(`
    -- ============================================================
    -- ПОЛЬЗОВАТЕЛИ
    -- ============================================================
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT    NOT NULL,
      role         TEXT    NOT NULL DEFAULT 'tech_secretary',
      pin_hash     TEXT,
      is_active    INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ============================================================
    -- СПРАВОЧНИК СУДЕЙ
    -- ============================================================
    CREATE TABLE IF NOT EXISTS judges (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name    TEXT    NOT NULL,
      category     TEXT,
      default_role TEXT,
      is_active    INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ============================================================
    -- СПРАВОЧНИК КАРТ (CS2)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS maps (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      image_path TEXT,
      is_active  INTEGER NOT NULL DEFAULT 1
    );

    -- ============================================================
    -- СПРАВОЧНИК НАРУШЕНИЙ
    -- ============================================================
    CREATE TABLE IF NOT EXISTS violation_types (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      article     TEXT    NOT NULL,
      description TEXT    NOT NULL,
      penalty_pts REAL    NOT NULL DEFAULT 0,
      vtype       TEXT    NOT NULL DEFAULT 'other',
      is_active   INTEGER NOT NULL DEFAULT 1
    );

    -- ============================================================
    -- ГЛОБАЛЬНЫЕ КОМАНДЫ
    -- ============================================================
    CREATE TABLE IF NOT EXISTS global_teams (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      region      TEXT,
      notes       TEXT,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS global_team_players (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id          INTEGER NOT NULL REFERENCES global_teams(id) ON DELETE CASCADE,
      full_name        TEXT    NOT NULL,
      number           INTEGER,
      position         TEXT,
      is_reserve       INTEGER NOT NULL DEFAULT 0,
      notes            TEXT
    );

    CREATE TABLE IF NOT EXISTS global_team_officials (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id   INTEGER NOT NULL REFERENCES global_teams(id) ON DELETE CASCADE,
      full_name TEXT    NOT NULL,
      role      TEXT    NOT NULL
    );

    -- ============================================================
    -- СОРЕВНОВАНИЯ
    -- ============================================================
    CREATE TABLE IF NOT EXISTS competitions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      start_date TEXT    NOT NULL,
      end_date   TEXT    NOT NULL,
      venue      TEXT,
      format     TEXT    NOT NULL DEFAULT 'olympic',
      status     TEXT    NOT NULL DEFAULT 'active',
      created_by INTEGER REFERENCES users(id),
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS competition_settings (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id         INTEGER NOT NULL UNIQUE REFERENCES competitions(id) ON DELETE CASCADE,
      digital_rounds_half1   INTEGER NOT NULL DEFAULT 12,
      digital_rounds_half2   INTEGER NOT NULL DEFAULT 12,
      overtime_enabled       INTEGER NOT NULL DEFAULT 1,
      overtime_type          TEXT    NOT NULL DEFAULT 'MR3',
      digital_round_win_pts  REAL    NOT NULL DEFAULT 1,
      phys_total_rounds      INTEGER NOT NULL DEFAULT 12,
      phys_side_switch_round INTEGER NOT NULL DEFAULT 6,
      phys_activation_pts    REAL    NOT NULL DEFAULT 2,
      phys_explosion_pts     REAL    NOT NULL DEFAULT 3,
      phys_deactivation_pts  REAL    NOT NULL DEFAULT 1,
      phys_frag_win_pts      REAL    NOT NULL DEFAULT 1,
      digital_weight         REAL    NOT NULL DEFAULT 1.0,
      physical_weight        REAL    NOT NULL DEFAULT 1.0
    );

    CREATE TABLE IF NOT EXISTS competition_staff (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
      judge_id       INTEGER NOT NULL REFERENCES judges(id),
      staff_role     TEXT    NOT NULL
    );

    -- ============================================================
    -- КОМАНДЫ СОРЕВНОВАНИЯ (локальный снимок)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS competition_teams (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id   INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
      global_team_id   INTEGER REFERENCES global_teams(id),
      name             TEXT    NOT NULL,
      region           TEXT,
      snapshot_locked  INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS competition_team_players (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      comp_team_id     INTEGER NOT NULL REFERENCES competition_teams(id) ON DELETE CASCADE,
      global_player_id INTEGER REFERENCES global_team_players(id),
      full_name        TEXT    NOT NULL,
      number           INTEGER,
      position         TEXT,
      is_reserve       INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS competition_team_officials (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      comp_team_id INTEGER NOT NULL REFERENCES competition_teams(id) ON DELETE CASCADE,
      full_name    TEXT    NOT NULL,
      role         TEXT    NOT NULL
    );

    -- ============================================================
    -- МАТЧИ
    -- ============================================================
    CREATE TABLE IF NOT EXISTS matches (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id        INTEGER NOT NULL REFERENCES competitions(id),
      match_number          TEXT,
      stage                 TEXT,
      scheduled_at          TEXT,
      expected_viewers      INTEGER,
      status                TEXT    NOT NULL DEFAULT 'draft',
      winner_team_id        INTEGER REFERENCES competition_teams(id),
      score_digital_team1   REAL,
      score_digital_team2   REAL,
      score_physical_team1  REAL,
      score_physical_team2  REAL,
      score_total_team1     REAL,
      score_total_team2     REAL,
      created_by            INTEGER REFERENCES users(id),
      approved_by           INTEGER REFERENCES users(id),
      approved_at           TEXT,
      locked_by             INTEGER REFERENCES users(id),
      locked_at             TEXT,
      created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS match_status_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id    INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      from_status TEXT,
      to_status   TEXT    NOT NULL,
      changed_by  INTEGER REFERENCES users(id),
      note        TEXT,
      changed_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS match_staff (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id   INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      judge_id   INTEGER NOT NULL REFERENCES judges(id),
      staff_role TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS match_teams (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id             INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      comp_team_id         INTEGER NOT NULL REFERENCES competition_teams(id),
      team_slot            INTEGER NOT NULL,
      digital_start_side   TEXT,
      physical_start_side  TEXT,
      UNIQUE(match_id, team_slot)
    );

    CREATE TABLE IF NOT EXISTS match_team_players (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id       INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      comp_team_id   INTEGER NOT NULL REFERENCES competition_teams(id),
      comp_player_id INTEGER REFERENCES competition_team_players(id),
      full_name      TEXT    NOT NULL,
      number         INTEGER,
      is_reserve     INTEGER NOT NULL DEFAULT 0,
      is_active      INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS match_team_officials (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id     INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      comp_team_id INTEGER NOT NULL REFERENCES competition_teams(id),
      full_name    TEXT    NOT NULL,
      role         TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS match_map_veto (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id    INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      action      TEXT    NOT NULL,
      team_slot   INTEGER NOT NULL,
      map_id      INTEGER REFERENCES maps(id),
      side        TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ============================================================
    -- ЦИФРОВОЙ ЭТАП
    -- ============================================================
    CREATE TABLE IF NOT EXISTS digital_rounds (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id       INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      round_number   INTEGER NOT NULL,
      half           INTEGER NOT NULL DEFAULT 1,
      team1_side     TEXT    NOT NULL DEFAULT 'T',
      team2_side     TEXT    NOT NULL DEFAULT 'CT',
      activation     INTEGER NOT NULL DEFAULT 0,
      explosion      INTEGER NOT NULL DEFAULT 0,
      deactivation   INTEGER NOT NULL DEFAULT 0,
      result         TEXT,
      winner_team_id INTEGER REFERENCES competition_teams(id),
      win_type       TEXT,
      points_awarded REAL    NOT NULL DEFAULT 0,
      note           TEXT,
      status         TEXT    NOT NULL DEFAULT 'pending',
      extra_data     TEXT,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(match_id, round_number)
    );

    CREATE TABLE IF NOT EXISTS digital_round_player_stats (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      digital_round_id INTEGER NOT NULL REFERENCES digital_rounds(id) ON DELETE CASCADE,
      match_player_id  INTEGER NOT NULL REFERENCES match_team_players(id) ON DELETE CASCADE,
      comp_team_id     INTEGER NOT NULL REFERENCES competition_teams(id),
      kills            INTEGER NOT NULL DEFAULT 0,
      deaths           INTEGER NOT NULL DEFAULT 0,
      alive_end        INTEGER NOT NULL DEFAULT 1,
      extra_stats      TEXT,
      UNIQUE(digital_round_id, match_player_id)
    );

    CREATE TABLE IF NOT EXISTS digital_match_team_stats (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id     INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      comp_team_id INTEGER NOT NULL REFERENCES competition_teams(id),
      rounds_won   INTEGER NOT NULL DEFAULT 0,
      rounds_lost  INTEGER NOT NULL DEFAULT 0,
      total_kills  INTEGER NOT NULL DEFAULT 0,
      total_deaths INTEGER NOT NULL DEFAULT 0,
      total_points REAL    NOT NULL DEFAULT 0,
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(match_id, comp_team_id)
    );

    -- ============================================================
    -- ФИЗИЧЕСКИЙ ЭТАП
    -- ============================================================
    CREATE TABLE IF NOT EXISTS physical_rounds (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id       INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      round_number   INTEGER NOT NULL,
      team1_side     TEXT    NOT NULL DEFAULT 'attack',
      team2_side     TEXT    NOT NULL DEFAULT 'defense',
      frags_team1    INTEGER NOT NULL DEFAULT 0,
      frags_team2    INTEGER NOT NULL DEFAULT 0,
      activation     INTEGER NOT NULL DEFAULT 0,
      explosion      INTEGER NOT NULL DEFAULT 0,
      deactivation   INTEGER NOT NULL DEFAULT 0,
      win_type       TEXT,
      winner_team_id INTEGER REFERENCES competition_teams(id),
      points_awarded REAL    NOT NULL DEFAULT 0,
      penalty_points REAL    NOT NULL DEFAULT 0,
      note           TEXT,
      status         TEXT    NOT NULL DEFAULT 'pending',
      extra_data     TEXT,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(match_id, round_number)
    );

    CREATE TABLE IF NOT EXISTS physical_round_player_stats (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      physical_round_id INTEGER NOT NULL REFERENCES physical_rounds(id) ON DELETE CASCADE,
      match_player_id   INTEGER NOT NULL REFERENCES match_team_players(id) ON DELETE CASCADE,
      comp_team_id      INTEGER NOT NULL REFERENCES competition_teams(id),
      frags             INTEGER NOT NULL DEFAULT 0,
      deaths            INTEGER NOT NULL DEFAULT 0,
      extra_stats       TEXT,
      UNIQUE(physical_round_id, match_player_id)
    );

    -- ============================================================
    -- НАРУШЕНИЯ И ЗАМЕНЫ
    -- ============================================================
    CREATE TABLE IF NOT EXISTS match_violations (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id           INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      comp_team_id       INTEGER NOT NULL REFERENCES competition_teams(id),
      match_player_id    INTEGER REFERENCES match_team_players(id),
      violation_type_id  INTEGER REFERENCES violation_types(id),
      phase              TEXT    NOT NULL DEFAULT 'general',
      round_number       INTEGER,
      penalty_pts        REAL    NOT NULL DEFAULT 0,
      note               TEXT,
      registered_by      INTEGER REFERENCES users(id),
      created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS match_substitutions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id        INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      comp_team_id    INTEGER NOT NULL REFERENCES competition_teams(id),
      player_out_id   INTEGER NOT NULL REFERENCES match_team_players(id),
      player_in_id    INTEGER NOT NULL REFERENCES match_team_players(id),
      phase           TEXT    NOT NULL,
      round_number    INTEGER,
      reason          TEXT,
      note            TEXT,
      registered_by   INTEGER REFERENCES users(id),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ============================================================
    -- ДОКУМЕНТЫ
    -- ============================================================
    CREATE TABLE IF NOT EXISTS documents (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id      INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      doc_type      TEXT    NOT NULL,
      version       INTEGER NOT NULL DEFAULT 1,
      file_path     TEXT    NOT NULL,
      file_size     INTEGER,
      generated_by  INTEGER REFERENCES users(id),
      generated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      is_current    INTEGER NOT NULL DEFAULT 1
    );

    -- ============================================================
    -- ИСТОРИЯ ИМПОРТОВ
    -- ============================================================
    CREATE TABLE IF NOT EXISTS import_history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id     INTEGER REFERENCES matches(id),
      import_type  TEXT    NOT NULL,
      filename     TEXT    NOT NULL,
      file_size    INTEGER,
      status       TEXT    NOT NULL DEFAULT 'pending',
      rows_total   INTEGER,
      rows_imported INTEGER,
      error_log    TEXT,
      imported_by  INTEGER REFERENCES users(id),
      source       TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    -- ============================================================
    -- AUDIT LOG
    -- ============================================================
    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES users(id),
      action      TEXT    NOT NULL,
      entity_type TEXT    NOT NULL,
      entity_id   INTEGER,
      old_data    TEXT,
      new_data    TEXT,
      ip_address  TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ============================================================
    -- PRESENCE
    -- ============================================================
    CREATE TABLE IF NOT EXISTS presence_sessions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      match_id     INTEGER REFERENCES matches(id),
      socket_id    TEXT    NOT NULL UNIQUE,
      current_view TEXT,
      is_editing   TEXT,
      connected_at TEXT    NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  log("Таблицы созданы (или уже существуют)", "db");

  // Заполняем начальные данные если БД пустая
  seedInitialData();

  log("База данных готова к работе", "db");
}

/**
 * Начальное заполнение справочников.
 * Используем INSERT OR IGNORE — безопасно при повторном запуске.
 */
function seedInitialData(): void {
  // Стандартные карты CS2
  const defaultMaps = [
    "Mirage", "Inferno", "Dust2", "Nuke", "Overpass",
    "Vertigo", "Ancient", "Anubis", "Cache", "Train",
  ];

  for (const mapName of defaultMaps) {
    sqlite.prepare(
      "INSERT OR IGNORE INTO maps (name, is_active) VALUES (?, 1)"
    ).run(mapName);
  }

  // Стандартные типы нарушений
  const defaultViolations = [
    { article: "1.1", description: "Неспортивное поведение", penalty_pts: 1, vtype: "warning" },
    { article: "1.2", description: "Грубое нарушение регламента", penalty_pts: 3, vtype: "technical" },
    { article: "2.1", description: "Использование запрещённого оборудования", penalty_pts: 5, vtype: "disqualification" },
    { article: "3.1", description: "Опоздание на матч", penalty_pts: 1, vtype: "warning" },
    { article: "3.2", description: "Неявка на матч", penalty_pts: 0, vtype: "disqualification" },
  ];

  for (const v of defaultViolations) {
    sqlite.prepare(
      "INSERT OR IGNORE INTO violation_types (article, description, penalty_pts, vtype) VALUES (?, ?, ?, ?)"
    ).run(v.article, v.description, v.penalty_pts, v.vtype);
  }

  // Создаём системного пользователя (главный судья по умолчанию)
  const existingAdmin = sqlite
    .prepare("SELECT id FROM users WHERE role = 'chief_judge' LIMIT 1")
    .get();

  if (!existingAdmin) {
    sqlite
      .prepare(
        "INSERT INTO users (display_name, role, is_active) VALUES (?, ?, 1)"
      )
      .run("Главный судья", "chief_judge");
    log("Создан пользователь по умолчанию: Главный судья", "db");
  }
}
