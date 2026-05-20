/**
 * СЕРВИС ГЛОБАЛЬНОЙ БАЗЫ КОМАНД
 *
 * Глобальные команды — шаблонная база для создания команд в соревнованиях.
 * Изменения здесь не влияют на уже привязанные команды соревнований.
 */

import db from "../db/connection";
import {
  globalTeams,
  globalTeamPlayers,
  globalTeamOfficials,
  competitionTeams,
  type GlobalTeam,
  type GlobalTeamPlayer,
  type GlobalTeamOfficial,
  type InsertGlobalTeam,
  type InsertGlobalTeamPlayer,
  type InsertGlobalTeamOfficial,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { Errors } from "../middleware/error.middleware";

export interface GlobalTeamDetailDTO extends GlobalTeam {
  players: GlobalTeamPlayer[];
  officials: GlobalTeamOfficial[];
  usedInCompetitionsCount: number;
}

/**
 * Получить все глобальные команды.
 * Параметр includeArchived=true включает архивные.
 */
export function getAllGlobalTeams(includeArchived = false): GlobalTeam[] {
  const all = db.select().from(globalTeams).orderBy(desc(globalTeams.createdAt)).all();
  if (includeArchived) return all;
  return all.filter((t) => !t.isArchived);
}

/**
 * Получить команду по ID с составом.
 */
export function getGlobalTeamById(id: number): GlobalTeamDetailDTO {
  const team = db.select().from(globalTeams).where(eq(globalTeams.id, id)).get();
  if (!team) throw Errors.notFound("Команда");

  const players = db
    .select()
    .from(globalTeamPlayers)
    .where(eq(globalTeamPlayers.teamId, id))
    .all();

  const officials = db
    .select()
    .from(globalTeamOfficials)
    .where(eq(globalTeamOfficials.teamId, id))
    .all();

  const usedInCompetitionsCount = db
    .select({ id: competitionTeams.id })
    .from(competitionTeams)
    .where(eq(competitionTeams.globalTeamId, id))
    .all()
    .length;

  return { ...team, players, officials, usedInCompetitionsCount };
}

/**
 * Создать новую глобальную команду.
 */
export function createGlobalTeam(data: InsertGlobalTeam): GlobalTeam {
  return db
    .insert(globalTeams)
    .values(data)
    .returning()
    .get();
}

/**
 * Обновить глобальную команду.
 */
export function updateGlobalTeam(
  id: number,
  data: Partial<InsertGlobalTeam>
): GlobalTeam {
  const existing = db.select().from(globalTeams).where(eq(globalTeams.id, id)).get();
  if (!existing) throw Errors.notFound("Команда");

  return db
    .update(globalTeams)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(globalTeams.id, id))
    .returning()
    .get();
}

/**
 * Архивировать команду (soft delete).
 */
export function archiveGlobalTeam(id: number): GlobalTeam {
  const existing = db.select().from(globalTeams).where(eq(globalTeams.id, id)).get();
  if (!existing) throw Errors.notFound("Команда");

  return db
    .update(globalTeams)
    .set({ isArchived: true, updatedAt: new Date().toISOString() })
    .where(eq(globalTeams.id, id))
    .returning()
    .get();
}

/**
 * Добавить игрока в команду.
 */
export function addPlayerToTeam(
  teamId: number,
  data: InsertGlobalTeamPlayer
): GlobalTeamPlayer {
  const team = db.select().from(globalTeams).where(eq(globalTeams.id, teamId)).get();
  if (!team) throw Errors.notFound("Команда");

  return db
    .insert(globalTeamPlayers)
    .values({ ...data, teamId })
    .returning()
    .get();
}

/**
 * Удалить игрока из команды.
 */
export function removePlayerFromTeam(playerId: number): void {
  const player = db
    .select()
    .from(globalTeamPlayers)
    .where(eq(globalTeamPlayers.id, playerId))
    .get();
  if (!player) throw Errors.notFound("Игрок");

  db.delete(globalTeamPlayers)
    .where(eq(globalTeamPlayers.id, playerId))
    .run();
}

/**
 * Обновить игрока.
 */
export function updatePlayer(
  playerId: number,
  data: Partial<InsertGlobalTeamPlayer>
): GlobalTeamPlayer {
  const player = db
    .select()
    .from(globalTeamPlayers)
    .where(eq(globalTeamPlayers.id, playerId))
    .get();
  if (!player) throw Errors.notFound("Игрок");

  return db
    .update(globalTeamPlayers)
    .set(data)
    .where(eq(globalTeamPlayers.id, playerId))
    .returning()
    .get();
}

/**
 * Добавить официального представителя команды.
 */
export function addOfficialToTeam(
  teamId: number,
  data: InsertGlobalTeamOfficial
): GlobalTeamOfficial {
  const team = db.select().from(globalTeams).where(eq(globalTeams.id, teamId)).get();
  if (!team) throw Errors.notFound("Команда");

  return db
    .insert(globalTeamOfficials)
    .values({ ...data, teamId })
    .returning()
    .get();
}

/**
 * Удалить официального представителя.
 */
export function removeOfficialFromTeam(officialId: number): void {
  db.delete(globalTeamOfficials)
    .where(eq(globalTeamOfficials.id, officialId))
    .run();
}
