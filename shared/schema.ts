/**
 * СХЕМА БАЗЫ ДАННЫХ — Протокол матча. Фиджитал-спорт v2
 *
 * Это единственный источник истины для структуры всех таблиц.
 * Drizzle ORM использует эту схему для генерации типов и миграций.
 *
 * Принципы:
 * - Все критические вычисления хранятся на сервере, а не в UI
 * - extra_data (JSON) используется для будущих расширений без ALTER TABLE
 * - Нормализованная модель: каждая сущность живёт в своей таблице
 * - Двухуровневая архитектура команд: global_teams → competition_teams
 * - Двухуровневая архитектура цифрового этапа: раунд + статистика игроков
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ТИПЫ (перечисления как union types)
// ============================================================

export type UserRole =
  | "chief_judge"
  | "chief_secretary"
  | "deputy_judge"
  | "tech_secretary";

export type MatchStatus =
  | "draft"
  | "setup"
  | "digital_phase"
  | "physical_phase"
  | "finished"
  | "approved"
  | "locked";

export type CompetitionStatus = "active" | "finished" | "archived";
export type CompetitionFormat = "olympic" | "round_robin" | "group_playoff";
export type DigitalSide = "T" | "CT";
export type PhysicalSide = "attack" | "defense";
export type RoundStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type WinTypeDigital =
  | "elimination"
  | "bomb_explode"
  | "bomb_defuse"
  | "time_out"
  | "technical";
export type WinTypePhysical =
  | "frag_win"
  | "activation"
  | "explosion"
  | "deactivation"
  | "technical";
export type ViolationType =
  | "warning"
  | "disqualification"
  | "technical"
  | "other";
export type Phase = "digital" | "physical" | "general";
export type MapVetoAction = "ban" | "pick" | "side_pick";
export type TeamSlot = 1 | 2;
export type ImportType =
  | "digital_player_stats"
  | "digital_rounds"
  | "teams"
  | "rosters";
export type ImportStatus =
  | "pending"
  | "preview"
  | "confirmed"
  | "cancelled"
  | "failed";
export type DocumentType = "match_protocol" | "match_summary";

// ============================================================
// ПОЛЬЗОВАТЕЛИ И СЕССИИ
// ============================================================

/**
 * Пользователи системы — судьи и секретари, работающие с приложением.
 * PIN хранится в хешированном виде (bcrypt не используется — используем
 * простой sha256 для скорости на локальном сервере без интернета).
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  displayName: text("display_name").notNull(),
  // Роль определяет права доступа. Проверяется на backend, не только на фронте.
  role: text("role")
    .$type<UserRole>()
    .notNull()
    .default("tech_secretary"),
  pinHash: text("pin_hash"), // NULL = без PIN-защиты
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ============================================================
// СПРАВОЧНИК СУДЕЙ (глобальный, не привязан к соревнованию)
// ============================================================

export const judges = sqliteTable("judges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  category: text("category"), // категория судьи (первая, вторая и т.д.)
  defaultRole: text("default_role"), // должность по умолчанию
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const insertJudgeSchema = createInsertSchema(judges).omit({
  id: true,
  createdAt: true,
});
export type InsertJudge = z.infer<typeof insertJudgeSchema>;
export type Judge = typeof judges.$inferSelect;

// ============================================================
// СПРАВОЧНИК КАРТ (CS2)
// ============================================================

export const maps = sqliteTable("maps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  imagePath: text("image_path"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const insertMapSchema = createInsertSchema(maps).omit({ id: true });
export type InsertMap = z.infer<typeof insertMapSchema>;
export type MapRecord = typeof maps.$inferSelect;

// ============================================================
// СПРАВОЧНИК ТИПОВ НАРУШЕНИЙ
// ============================================================

export const violationTypes = sqliteTable("violation_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  article: text("article").notNull(), // статья регламента
  description: text("description").notNull(),
  penaltyPts: real("penalty_pts").notNull().default(0),
  // Тип нарушения влияет на отображение в протоколе и возможные последствия
  vtype: text("vtype").$type<ViolationType>().notNull().default("other"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const insertViolationTypeSchema = createInsertSchema(
  violationTypes
).omit({ id: true });
export type InsertViolationType = z.infer<typeof insertViolationTypeSchema>;
export type ViolationTypeRecord = typeof violationTypes.$inferSelect;

// ============================================================
// ГЛОБАЛЬНАЯ БАЗА КОМАНД
// Это шаблонная база, которая служит источником при создании
// локальных команд в рамках соревнования.
// Изменения здесь НЕ влияют на уже созданные соревновательные команды.
// ============================================================

export const globalTeams = sqliteTable("global_teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  region: text("region"),
  notes: text("notes"),
  isArchived: integer("is_archived", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const insertGlobalTeamSchema = createInsertSchema(globalTeams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGlobalTeam = z.infer<typeof insertGlobalTeamSchema>;
export type GlobalTeam = typeof globalTeams.$inferSelect;

export const globalTeamPlayers = sqliteTable("global_team_players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id")
    .notNull()
    .references(() => globalTeams.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  number: integer("number"),
  position: text("position"),
  isReserve: integer("is_reserve", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
});

export const insertGlobalTeamPlayerSchema = createInsertSchema(
  globalTeamPlayers
).omit({ id: true });
export type InsertGlobalTeamPlayer = z.infer<
  typeof insertGlobalTeamPlayerSchema
>;
export type GlobalTeamPlayer = typeof globalTeamPlayers.$inferSelect;

export const globalTeamOfficials = sqliteTable("global_team_officials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id")
    .notNull()
    .references(() => globalTeams.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(), // тренер, капитан, представитель и т.д.
});

export const insertGlobalTeamOfficialSchema = createInsertSchema(
  globalTeamOfficials
).omit({ id: true });
export type InsertGlobalTeamOfficial = z.infer<
  typeof insertGlobalTeamOfficialSchema
>;
export type GlobalTeamOfficial = typeof globalTeamOfficials.$inferSelect;

// ============================================================
// СОРЕВНОВАНИЯ
// ============================================================

export const competitions = sqliteTable("competitions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  venue: text("venue"),

  // Плановое количество команд-участников.
  // Задаётся вручную при создании, автоматически не пересчитывается —
  // для реального подсчёта используй teamsCount из CompetitionWithSettings.
  plannedParticipants: integer("planned_participants"),

  format: text("format", { enum: ["olympic", "round_robin", "group_playoff"] }),
  status: text("status", { enum: ["active", "finished", "archived"] })
    .notNull()
    .default("active"),
  createdBy: integer("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const insertCompetitionSchema = createInsertSchema(competitions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;
export type Competition = typeof competitions.$inferSelect;

/**
 * Настройки этапов соревнования.
 * Хранятся отдельно от competitions, чтобы не раздувать основную таблицу.
 * Эти значения используются при расчёте очков на сервере.
 */
