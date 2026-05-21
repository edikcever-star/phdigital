/**
 * СЕРВИС СОРЕВНОВАНИЙ
 *
 * Бизнес-логика для работы с соревнованиями.
 * Все вычисления и валидации — здесь, не в роутах.
 */


import { type Match } from "@shared/schema";

import db from "../db/connection";
import {
  competitions,
  competitionSettings,
  competitionStaff,
  competitionTeams,
  competitionTeamPlayers,
  competitionTeamOfficials,
  judges,
  globalTeams,
  globalTeamPlayers,
  globalTeamOfficials,
  matches,
  type Competition,
  type CompetitionSettings,
  type CompetitionTeam,
  type InsertCompetition,
  type InsertCompetitionSettings,
  type InsertCompetitionTeam,
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { AppError, Errors } from "../middleware/error.middleware";

// DTO для ответа — соревнование с настройками
export interface CompetitionWithSettings extends Competition {
  settings: CompetitionSettings | null;
  teamsCount: number;
  matchesCount: number;
}

// -------------------------------------------------------
// Получение соревнований
// -------------------------------------------------------

/**
 * Получить все соревнования (список для UI).
 */
export function getAllCompetitions(): CompetitionWithSettings[] {
  const rows = db
    .select()
    .from(competitions)
    .orderBy(desc(competitions.createdAt))
    .all();

  return rows.map((comp) => enrichCompetition(comp));
}

/**
 * Получить соревнование по ID с полными данными.
 */
export function getCompetitionById(id: number): CompetitionWithSettings {
  const comp = db
    .select()
    .from(competitions)
    .where(eq(competitions.id, id))
    .get();
  if (!comp) throw Errors.notFound("Соревнование");

  return enrichCompetition(comp);
}

/**
 * Вспомогательная функция: добавляет settings, teamsCount, matchesCount к Competition.
 */
function enrichCompetition(comp: Competition): CompetitionWithSettings {
  const settings =
    db
      .select()
      .from(competitionSettings)
      .where(eq(competitionSettings.competitionId, comp.id))
      .get() ?? null;

  const teamsCount = db
    .select({ id: competitionTeams.id })
    .from(competitionTeams)
    .where(eq(competitionTeams.competitionId, comp.id))
    .all().length;

  const matchesCount = db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.competitionId, comp.id))
    .all().length;

  return { ...comp, settings, teamsCount, matchesCount };
}

// Внутри класса CompetitionService или как экспортируемая функция
export function removeOfficialFromTeam(officialId: number) {
  // Удаляем официальное лицо (тренера) из команды по его ID
  db.delete(competitionTeamOfficials)
    .where(eq(competitionTeamOfficials.id, officialId))
    .run();
}
// -------------------------------------------------------
// Создание и обновление соревнований
// -------------------------------------------------------

/**
 * Создать соревнование с настройками по умолчанию.
 */
export function createCompetition(
  data: InsertCompetition,
  createdBy: number
): CompetitionWithSettings {
  const newComp = db
    .insert(competitions)
    .values({ ...data, createdBy } as any)
    .returning()
    .get();

  const settings = db
    .insert(competitionSettings)
    .values({
      competitionId: newComp.id,
      digitalRoundsHalf1: 12,
      digitalRoundsHalf2: 12,
      overtimeEnabled: false,
      digitalRoundWinPts: 1,
      physTotalRounds: 24,
      physSideSwitchRound: 12,
      physActivationPts: 2,
      physExplosionPts: 3,
      physDeactivationPts: 2,
      physFragWinPts: 1,
      digitalWeight: 1.0,
      physicalWeight: 1.0,
    })
    .returning()
    .get();

  return { ...newComp, settings, teamsCount: 0, matchesCount: 0 };
}

/**
 * Обновить основные поля соревнования.
 */
export function updateCompetition(
  id: number,
  data: Partial<InsertCompetition>
): CompetitionWithSettings {
  const existing = db
    .select()
    .from(competitions)
    .where(eq(competitions.id, id))
    .get();
  if (!existing) throw Errors.notFound("Соревнование");

  db.update(competitions)
    .set({ ...data, updatedAt: new Date().toISOString() } as any)
    .where(eq(competitions.id, id))
    .run();

  return getCompetitionById(id);
}

