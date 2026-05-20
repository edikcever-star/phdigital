/**
 * СЕРВИС НАРУШЕНИЙ И ЗАМЕН
 *
 * Нарушения влияют на итоговый счёт матча — после регистрации
 * автоматически пересчитываются очки.
 */

import db from "../db/connection";
import {
  matchViolations,
  matchSubstitutions,
  matchTeamPlayers,
  matches,
  type MatchViolation,
  type MatchSubstitution,
  type InsertMatchViolation,
  type InsertMatchSubstitution,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { AppError, Errors } from "../middleware/error.middleware";
import { recalcMatchScores } from "./match.service";

// -------------------------------------------------------
// Нарушения
// -------------------------------------------------------

export function getMatchViolations(matchId: number): MatchViolation[] {
  return db
    .select()
    .from(matchViolations)
    .where(eq(matchViolations.matchId, matchId))
    .all();
}

export function registerViolation(
  data: InsertMatchViolation,
  registeredBy: number
): MatchViolation {
  const match = db.select().from(matches).where(eq(matches.id, data.matchId)).get();
  if (!match) throw Errors.notFound("Матч");

  if (match.status === "locked" || match.status === "approved") {
    throw new AppError(400, "BAD_REQUEST", "Нельзя добавлять нарушения в закрытый матч");
  }

  const violation = db
    .insert(matchViolations)
    .values({ ...data, registeredBy } as any)
    .returning()
    .get();

  // Пересчитываем очки после нарушения
  recalcMatchScores(data.matchId);

  return violation;
}

export function deleteViolation(violationId: number, userId: number): void {
  const v = db
    .select()
    .from(matchViolations)
    .where(eq(matchViolations.id, violationId))
    .get();
  if (!v) throw Errors.notFound("Нарушение");

  const match = db.select().from(matches).where(eq(matches.id, v.matchId)).get();
  if (match?.status === "locked") {
    throw new AppError(400, "BAD_REQUEST", "Нельзя удалять нарушения в закрытом матче");
  }

  db.delete(matchViolations).where(eq(matchViolations.id, violationId)).run();

  // Пересчитываем очки после удаления нарушения
  if (v.matchId) recalcMatchScores(v.matchId);
}

// -------------------------------------------------------
// Замены
// -------------------------------------------------------

export function getMatchSubstitutions(matchId: number): MatchSubstitution[] {
  return db
    .select()
    .from(matchSubstitutions)
    .where(eq(matchSubstitutions.matchId, matchId))
    .all();
}

export function registerSubstitution(
  data: InsertMatchSubstitution,
  registeredBy: number
): MatchSubstitution {
  const match = db.select().from(matches).where(eq(matches.id, data.matchId)).get();
  if (!match) throw Errors.notFound("Матч");

  if (match.status === "locked") {
    throw new AppError(400, "BAD_REQUEST", "Нельзя добавлять замены в закрытый матч");
  }

  // Проверяем что игроки принадлежат матчу
  const playerOut = db
    .select()
    .from(matchTeamPlayers)
    .where(
      and(
        eq(matchTeamPlayers.id, data.playerOutId),
        eq(matchTeamPlayers.matchId, data.matchId)
      )
    )
    .get();
  if (!playerOut) throw new AppError(400, "BAD_REQUEST", "Заменяемый игрок не найден в матче");

  const playerIn = db
    .select()
    .from(matchTeamPlayers)
    .where(
      and(
        eq(matchTeamPlayers.id, data.playerInId),
        eq(matchTeamPlayers.matchId, data.matchId)
      )
    )
    .get();
  if (!playerIn) throw new AppError(400, "BAD_REQUEST", "Входящий игрок не найден в матче");

  // Обновляем статус игроков (out → isActive=false, in → isActive=true)
  db.update(matchTeamPlayers)
    .set({ isActive: false })
    .where(eq(matchTeamPlayers.id, data.playerOutId))
    .run();

  db.update(matchTeamPlayers)
    .set({ isActive: true })
    .where(eq(matchTeamPlayers.id, data.playerInId))
    .run();

  return db
    .insert(matchSubstitutions)
    .values({ ...data, registeredBy } as any)
    .returning()
    .get();
}