export const competitionSettings = sqliteTable("competition_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  competitionId: integer("competition_id")
    .notNull()
    .unique()
    .references(() => competitions.id, { onDelete: "cascade" }),
  // --- Цифровой этап (CS2) ---
  digitalRoundsHalf1: integer("digital_rounds_half1").notNull().default(12),
  digitalRoundsHalf2: integer("digital_rounds_half2").notNull().default(12),
  overtimeEnabled: integer("overtime_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  overtimeType: text("overtime_type").notNull().default("MR3"),
  digitalRoundWinPts: real("digital_round_win_pts").notNull().default(1),
  // --- Физический этап (лазертаг) ---
  physTotalRounds: integer("phys_total_rounds").notNull().default(12),
  physSideSwitchRound: integer("phys_side_switch_round").notNull().default(6),
  physActivationPts: real("phys_activation_pts").notNull().default(2),
  physExplosionPts: real("phys_explosion_pts").notNull().default(3),
  physDeactivationPts: real("phys_deactivation_pts").notNull().default(1),
  physFragWinPts: real("phys_frag_win_pts").notNull().default(1),
  // --- Балансировка весов этапов ---
  digitalWeight: real("digital_weight").notNull().default(1.0),
  physicalWeight: real("physical_weight").notNull().default(1.0),
});