/**
 * Получить настройки соревнования по ID.
 */
export function getCompetitionSettings(
  competitionId: number
): CompetitionSettings {
  const comp = db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .get();
  if (!comp) throw Errors.notFound("Соревнование");

  const settings = db
    .select()
    .from(competitionSettings)
    .where(eq(competitionSettings.competitionId, competitionId))
    .get();

  if (!settings) {
    return db
      .insert(competitionSettings)
      .values({
        competitionId,
        digitalRoundsHalf1: 12,
        digitalRoundsHalf2: 12,
        overtimeEnabled: false,
        digitalRoundWinPts: 1,
        physTotalRounds: 24,
        physSideSwitchRound: 12,
        physActivationPts: 2,
        physExplosionPts: 3,
        physDeactivationPts: 2,
        physFragWinPts: 1,
        digitalWeight: 1.0,
        physicalWeight: 1.0,
      })
      .returning()
      .get();
  }

  return settings;
}

/**
 * Обновить настройки соревнования.
 */
export function updateCompetitionSettings(
  competitionId: number,
  data: Partial<InsertCompetitionSettings>
): CompetitionSettings {
  const comp = db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .get();
  if (!comp) throw Errors.notFound("Соревнование");

  const existing = db
    .select()
    .from(competitionSettings)
    .where(eq(competitionSettings.competitionId, competitionId))
    .get();

  if (!existing) {
    return db
      .insert(competitionSettings)
      .values({ competitionId, ...data })
      .returning()
      .get();
  }

  return db
    .update(competitionSettings)
    .set(data)
    .where(eq(competitionSettings.competitionId, competitionId))
    .returning()
    .get();
}



// ============================================================================
// ГЕНЕРАЦИЯ ТУРНИРНОЙ СЕТКИ
// ============================================================================

/**
 * Генерирует сетку матчей для соревнования по "Олимпийской системе" (плей-офф)
 */
export function generateCompetitionBracket(competitionId: number) {
  // 1. Получаем все команды этого соревнования
  const teams = getCompetitionTeams(competitionId);
  
  if (teams.length < 2) {
    throw Errors.badRequest("Для генерации сетки нужно минимум 2 команды");
  }

  // 2. Перемешиваем команды случайным образом (жеребьевка)
  const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);

  // 3. Определяем стадию (1/2, 1/4, 1/8 финала)
  const matchesToCreate = [];
  let stageName = "Плей-офф";
  
  if (teams.length <= 2) stageName = "Финал";
  else if (teams.length <= 4) stageName = "1/2 финала";
  else if (teams.length <= 8) stageName = "1/4 финала";
  else if (teams.length <= 16) stageName = "1/8 финала";

  // 4. Формируем пары (каждые 2 команды - это 1 матч)
  for (let i = 0; i < shuffledTeams.length; i += 2) {
    const team1 = shuffledTeams[i];
    const team2 = shuffledTeams[i + 1]; // Может быть undefined, если нечетное кол-во команд

    matchesToCreate.push({
      competitionId,
      stage: stageName,
      matchNumber: `М-${(i / 2) + 1}`,
      status: "draft" as const,
      // Вставляем данные в формат JSON, если хотим хранить сетку в formatConfig (опционально)
    });
  }

  // 5. Сохраняем матчи в БД
  const createdMatches = [];
  
  for (const matchData of matchesToCreate) {
    // Вставляем матч
    const match = db.insert(matches).values(matchData).returning().get();
    
    // Привязываем команды к матчу (таблица match_teams)
    // Команда 1
    db.run(
      sql`INSERT INTO match_teams (match_id, comp_team_id, team_slot) VALUES (${match.id}, ${shuffledTeams[matchesToCreate.indexOf(matchData) * 2].id}, 1)`
    );
    
    // Команда 2 (если есть пара)
    if (shuffledTeams[(matchesToCreate.indexOf(matchData) * 2) + 1]) {
      db.run(
        sql`INSERT INTO match_teams (match_id, comp_team_id, team_slot) VALUES (${match.id}, ${shuffledTeams[(matchesToCreate.indexOf(matchData) * 2) + 1].id}, 2)`
      );
    }
    
    createdMatches.push(match);
  }

  return createdMatches;
}
// -------------------------------------------------------
// Команды соревнования
// -------------------------------------------------------

