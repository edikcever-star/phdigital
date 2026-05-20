/**
 * СЕРВИС РАУНДОВ
 *
 * Обновление раундов цифрового и физического этапов.
 * После каждого изменения вызывается пересчёт итоговых очков матча.
 *
 * Принцип: все вычисления на сервере, клиент только отображает.
 */

import db from "../db/connection";
import {
  digitalRounds,
  physicalRounds,
  digitalRoundPlayerStats,
  digitalMatchTeamStats,
  competitionSettings,
  matches,
  matchTeams,
  type DigitalRound,
  type PhysicalRound,
  type InsertDigitalRound,
  type InsertPhysicalRound,
  type InsertDigitalRoundPlayerStats,
  type RoundStatus,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { AppError, Errors } from "../middleware/error.middleware";
import { recalcMatchScores } from "./match.service";

// -------------------------------------------------------
// Цифровой этап
// -------------------------------------------------------

/**
 * Инициализация раундов цифрового этапа (выбор стартовых сторон)
 */
export function initDigitalRounds(matchId: number, team1Side: "T" | "CT"): boolean {
  // 1. Проверяем, существует ли матч
  const match = db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .get();

  if (!match) {
    throw Errors.notFound("Матч");
  }

  // 2. Проверяем, нет ли уже раундов
  const existing = db
    .select({ id: digitalRounds.id })
    .from(digitalRounds)
    .where(eq(digitalRounds.matchId, matchId))
    .limit(1)
    .all();

  if (existing.length > 0) {
    throw new AppError(400, "BAD_REQUEST", "Раунды уже сгенерированы");
  }

  const team2Side = team1Side === "CT" ? "T" : "CT";

  // 3. Генерируем 24 раунда (MR12)
  const newRounds = [];
  for (let i = 1; i <= 24; i++) {
    // 1-12 раунд = 1 тайм, 13-24 раунд = 2 тайм
    const half = i <= 12 ? 1 : 2;
    
    // В CS2 стороны меняются после первого тайма (после 12 раунда)
    const currentTeam1Side = half === 1 ? team1Side : team2Side;
    const currentTeam2Side = half === 1 ? team2Side : team1Side;

    newRounds.push({
      matchId,
      roundNumber: i,
      half,
      team1Side: currentTeam1Side,
      team2Side: currentTeam2Side,
      status: "pending" as RoundStatus,
      activation: false,
      explosion: false,
      deactivation: false,
    });
  }

  // 4. Массовая вставка в БД
  db.insert(digitalRounds).values(newRounds).run();
  
  return true;
}

/**
 * Получить все раунды цифрового этапа матча.
 */
export function getDigitalRounds(matchId: number): DigitalRound[] {
  return db
    .select()
    .from(digitalRounds)
    .where(eq(digitalRounds.matchId, matchId))
    .all()
    .sort((a, b) => a.roundNumber - b.roundNumber);
}

/**
 * Обновить раунд цифрового этапа.
 *
 * ВАЖНО: pointsAwarded вычисляется здесь на сервере,
 * на основе настроек соревнования — не принимается с клиента.
 */
export function updateDigitalRound(
  roundId: number,
  data: Partial<InsertDigitalRound>,
  userId: number
): DigitalRound {
  const round = db
    .select()
    .from(digitalRounds)
    .where(eq(digitalRounds.id, roundId))
    .get();
  if (!round) throw Errors.notFound("Раунд цифрового этапа");

  const match = db.select().from(matches).where(eq(matches.id, round.matchId)).get();
  if (!match) throw Errors.notFound("Матч");

  if (match.status !== "digital_phase") {
    throw new AppError(400, "BAD_REQUEST", "Изменение раундов доступно только во время цифрового этапа");
  }

  // Вычисляем очки на сервере, если изменился победитель
  let pointsAwarded = round.pointsAwarded;
  if (data.winnerTeamId !== undefined || data.status !== undefined) {
    const settings = db
      .select()
      .from(competitionSettings)
      .where(eq(competitionSettings.competitionId, match.competitionId))
      .get();

    const newStatus: RoundStatus = (data.status ?? round.status) as RoundStatus;
    if (newStatus === "completed" && (data.winnerTeamId ?? round.winnerTeamId)) {
      pointsAwarded = settings?.digitalRoundWinPts ?? 1;
    } else if (newStatus !== "completed") {
      pointsAwarded = 0;
    }
  }

  const updated = db
    .update(digitalRounds)
    .set({ ...data, pointsAwarded, updatedAt: new Date().toISOString() } as any)
    .where(eq(digitalRounds.id, roundId))
    .returning()
    .get();

  // Пересчитываем итоговые очки матча
  recalcMatchScores(round.matchId);

  return updated;
}

/**
 * Сохранить статистику игрока в раунде (уровень 2 цифрового этапа).
 */
export function upsertDigitalRoundPlayerStats(
  digitalRoundId: number,
  matchPlayerId: number,
  compTeamId: number,
  data: Partial<InsertDigitalRoundPlayerStats>
) {
  const existing = db
    .select()
    .from(digitalRoundPlayerStats)
    .where(
      and(
        eq(digitalRoundPlayerStats.digitalRoundId, digitalRoundId),
        eq(digitalRoundPlayerStats.matchPlayerId, matchPlayerId)
      )
    )
    .get();

  if (existing) {
    return db
      .update(digitalRoundPlayerStats)
      .set(data)
      .where(eq(digitalRoundPlayerStats.id, existing.id))
      .returning()
      .get();
  }

  return db
    .insert(digitalRoundPlayerStats)
    .values({
      digitalRoundId,
      matchPlayerId,
      compTeamId,
      ...data,
    })
    .returning()
    .get();
}

// -------------------------------------------------------
// Физический этап
// -------------------------------------------------------

/**
 * Инициализация раундов физического этапа (Лазертаг)
 */
export function initPhysicalRounds(matchId: number, team1Side: "attack" | "defense") {
  const match = db.select().from(matches).where(eq(matches.id, matchId)).get();
  if (!match) throw new Error("Матч не найден");

  // Получаем настройки соревнования, чтобы узнать количество раундов
  const compSettings = db.select().from(competitionSettings).where(eq(competitionSettings.competitionId, match.competitionId)).get();
  const totalRounds = compSettings?.physTotalRounds ?? 12;

  // Проверяем, нет ли уже сгенерированных раундов
  const existingRounds = db.select().from(physicalRounds).where(eq(physicalRounds.matchId, matchId)).all();
  if (existingRounds.length > 0) {
    throw new Error("Раунды уже сгенерированы");
  }

  // Получаем команды матча
  const team1 = db.select().from(matchTeams).where(and(eq(matchTeams.matchId, matchId), eq(matchTeams.teamSlot, 1))).get();
  const team2 = db.select().from(matchTeams).where(and(eq(matchTeams.matchId, matchId), eq(matchTeams.teamSlot, 2))).get();

  // Сохраняем выбранную сторону
  if (team1 && team2) {
    const team2Side = team1Side === "attack" ? "defense" : "attack";
    db.update(matchTeams).set({ physicalStartSide: team1Side }).where(eq(matchTeams.id, team1.id)).run();
    db.update(matchTeams).set({ physicalStartSide: team2Side }).where(eq(matchTeams.id, team2.id)).run();
  }

  // Создаем массив пустых раундов
  const newRounds = [];
  for (let i = 1; i <= totalRounds; i++) {
    newRounds.push({
      matchId,
      roundNumber: i,
      team1Side: team1Side as "attack" | "defense", 
      team2Side: (team1Side === "attack" ? "defense" : "attack") as "attack" | "defense",
      status: "pending" as RoundStatus,
      fragsTeam1: 0,
      fragsTeam2: 0,
      pointsAwarded: 0,
      penaltyPoints: 0,
      activation: false,
      explosion: false,
      deactivation: false
    });
  }

  // Массово вставляем раунды в базу данных, отключая строгую проверку Drizzle
  db.insert(physicalRounds).values(newRounds as any[]).run();
}

/**
 * Получить все раунды физического этапа матча.
 */
export function getPhysicalRounds(matchId: number): PhysicalRound[] {
  return db
    .select()
    .from(physicalRounds)
    .where(eq(physicalRounds.matchId, matchId))
    .all()
    .sort((a, b) => a.roundNumber - b.roundNumber);
}

/**
 * Обновить раунд физического этапа.
 *
 * ВАЖНО: penaltyPoints — отдельное числовое поле.
 * Никогда не хранить штрафы в каком-либо другом поле.
 *
 * Очки вычисляются на сервере по настройкам соревнования.
 */
export function updatePhysicalRound(
  roundId: number,
  data: Partial<InsertPhysicalRound>,
  userId: number
): PhysicalRound {
  const round = db
    .select()
    .from(physicalRounds)
    .where(eq(physicalRounds.id, roundId))
    .get();
  if (!round) throw Errors.notFound("Раунд физического этапа");

  const match = db.select().from(matches).where(eq(matches.id, round.matchId)).get();
  if (!match) throw Errors.notFound("Матч");

  if (match.status !== "physical_phase") {
    throw new AppError(
      400,
      "BAD_REQUEST",
      "Изменение раундов доступно только во время физического этапа"
    );
  }

  const settings = db
    .select()
    .from(competitionSettings)
    .where(eq(competitionSettings.competitionId, match.competitionId))
    .get();

  // Вычисляем очки на основе winType
  let pointsAwarded = round.pointsAwarded;
  const newStatus: RoundStatus = (data.status ?? round.status) as RoundStatus;
  const newWinType = data.winType ?? round.winType;

  if (newStatus === "completed" && newWinType && settings) {
    switch (newWinType) {
      case "activation":
        pointsAwarded = settings.physActivationPts;
        break;
      case "explosion":
        pointsAwarded = settings.physExplosionPts;
        break;
      case "deactivation":
        pointsAwarded = settings.physDeactivationPts;
        break;
      case "frag_win":
        pointsAwarded = settings.physFragWinPts;
        break;
      case "technical":
        pointsAwarded = 0;
        break;
      default:
        pointsAwarded = 0;
    }
  } else if (newStatus !== "completed") {
    pointsAwarded = 0;
  }

  // Штрафные очки принимаются с клиента, но ограничиваем >= 0
  const penaltyPoints = Math.max(0, data.penaltyPoints ?? round.penaltyPoints);

  const updated = db
    .update(physicalRounds)
    .set({ ...data, pointsAwarded, penaltyPoints, updatedAt: new Date().toISOString() } as any)
    .where(eq(physicalRounds.id, roundId))
    .returning()
    .get();

  // Пересчитываем итоговые очки матча
  recalcMatchScores(round.matchId);

  return updated;
}