export const insertCompetitionSettingsSchema = createInsertSchema(
  competitionSettings
).omit({ id: true });
export type InsertCompetitionSettings = z.infer<
  typeof insertCompetitionSettingsSchema
>;
export type CompetitionSettings = typeof competitionSettings.$inferSelect;

/**
 * Судейская бригада соревнования.
 * Выбирается из глобального справочника judges.
 * Эти данные автоматически подтягиваются при создании матча.
 */
export const competitionStaff = sqliteTable("competition_staff", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  competitionId: integer("competition_id")
    .notNull()
    .references(() => competitions.id, { onDelete: "cascade" }),
  judgeId: integer("judge_id")
    .notNull()
    .references(() => judges.id),
  staffRole: text("staff_role").notNull(), // chief_judge, secretary, deputy, tech_secretary
});

export const insertCompetitionStaffSchema = createInsertSchema(
  competitionStaff
).omit({ id: true });
export type InsertCompetitionStaff = z.infer<typeof insertCompetitionStaffSchema>;
export type CompetitionStaff = typeof competitionStaff.$inferSelect;

// ============================================================
// КОМАНДЫ СОРЕВНОВАНИЯ (локальный снимок)
// При добавлении команды в соревнование создаётся независимая копия.
// Изменения в этой копии не затрагивают globalTeams и другие соревнования.
// ============================================================

export const competitionTeams = sqliteTable("competition_teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  competitionId: integer("competition_id")
    .notNull()
    .references(() => competitions.id, { onDelete: "cascade" }),
  // Ссылка на глобальную команду-источник (может быть NULL если создано вручную)
  globalTeamId: integer("global_team_id").references(() => globalTeams.id),
  name: text("name").notNull(),
  region: text("region"),
  // После начала соревнования снимок блокируется от крупных изменений
  snapshotLocked: integer("snapshot_locked", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const insertCompetitionTeamSchema = createInsertSchema(
  competitionTeams
).omit({ id: true, createdAt: true });
export type InsertCompetitionTeam = z.infer<typeof insertCompetitionTeamSchema>;
export type CompetitionTeam = typeof competitionTeams.$inferSelect;

export const competitionTeamPlayers = sqliteTable("competition_team_players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  compTeamId: integer("comp_team_id")
    .notNull()
    .references(() => competitionTeams.id, { onDelete: "cascade" }),
  // Ссылка на оригинального игрока из глобальной базы (может быть NULL)
  globalPlayerId: integer("global_player_id").references(
    () => globalTeamPlayers.id
  ),
  fullName: text("full_name").notNull(),
  number: integer("number"),
  position: text("position"),
  isReserve: integer("is_reserve", { mode: "boolean" }).notNull().default(false),
  isCaptain: integer("is_captain", { mode: "boolean" }).notNull().default(false), 
});


export const insertCompetitionTeamPlayerSchema = createInsertSchema(
  competitionTeamPlayers
).omit({ id: true });
export type InsertCompetitionTeamPlayer = z.infer<
  typeof insertCompetitionTeamPlayerSchema
>;
export type CompetitionTeamPlayer = typeof competitionTeamPlayers.$inferSelect;

export const competitionTeamOfficials = sqliteTable(
  "competition_team_officials",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    compTeamId: integer("comp_team_id")
      .notNull()
      .references(() => competitionTeams.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    role: text("role").notNull(),
  }
);

export const insertCompetitionTeamOfficialSchema = createInsertSchema(
  competitionTeamOfficials
).omit({ id: true });
export type InsertCompetitionTeamOfficial = z.infer<
  typeof insertCompetitionTeamOfficialSchema
>;
export type CompetitionTeamOfficial =
  typeof competitionTeamOfficials.$inferSelect;







// ============================================================
// МАТЧИ
// ============================================================


/**
 * Матч — центральная сущность приложения.
 * Итоговые очки (score_*) вычисляются на сервере и кешируются здесь.
 * Никогда не считать их на клиенте и не передавать напрямую с фронта.
 */
export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  competitionId: integer("competition_id")
    .notNull()
    .references(() => competitions.id),
  matchNumber: text("match_number"), // номер матча или стадия ("1/4 финала")
  stage: text("stage"),
  scheduledAt: text("scheduled_at"),
  expectedViewers: integer("expected_viewers"),
  // Статус матча — ключевой управляющий параметр.
  // Переходы статусов строго контролируются в match.service.ts
  status: text("status").$type<MatchStatus>().notNull().default("draft"),
  // ID победителя (устанавливается сервером при финализации)
  winnerTeamId: integer("winner_team_id").references(() => competitionTeams.id),
  // Итоговые очки — вычисляются сервером, кешируются для быстрого чтения
  scoreDigitalTeam1: real("score_digital_team1"),
  scoreDigitalTeam2: real("score_digital_team2"),
  scorePhysicalTeam1: real("score_physical_team1"),
  scorePhysicalTeam2: real("score_physical_team2"),
  scoreTotalTeam1: real("score_total_team1"),
  scoreTotalTeam2: real("score_total_team2"),
  createdBy: integer("created_by").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: text("approved_at"),
  lockedBy: integer("locked_by").references(() => users.id),
  lockedAt: text("locked_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const insertMatchSchema = createInsertSchema(matches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  scoreDigitalTeam1: true,
  scoreDigitalTeam2: true,
  scorePhysicalTeam1: true,
  scorePhysicalTeam2: true,
  scoreTotalTeam1: true,
  scoreTotalTeam2: true,
  winnerTeamId: true,
});
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matches.$inferSelect;