/**
 * Получить команды соревнования с составом.
 */
export function getCompetitionTeams(competitionId: number) {
  const comp = db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .get();
  if (!comp) throw Errors.notFound("Соревнование");

  const teams = db
    .select()
    .from(competitionTeams)
    .where(eq(competitionTeams.competitionId, competitionId))
    .all();

  return teams.map((team) => {
    // ИСПРАВЛЕНИЕ 1: Достаем сырых игроков и приводим is_captain к camelCase isCaptain
    const rawPlayers = db
      .select()
      .from(competitionTeamPlayers)
      .where(eq(competitionTeamPlayers.compTeamId, team.id))
      .all();

    const players = rawPlayers.map((p: any) => ({
      ...p,
      // SQLite отдает 0/1, мы жестко приводим к true/false для фронтенда
      isCaptain: Boolean(p.isCaptain || p.is_captain || false) 
    }));

    const officials = db
      .select()
      .from(competitionTeamOfficials)
      .where(eq(competitionTeamOfficials.compTeamId, team.id))
      .all();

    return { ...team, players, officials };
  });
}

/**
 * Добавить команду в соревнование.
 */
export function addTeamToCompetition(
  competitionId: number,
  data: InsertCompetitionTeam & { copyFromGlobal?: boolean }
): CompetitionTeam {
  const comp = db
    .select({ id: competitions.id, status: competitions.status })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .get();
  if (!comp) throw Errors.notFound("Соревнование");

  if (comp.status === "archived") {
    throw new AppError(400, "BAD_REQUEST", "Нельзя добавлять команды в архивное соревнование");
  }

  // ЗАЩИТА ОТ ДУБЛЕЙ
  if (data.globalTeamId !== undefined && data.globalTeamId !== null) {
    const duplicate = db
      .select({ id: competitionTeams.id })
      .from(competitionTeams)
      .where(
        and(
          eq(competitionTeams.competitionId, competitionId),
          eq(competitionTeams.globalTeamId, data.globalTeamId)
        )
      )
      .get();
    if (duplicate) {
      throw new AppError(400, "BAD_REQUEST", "Эта команда уже добавлена в соревнование");
    }
  } else {
    const duplicateName = db
      .select({ id: competitionTeams.id })
      .from(competitionTeams)
      .where(
        and(
          eq(competitionTeams.competitionId, competitionId),
          eq(competitionTeams.name, data.name)
        )
      )
      .get();
    if (duplicateName) {
      throw new AppError(400, "BAD_REQUEST", `Команда с названием "${data.name}" уже существует в этом соревновании`);
    }
  }

  // Если нужно скопировать данные из глобального справочника
  if (data.copyFromGlobal && data.globalTeamId) {
    const globalTeam = db
      .select()
      .from(globalTeams)
      .where(eq(globalTeams.id, data.globalTeamId))
      .get();
    if (!globalTeam) throw Errors.notFound("Глобальная команда");

    const newTeam = db
      .insert(competitionTeams)
      .values({
        competitionId,
        globalTeamId: data.globalTeamId,
        name: globalTeam.name,
        region: globalTeam.region ?? null,
      })
      .returning()
      .get();

    // Копируем игроков
    const globalPlayers = db
      .select()
      .from(globalTeamPlayers)
      .where(eq(globalTeamPlayers.teamId, data.globalTeamId)) // В схеме называется teamId
      .all();

    for (const player of globalPlayers) {
      db.insert(competitionTeamPlayers)
        .values({
          compTeamId: newTeam.id,
          globalPlayerId: player.id,
          fullName: player.fullName, // В схеме только fullName
          number: player.number ?? null,
          position: player.position ?? null,
          isReserve: player.isReserve ?? false,
        } as any)
        .run();
    }

    // Копируем официальных лиц (тренеров)
    const globalOfficials = db
      .select()
      .from(globalTeamOfficials)
      .where(eq(globalTeamOfficials.teamId, data.globalTeamId)) // В схеме называется teamId
      .all();

    for (const official of globalOfficials) {
      db.insert(competitionTeamOfficials)
        .values({
          compTeamId: newTeam.id,
          fullName: official.fullName, // В схеме только fullName
          role: official.role ?? null,
        } as any)
        .run();
    }

    return newTeam;
  }

  // Ручное добавление — просто вставляем переданные данные, явно обнуляя globalTeamId
  return db
    .insert(competitionTeams)
    .values({ 
      competitionId, 
      name: data.name, 
      region: data.region || null,
      globalTeamId: null 
    })
    .returning()
    .get();
}