/**
 * Журнал переходов статусов матча.
 * Ключевой элемент аудита — позволяет отследить кто и когда менял статус.
 */
export const matchStatusLog = sqliteTable("match_status_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  fromStatus: text("from_status").$type<MatchStatus | null>(),
  toStatus: text("to_status").$type<MatchStatus>().notNull(),
  changedBy: integer("changed_by").references(() => users.id),
  note: text("note"),
  changedAt: text("changed_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type MatchStatusLogEntry = typeof matchStatusLog.$inferSelect;

/**
 * Судейская бригада матча.
 * Автоматически заполняется из бригады соревнования, но может быть скорректирована.
 */
export const matchStaff = sqliteTable("match_staff", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  judgeId: integer("judge_id")
    .notNull()
    .references(() => judges.id),
  staffRole: text("staff_role").notNull(),
});

export const insertMatchStaffSchema = createInsertSchema(matchStaff).omit({
  id: true,
});
export type InsertMatchStaff = z.infer<typeof insertMatchStaffSchema>;
export type MatchStaff = typeof matchStaff.$inferSelect;

/**
 * Привязка команд к матчу.
 * team_slot = 1 или 2 — фиксированный порядок команд в протоколе.
 * Стартовые стороны определяются здесь и используются для инициализации раундов.
 */
export const matchTeams = sqliteTable("match_teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  compTeamId: integer("comp_team_id")
    .notNull()
    .references(() => competitionTeams.id),
  teamSlot: integer("team_slot").$type<TeamSlot>().notNull(), // 1 или 2
  digitalStartSide: text("digital_start_side").$type<DigitalSide>(),
  physicalStartSide: text("physical_start_side").$type<PhysicalSide>(),
});

export const insertMatchTeamSchema = createInsertSchema(matchTeams).omit({
  id: true,
});
export type InsertMatchTeam = z.infer<typeof insertMatchTeamSchema>;
export type MatchTeam = typeof matchTeams.$inferSelect;



/**
 * История бана/пика карт (в стиле CS2).
 * Каждый шаг вето записывается отдельной строкой с порядковым номером.
 */
export const matchMapVeto = sqliteTable("match_map_veto", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  action: text("action").$type<MapVetoAction>().notNull(),
  teamSlot: integer("team_slot").$type<TeamSlot>().notNull(),
  mapId: integer("map_id").references(() => maps.id),
  side: text("side").$type<DigitalSide>(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const insertMatchMapVetoSchema = createInsertSchema(matchMapVeto).omit({
  id: true,
  createdAt: true,
});
export type InsertMatchMapVeto = z.infer<typeof insertMatchMapVetoSchema>;
export type MatchMapVeto = typeof matchMapVeto.$inferSelect;

// ============================================================
// ИГРОКИ КОМАНДЫ НА МАТЧ (С ФИДЖИТАЛ-ЭТАПАМИ)
// ============================================================
export const matchTeamPlayers = sqliteTable("match_team_players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  compTeamId: integer("comp_team_id")
    .notNull()
    .references(() => competitionTeams.id),
  compPlayerId: integer("comp_player_id").references(
    () => competitionTeamPlayers.id
  ),
  fullName: text("full_name").notNull(),
  number: integer("number"),
  isReserve: integer("is_reserve", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  playedDigital: integer("played_digital", { mode: "boolean" }).notNull().default(true),
  playedPhysical: integer("played_physical", { mode: "boolean" }).notNull().default(true),
});

export const insertMatchTeamPlayerSchema = createInsertSchema(matchTeamPlayers).omit({ id: true });
export type InsertMatchTeamPlayer = z.infer<typeof insertMatchTeamPlayerSchema>;
export type MatchTeamPlayer = typeof matchTeamPlayers.$inferSelect;

// ============================================================
// ОФИЦИАЛЬНЫЕ ЛИЦА КОМАНДЫ (ТРЕНЕРЫ) НА МАТЧ
// ============================================================
export const matchTeamOfficials = sqliteTable("match_team_officials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  compTeamId: integer("comp_team_id")
    .notNull()
    .references(() => competitionTeams.id),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(),
});

export const insertMatchTeamOfficialSchema = createInsertSchema(matchTeamOfficials).omit({ id: true });
export type InsertMatchTeamOfficial = z.infer<typeof insertMatchTeamOfficialSchema>;
export type MatchTeamOfficial = typeof matchTeamOfficials.$inferSelect;


// ============================================================
// ЦИФРОВОЙ ЭТАП — ДВУХУРОВНЕВАЯ АРХИТЕКТУРА
// ============================================================

/**
 * Уровень 1: Базовый результат раунда цифрового этапа.
 *
 * Содержит всё необходимое для расчёта очков и построения протокола.
 * Поле extra_data (JSON) зарезервировано для расширений без изменения схемы:
 * MVP, plant_player_id, defuse_player_id и т.д.
 *
 * Важно: round_number уникален в рамках матча.
 */
export const digitalRounds = sqliteTable("digital_rounds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  half: integer("half").notNull().default(1),
  team1Side: text("team1_side").$type<DigitalSide>().notNull(),
  team2Side: text("team2_side").$type<DigitalSide>().notNull(),
  
  // ---> НОВЫЕ ПОЛЯ ДЛЯ ПОТЕРЬ ИГРОКОВ <---
  team1Deaths: integer("team1_deaths").default(0),
  team2Deaths: integer("team2_deaths").default(0),
  // ---------------------------------------

  activation: integer("activation", { mode: "boolean" }).notNull().default(false),
  explosion: integer("explosion", { mode: "boolean" }).notNull().default(false),
  deactivation: integer("deactivation", { mode: "boolean" })
    .notNull()
    .default(false),
  result: text("result"),
  winnerTeamId: integer("winner_team_id").references(() => competitionTeams.id),
  winType: text("win_type").$type<WinTypeDigital>(),
  pointsAwarded: real("points_awarded").notNull().default(0),
  note: text("note"),
  status: text("status").$type<RoundStatus>().notNull().default("pending"),
  extraData: text("extra_data"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const insertDigitalRoundSchema = createInsertSchema(digitalRounds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDigitalRound = z.infer<typeof insertDigitalRoundSchema>;
export type DigitalRound = typeof digitalRounds.$inferSelect;

/**
 * Уровень 2: Статистика игрока в конкретном раунде цифрового этапа.
 *
 * Этот уровень необязателен — базовый протокол работает без него.
 * При расширении (импорт из CS2, ручной ввод) здесь хранятся:
 * kills, deaths, alive/dead и другие метрики.
 *
 * extra_stats (JSON) для будущих полей: assists, headshots, MVP и т.д.
 */
export const digitalRoundPlayerStats = sqliteTable(
  "digital_round_player_stats",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    digitalRoundId: integer("digital_round_id")
      .notNull()
      .references(() => digitalRounds.id, { onDelete: "cascade" }),
    matchPlayerId: integer("match_player_id")
      .notNull()
      .references(() => matchTeamPlayers.id, { onDelete: "cascade" }),
    compTeamId: integer("comp_team_id")
      .notNull()
      .references(() => competitionTeams.id),
    kills: integer("kills").notNull().default(0),
    deaths: integer("deaths").notNull().default(0),
    // Жив ли игрок по итогу раунда
    aliveEnd: integer("alive_end", { mode: "boolean" }).notNull().default(true),
    // Зарезервировано для assists, headshots, MVP, plant, defuse
    extraStats: text("extra_stats"), // JSON
  }
);

export const insertDigitalRoundPlayerStatsSchema = createInsertSchema(
  digitalRoundPlayerStats
).omit({ id: true });
export type InsertDigitalRoundPlayerStats = z.infer<
  typeof insertDigitalRoundPlayerStatsSchema
>;
export type DigitalRoundPlayerStats =
  typeof digitalRoundPlayerStats.$inferSelect;

/**
 * Агрегированная статистика команды по цифровому этапу.
 * Вычисляется и обновляется сервером при каждом изменении раунда.
 * Хранится для быстрого чтения и построения протокола.
 */
export const digitalMatchTeamStats = sqliteTable("digital_match_team_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  compTeamId: integer("comp_team_id")
    .notNull()
    .references(() => competitionTeams.id),
  roundsWon: integer("rounds_won").notNull().default(0),
  roundsLost: integer("rounds_lost").notNull().default(0),
  totalKills: integer("total_kills").notNull().default(0),
  totalDeaths: integer("total_deaths").notNull().default(0),
  totalPoints: real("total_points").notNull().default(0),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type DigitalMatchTeamStats = typeof digitalMatchTeamStats.$inferSelect;

// ============================================================
// ФИЗИЧЕСКИЙ ЭТАП (ЛАЗЕРТАГ)
// ============================================================

/**
 * Раунды физического этапа.
 *
 * ВАЖНО: penalty_points — отдельное числовое поле.
 * Никогда не хранить штрафы в поле "minute" или других proxy-полях.
 *
 * extra_data (JSON) зарезервирован для расширения статистики.
 */
export const physicalRounds = sqliteTable("physical_rounds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  team1Side: text("team1_side").$type<PhysicalSide>().notNull(),
  team2Side: text("team2_side").$type<PhysicalSide>().notNull(),
  // Фраги команд в раунде
  fragsTeam1: integer("frags_team1").notNull().default(0),
  fragsTeam2: integer("frags_team2").notNull().default(0),
  // Флаги активности лазертага (A/P/D)
  activation: integer("activation", { mode: "boolean" }).notNull().default(false),
  explosion: integer("explosion", { mode: "boolean" }).notNull().default(false),
  deactivation: integer("deactivation", { mode: "boolean" })
    .notNull()
    .default(false),
  winType: text("win_type").$type<WinTypePhysical>(),
  winnerTeamId: integer("winner_team_id").references(() => competitionTeams.id),
  pointsAwarded: real("points_awarded").notNull().default(0),
  // Штрафные очки — ВСЕГДА в этом поле, никогда не в других
  penaltyPoints: real("penalty_points").notNull().default(0),
  note: text("note"),
  status: text("status").$type<RoundStatus>().notNull().default("pending"),
  extraData: text("extra_data"), // JSON для будущих расширений
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const insertPhysicalRoundSchema = createInsertSchema(
  physicalRounds
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPhysicalRound = z.infer<typeof insertPhysicalRoundSchema>;
export type PhysicalRound = typeof physicalRounds.$inferSelect;

export const physicalRoundPlayerStats = sqliteTable(
  "physical_round_player_stats",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    physicalRoundId: integer("physical_round_id")
      .notNull()
      .references(() => physicalRounds.id, { onDelete: "cascade" }),
    matchPlayerId: integer("match_player_id")
      .notNull()
      .references(() => matchTeamPlayers.id, { onDelete: "cascade" }),
    compTeamId: integer("comp_team_id")
      .notNull()
      .references(() => competitionTeams.id),
    frags: integer("frags").notNull().default(0),
    deaths: integer("deaths").notNull().default(0),
    extraStats: text("extra_stats"), // JSON
  }
);

export const insertPhysicalRoundPlayerStatsSchema = createInsertSchema(
  physicalRoundPlayerStats
).omit({ id: true });
export type InsertPhysicalRoundPlayerStats = z.infer<
  typeof insertPhysicalRoundPlayerStatsSchema
>;
export type PhysicalRoundPlayerStats =
  typeof physicalRoundPlayerStats.$inferSelect;

// ============================================================
// НАРУШЕНИЯ И ЗАМЕНЫ
// ============================================================

/**
 * Нарушения в матче.
 * match_player_id = NULL означает командное нарушение (не конкретного игрока).
 * Нарушения попадают в итоговый протокол и влияют на итоговый счёт.
 */
export const matchViolations = sqliteTable("match_violations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  compTeamId: integer("comp_team_id")
    .notNull()
    .references(() => competitionTeams.id),
  // NULL = командное нарушение
  matchPlayerId: integer("match_player_id").references(
    () => matchTeamPlayers.id
  ),
  violationTypeId: integer("violation_type_id").references(
    () => violationTypes.id
  ),
  phase: text("phase").$type<Phase>().notNull().default("general"),
  roundNumber: integer("round_number"),
  penaltyPts: real("penalty_pts").notNull().default(0),
  note: text("note"),
  registeredBy: integer("registered_by").references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const insertMatchViolationSchema = createInsertSchema(
  matchViolations
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMatchViolation = z.infer<typeof insertMatchViolationSchema>;
export type MatchViolation = typeof matchViolations.$inferSelect;

/**
 * Замены игроков в матче.
 * Хранят: кто вышел, кто вошёл, на каком этапе и раунде.
 */
export const matchSubstitutions = sqliteTable("match_substitutions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  compTeamId: integer("comp_team_id")
    .notNull()
    .references(() => competitionTeams.id),
  playerOutId: integer("player_out_id")
    .notNull()
    .references(() => matchTeamPlayers.id),
  playerInId: integer("player_in_id")
    .notNull()
    .references(() => matchTeamPlayers.id),
  phase: text("phase").$type<Phase>().notNull(),
  roundNumber: integer("round_number"),
  reason: text("reason"),
  note: text("note"),
  registeredBy: integer("registered_by").references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const insertMatchSubstitutionSchema = createInsertSchema(
  matchSubstitutions
).omit({ id: true, createdAt: true });
export type InsertMatchSubstitution = z.infer<
  typeof insertMatchSubstitutionSchema
>;
export type MatchSubstitution = typeof matchSubstitutions.$inferSelect;

// ============================================================
// ДОКУМЕНТЫ (сгенерированные PDF)
// ============================================================

/**
 * История сгенерированных документов.
 * При каждой регенерации создаётся новая версия; старая остаётся в истории.
 * is_current = true только у последней версии.
 */
export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  docType: text("doc_type").$type<DocumentType>().notNull(),
  version: integer("version").notNull().default(1),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  generatedBy: integer("generated_by").references(() => users.id),
  generatedAt: text("generated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(true),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  generatedAt: true,
});
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// ============================================================
// ИСТОРИЯ ИМПОРТОВ
// ============================================================

/**
 * Каждый импорт Excel/CSV создаёт запись здесь.
 * Хранит: кто, когда, какой файл, к какому матчу, статус и лог ошибок.
 * error_log — JSON-массив строк с описаниями проблем по строкам файла.
 */
export const importHistory = sqliteTable("import_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id").references(() => matches.id),
  importType: text("import_type").$type<ImportType>().notNull(),
  filename: text("filename").notNull(),
  fileSize: integer("file_size"),
  status: text("status").$type<ImportStatus>().notNull().default("pending"),
  rowsTotal: integer("rows_total"),
  rowsImported: integer("rows_imported"),
  // JSON-массив объектов { row, field, message }
  errorLog: text("error_log"),
  importedBy: integer("imported_by").references(() => users.id),
  // Источник данных: 'manual', 'cs2_export', 'custom_template'
  source: text("source"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  completedAt: text("completed_at"),
});

export type ImportHistoryEntry = typeof importHistory.$inferSelect;

// ============================================================
// AUDIT LOG
// ============================================================

/**
 * Журнал всех важных действий в системе.
 * old_data и new_data — JSON-снимки сущности до и после изменения.
 * Используется для аудита, отладки и разрешения споров.
 */
export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(), // create_match, update_round, approve_match и т.д.
  entityType: text("entity_type").notNull(), // match, digital_round, violation и т.д.
  entityId: integer("entity_id"),
  oldData: text("old_data"), // JSON
  newData: text("new_data"), // JSON
  ipAddress: text("ip_address"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type AuditLogEntry = typeof auditLog.$inferSelect;

// ============================================================
// PRESENCE (онлайн-присутствие)
// ============================================================

/**
 * Таблица для отслеживания онлайн-пользователей.
 * Каждое WebSocket-соединение создаёт запись; при дисконнекте удаляет.
 * current_view — какой экран открыт (для индикатора "кто где").
 * is_editing — что редактирует: "digital_round:42", "physical_round:7" и т.д.
 */
export const presenceSessions = sqliteTable("presence_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  matchId: integer("match_id").references(() => matches.id),
  socketId: text("socket_id").notNull().unique(),
  currentView: text("current_view"),
  isEditing: text("is_editing"),
  connectedAt: text("connected_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  lastSeenAt: text("last_seen_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type PresenceSession = typeof presenceSessions.$inferSelect;

// ============================================================
// RELATIONS (для Drizzle ORM join-запросов)
// ============================================================

export const usersRelations = relations(users, ({ many }) => ({
  createdMatches: many(matches, { relationName: "matchCreator" }),
}));

export const competitionsRelations = relations(competitions, ({ many, one }) => ({
  settings: one(competitionSettings, {
    fields: [competitions.id],
    references: [competitionSettings.competitionId],
  }),
  staff: many(competitionStaff),
  teams: many(competitionTeams),
  matches: many(matches),
}));

export const competitionTeamsRelations = relations(
  competitionTeams,
  ({ one, many }) => ({
    competition: one(competitions, {
      fields: [competitionTeams.competitionId],
      references: [competitions.id],
    }),
    globalTeam: one(globalTeams, {
      fields: [competitionTeams.globalTeamId],
      references: [globalTeams.id],
    }),
    players: many(competitionTeamPlayers),
    officials: many(competitionTeamOfficials),
  })
);

export const matchesRelations = relations(matches, ({ one, many }) => ({
  competition: one(competitions, {
    fields: [matches.competitionId],
    references: [competitions.id],
  }),
  matchTeams: many(matchTeams),
  digitalRounds: many(digitalRounds),
  physicalRounds: many(physicalRounds),
  violations: many(matchViolations),
  substitutions: many(matchSubstitutions),
  documents: many(documents),
}));

export const digitalRoundsRelations = relations(digitalRounds, ({ one, many }) => ({
  match: one(matches, {
    fields: [digitalRounds.matchId],
    references: [matches.id],
  }),
  playerStats: many(digitalRoundPlayerStats),
}));

export const physicalRoundsRelations = relations(physicalRounds, ({ one, many }) => ({
  match: one(matches, {
    fields: [physicalRounds.matchId],
    references: [matches.id],
  }),
  playerStats: many(physicalRoundPlayerStats),
}));