/**
 * Удалить команду из соревнования.
 */
export function removeTeamFromCompetition(
  competitionId: number,
  teamId: number
): void {
  const comp = db
    .select({ id: competitions.id, status: competitions.status })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .get();
  if (!comp) throw Errors.notFound("Соревнование");

  if (comp.status === "archived") {
    throw new AppError(400, "BAD_REQUEST", "Нельзя изменять архивное соревнование");
  }

  const team = db
    .select({ id: competitionTeams.id })
    .from(competitionTeams)
    .where(
      and(
        eq(competitionTeams.id, teamId),
        eq(competitionTeams.competitionId, competitionId)
      )
    )
    .get();
  if (!team) throw Errors.notFound("Команда в соревновании");

  // Сначала безопасно удаляем дочерние записи (игроков и тренеров)
  db.delete(competitionTeamPlayers)
    .where(eq(competitionTeamPlayers.compTeamId, teamId))
    .run();

  db.delete(competitionTeamOfficials)
    .where(eq(competitionTeamOfficials.compTeamId, teamId))
    .run();

  // Затем удаляем саму команду
  db.delete(competitionTeams)
    .where(eq(competitionTeams.id, teamId))
    .run();
}

// -------------------------------------------------------
// Управление составом (Игроки и Персонал ручных команд)
// -------------------------------------------------------

export function addPlayerToTeam(
  compTeamId: number,
  data: { fullName: string; number?: number; position?: string; isReserve?: boolean; isCaptain?: boolean }
) {
  return db.insert(competitionTeamPlayers).values({
    compTeamId,
    fullName: data.fullName,
    number: data.number ?? null,
    position: data.position ?? null,
    isReserve: data.isReserve ?? false,
    isCaptain: data.isCaptain ?? false,
  } as any).returning().get();
}

export function removePlayerFromTeam(playerId: number) {
  db.delete(competitionTeamPlayers).where(eq(competitionTeamPlayers.id, playerId)).run();
}

export function addOfficialToTeam(compTeamId: number, data: { fullName: string; role: string }) {
  return db.insert(competitionTeamOfficials).values({
    compTeamId,
    fullName: data.fullName,
    role: data.role,
  } as any).returning().get();
}

// ИСПРАВЛЕНИЕ 2: Используем Drizzle update вместо сырого SQL для гарантии правильной работы
export function setTeamCaptain(compTeamId: number, playerId: number | null) {
  console.log(`\n[DEBUG] === НАЧАЛО СМЕНЫ КАПИТАНА ===`);
  console.log(`[DEBUG] Команда: ${compTeamId}, Игрок: ${playerId}`);

  // 1. Снимаем корону со ВСЕХ игроков команды
  db.update(competitionTeamPlayers)
    .set({ isCaptain: false })
    .where(eq(competitionTeamPlayers.compTeamId, compTeamId))
    .run();

  // 2. Если передан конкретный игрок — назначаем его капитаном
  if (playerId !== null) {
    db.update(competitionTeamPlayers)
      .set({ isCaptain: true })
      .where(eq(competitionTeamPlayers.id, playerId))
      .run();
  }
  
  console.log(`[DEBUG] === КАПИТАН УСПЕШНО НАЗНАЧЕН ===\n`);
}

// -------------------------------------------------------
// Судьи соревнования
// -------------------------------------------------------

export function getCompetitionStaff(competitionId: number) {
  const comp = db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .get();
  if (!comp) throw Errors.notFound("Соревнование");

  const staffList = db
    .select()
    .from(competitionStaff)
    .where(eq(competitionStaff.competitionId, competitionId))
    .all();

  // Вручную присоединяем (join) таблицу judges, чтобы на фронтенд уходили имена судей
  return staffList.map(staff => {
    const judge = db.select().from(judges).where(eq(judges.id, staff.judgeId)).get();
    return { ...staff, judge };
  }).filter(s => s.judge != null);
}

export function addStaffToCompetition(
  competitionId: number,
  judgeId: number,
  staffRole: string
) {
  const comp = db
    .select({ id: competitions.id, status: competitions.status })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .get();
  if (!comp) throw Errors.notFound("Соревнование");

  if (comp.status === "archived") {
    throw new AppError(400, "BAD_REQUEST", "Нельзя добавлять судей в архивное соревнование");
  }

  const judge = db
    .select({ id: judges.id })
    .from(judges)
    .where(eq(judges.id, judgeId))
    .get();
  if (!judge) throw Errors.notFound("Судья");

  const duplicate = db
    .select({ id: competitionStaff.id })
    .from(competitionStaff)
    .where(
      and(
        eq(competitionStaff.competitionId, competitionId),
        eq(competitionStaff.judgeId, judgeId)
      )
    )
    .get();
  if (duplicate) {
    throw new AppError(400, "BAD_REQUEST", "Этот судья уже добавлен в соревнование");
  }

  return db
    .insert(competitionStaff)
    .values({ competitionId, judgeId, staffRole })
    .returning()
    .get();
}

export function removeStaffFromCompetition(
  competitionId: number,
  staffId: number
): void {
  const comp = db
    .select({ id: competitions.id, status: competitions.status })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .get();
  if (!comp) throw Errors.notFound("Соревнование");

  if (comp.status === "archived") {
    throw new AppError(400, "BAD_REQUEST", "Нельзя изменять архивное соревнование");
  }

  const entry = db
    .select({ id: competitionStaff.id })
    .from(competitionStaff)
    .where(
      and(
        eq(competitionStaff.id, staffId),
        eq(competitionStaff.competitionId, competitionId)
      )
    )
    .get();
  if (!entry) throw Errors.notFound("Судья в соревновании");

  db.delete(competitionStaff)
    .where(eq(competitionStaff.id, staffId))
    .run();
}





// -------------------------------------------------------
// Удаление соревнования
// -------------------------------------------------------

export function deleteCompetition(id: number): void {
  const comp = db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.id, id))
    .get();
  if (!comp) throw Errors.notFound("Соревнование");

  const teams = db
    .select({ id: competitionTeams.id })
    .from(competitionTeams)
    .where(eq(competitionTeams.competitionId, id))
    .all();

  for (const team of teams) {
    db.delete(competitionTeamPlayers)
      .where(eq(competitionTeamPlayers.compTeamId, team.id))
      .run();

    db.delete(competitionTeamOfficials)
      .where(eq(competitionTeamOfficials.compTeamId, team.id))
      .run();
  }

  db.delete(competitionTeams).where(eq(competitionTeams.competitionId, id)).run();
  db.delete(competitionStaff).where(eq(competitionStaff.competitionId, id)).run();
  db.delete(competitionSettings).where(eq(competitionSettings.competitionId, id)).run();
  db.delete(competitions).where(eq(competitions.id, id)).run();
}

export function updateCompetitionTeam(
  competitionId: number,
  teamId: number,
  data: { name: string; region: string | null }
) {
  db.update(competitionTeams)
    .set({ name: data.name, region: data.region })
    .where(and(eq(competitionTeams.id, teamId), eq(competitionTeams.competitionId, competitionId)))
    .run();

  return db.select().from(competitionTeams).where(eq(competitionTeams.id, teamId)).get();
}