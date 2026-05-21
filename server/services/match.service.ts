/**
 * СЕРВИС МАТЧЕЙ
 *
 * Центральный сервис приложения. Управляет:
 * - жизненным циклом матча (статусы)
 * - инициализацией раундов
 * - вычислением и кешированием итоговых очков
 *
 * Все вычисления очков происходят ЗДЕСЬ — не на клиенте.
 */

import db from "../db/connection";
import {
  matches,
  matchTeams,
  matchTeamPlayers,
  matchTeamOfficials,
  matchStaff,
  matchStatusLog,
  matchMapVeto,
  digitalRounds,
  digitalMatchTeamStats,
  physicalRounds,
  matchViolations,
  matchSubstitutions,
  competitions,
  competitionSettings,
  competitionTeams,
  competitionTeamPlayers,
  competitionTeamOfficials,
  competitionStaff,
  type Match,
  type InsertMatch,
  type InsertMatchTeam,
  type MatchStatus,
  type DigitalSide,
  type PhysicalSide,
  type CompetitionTeam,
  type MatchTeamPlayer,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { AppError, Errors } from "../middleware/error.middleware";

// -------------------------------------------------------
// Допустимые переходы статусов
// -------------------------------------------------------
const STATUS_TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  draft: ["setup"],
  setup: ["digital_phase", "draft"],
  digital_phase: ["physical_phase"],
  physical_phase: ["finished"],
  finished: ["approved", "digital_phase"], // откат возможен
  approved: ["locked"],
  locked: [],
};

// -------------------------------------------------------
// DTOs для ответов
// -------------------------------------------------------
export interface MatchDetailDTO {
  match: Match;
  teams: Array<{
    compTeam: CompetitionTeam;
    teamSlot: number;
    digitalStartSide: DigitalSide | null;
    physicalStartSide: PhysicalSide | null;
    players: MatchTeamPlayer[];
  }>;
  digitalRoundsCount: number;
  physicalRoundsCount: number;
  violationsCount: number;
}

// -------------------------------------------------------
// Получение матчей
// -------------------------------------------------------

export function getMatchesByCompetition(competitionId: number) {
  const matchList = db
    .select()
    .from(matches)
    .where(eq(matches.competitionId, competitionId))
    .orderBy(desc(matches.createdAt))
    .all();

  return matchList.map((match) => {
    const teams = db
      .select()
      .from(matchTeams)
      .where(eq(matchTeams.matchId, match.id))
      .all();

    const team1Row = teams.find((t) => t.teamSlot === 1);
    const team2Row = teams.find((t) => t.teamSlot === 2);

    const team1 = team1Row
      ? db.select().from(competitionTeams).where(eq(competitionTeams.id, team1Row.compTeamId)).get()
      : null;

    const team2 = team2Row
      ? db.select().from(competitionTeams).where(eq(competitionTeams.id, team2Row.compTeamId)).get()
      : null;

    return {
      ...match,
      team1: team1 ? { id: team1.id, name: team1.name } : null,
      team2: team2 ? { id: team2.id, name: team2.name } : null,
    };
  });
}

export function getMatchById(matchId: number): MatchDetailDTO {
  const match = db.select().from(matches).where(eq(matches.id, matchId)).get();
  if (!match) throw Errors.notFound("Матч");

  const matchTeamRows = db
    .select()
    .from(matchTeams)
    .where(eq(matchTeams.matchId, matchId))
    .all();

  const teams = matchTeamRows.map((mt) => {
    const compTeam = db
      .select()
      .from(competitionTeams)
      .where(eq(competitionTeams.id, mt.compTeamId))
      .get()!;

    const players = db
      .select()
      .from(matchTeamPlayers)
      .where(
        and(
          eq(matchTeamPlayers.matchId, matchId),
          eq(matchTeamPlayers.compTeamId, mt.compTeamId)
        )
      )
      .all();

    return {
      compTeam,
      teamSlot: mt.teamSlot,
      digitalStartSide: mt.digitalStartSide ?? null,
      physicalStartSide: mt.physicalStartSide ?? null,
      players,
    };
  });

  const digitalRoundsCount = db
    .select({ id: digitalRounds.id })
    .from(digitalRounds)
    .where(eq(digitalRounds.matchId, matchId))
    .all()
    .length;

  const physicalRoundsCount = db
    .select({ id: physicalRounds.id })
    .from(physicalRounds)
    .where(eq(physicalRounds.matchId, matchId))
    .all()
    .length;

  const violationsCount = db
    .select({ id: matchViolations.id })
    .from(matchViolations)
    .where(eq(matchViolations.matchId, matchId))
    .all()
    .length;

  return { match, teams, digitalRoundsCount, physicalRoundsCount, violationsCount };
}

// -------------------------------------------------------
// Создание матча
// -------------------------------------------------------

export function createMatch(data: any, createdBy: number): Match {
  const { matchJudges, ...matchData } = data;

  const comp = db
    .select({ id: competitions.id, status: competitions.status })
    .from(competitions)
    .where(eq(competitions.id, matchData.competitionId))
    .get();
  if (!comp) throw Errors.notFound("Соревнование");
  if (comp.status === "archived") {
    throw new AppError(400, "BAD_REQUEST", "Нельзя создавать матчи в архивном соревновании");
  }

  const newMatch = db
    .insert(matches)
    .values({ ...matchData, status: "draft", createdBy })
    .returning()
    .get();

  if (matchJudges && Array.isArray(matchJudges) && matchJudges.length > 0) {
    for (const judgeId of matchJudges) {
      db.insert(matchStaff)
        .values({
          matchId: newMatch.id,
          judgeId: judgeId,
          staffRole: "match_judge",
        })
        .run();
    }
  }

  db.insert(matchStatusLog)
    .values({
      matchId: newMatch.id,
      fromStatus: null,
      toStatus: "draft",
      changedBy: createdBy,
      note: "Матч создан",
    })
    .run();

  return newMatch;
}

// -------------------------------------------------------
// Настройка матча (команды, состав, судьи)
// -------------------------------------------------------

export function setupMatchTeams(
  matchId: number,
  team1: { compTeamId: number },
  team2: { compTeamId: number },
  userId: number
): void {
  const match = db.select().from(matches).where(eq(matches.id, matchId)).get();
  if (!match) throw Errors.notFound("Матч");
  if (match.status !== "draft" && match.status !== "setup") {
    throw new AppError(400, "BAD_REQUEST", "Команды можно настраивать только в статусе draft или setup");
  }

  db.delete(matchTeams).where(eq(matchTeams.matchId, matchId)).run();
  db.delete(matchTeamPlayers).where(eq(matchTeamPlayers.matchId, matchId)).run();
  db.delete(matchTeamOfficials).where(eq(matchTeamOfficials.matchId, matchId)).run();

  const addTeam = (
    slot: 1 | 2,
    info: typeof team1
  ) => {
    const compTeam = db
      .select()
      .from(competitionTeams)
      .where(eq(competitionTeams.id, info.compTeamId))
      .get();
    if (!compTeam) throw Errors.notFound(`Команда слот ${slot}`);

    // Привязываем команды без сторон! (Стороны зададут в цифровом и физическом этапах)
    db.insert(matchTeams)
      .values({
        matchId,
        compTeamId: info.compTeamId,
        teamSlot: slot,
      })
      .run();

    const players = db
      .select()
      .from(competitionTeamPlayers)
      .where(eq(competitionTeamPlayers.compTeamId, info.compTeamId))
      .all();

    for (const p of players) {
      db.insert(matchTeamPlayers)
        .values({
          matchId,
          compTeamId: info.compTeamId,
          compPlayerId: p.id,
          fullName: p.fullName,
          number: p.number,
          isReserve: p.isReserve,
          isActive: true,
        })
        .run();
    }

    const officials = db
      .select()
      .from(competitionTeamOfficials)
      .where(eq(competitionTeamOfficials.compTeamId, info.compTeamId))
      .all();

    for (const o of officials) {
      db.insert(matchTeamOfficials)
        .values({
          matchId,
          compTeamId: info.compTeamId,
          fullName: o.fullName,
          role: o.role,
        })
        .run();
    }
  };

  addTeam(1, team1);
  addTeam(2, team2);

  const compStaff = db
    .select()
    .from(competitionStaff)
    .where(eq(competitionStaff.competitionId, match.competitionId))
    .all();

  const currentStaff = db.select().from(matchStaff).where(eq(matchStaff.matchId, matchId)).all();
  db.delete(matchStaff).where(eq(matchStaff.matchId, matchId)).run();
  
  const matchJudges = currentStaff.filter(s => s.staffRole === "match_judge");
  for (const mj of matchJudges) {
    db.insert(matchStaff)
      .values({ matchId, judgeId: mj.judgeId, staffRole: mj.staffRole })
      .run();
  }

  for (const s of compStaff) {
    db.insert(matchStaff)
      .values({
        matchId,
        judgeId: s.judgeId,
        staffRole: s.staffRole,
      })
      .run();
  }

  if (match.status === "draft") {
    db.update(matches)
      .set({ status: "setup", updatedAt: new Date().toISOString() })
      .where(eq(matches.id, matchId))
      .run();

    db.insert(matchStatusLog)
      .values({
        matchId,
        fromStatus: "draft",
        toStatus: "setup",
        changedBy: userId,
        note: "Команды добавлены",
      })
      .run();
  }
}


// -------------------------------------------------------
// Переходы статусов
// -------------------------------------------------------

export function transitionMatchStatus(
  matchId: number,
  newStatus: MatchStatus,
  userId: number,
  note?: string
): Match {
  const match = db.select().from(matches).where(eq(matches.id, matchId)).get();
  if (!match) throw Errors.notFound("Матч");

  const allowed = STATUS_TRANSITIONS[match.status];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      400,
      "BAD_REQUEST",
      `Переход ${match.status} → ${newStatus} недопустим. Разрешены: ${allowed.join(", ") || "нет"}`
    );
  }

  // МЫ БОЛЬШЕ НЕ ГЕНЕРИРУЕМ РАУНДЫ ТУТ при переходе в digital_phase,
  // потому что фронтенд сам вызовет initDigitalRoundsWithSides кнопкой "Выбрать сторону"!

  if (newStatus === "physical_phase") {
    initPhysicalRounds(matchId); // Физические раунды генерим тут, они подхватят стороны из CS2
  }

  if (newStatus === "finished" || newStatus === "approved") {
    recalcMatchScores(matchId);
  }

  db.update(matches)
    .set({ status: newStatus, updatedAt: new Date().toISOString() })
    .where(eq(matches.id, matchId))
    .run();

  db.insert(matchStatusLog)
    .values({
      matchId,
      fromStatus: match.status,
      toStatus: newStatus,
      changedBy: userId,
      note: note ?? null,
    })
    .run();

  return db.select().from(matches).where(eq(matches.id, matchId)).get()!;
}

// -------------------------------------------------------
// Инициализация раундов
// -------------------------------------------------------

/**
 * Инициализация раундов CS2 с заданными сторонами (Вызывается с фронтенда по кнопке)
 */
export function initDigitalRoundsWithSides(matchId: number, team1StartSide: DigitalSide, userId: number): void {
  const match = db.select().from(matches).where(eq(matches.id, matchId)).get()!;
  const settings = db
    .select()
    .from(competitionSettings)
    .where(eq(competitionSettings.competitionId, match.competitionId))
    .get();

  if (!settings) throw new AppError(500, "INTERNAL_SERVER_ERROR", "Настройки соревнования не найдены");

  // Очищаем старые раунды если были
  db.delete(digitalRounds).where(eq(digitalRounds.matchId, matchId)).run();

  const matchTeamRows = db
    .select()
    .from(matchTeams)
    .where(eq(matchTeams.matchId, matchId))
    .all();

  const team1 = matchTeamRows.find((t) => t.teamSlot === 1);
  const team2 = matchTeamRows.find((t) => t.teamSlot === 2);
  if (!team1 || !team2) throw new AppError(400, "BAD_REQUEST", "Команды не найдены");

  const team2StartSide: DigitalSide = team1StartSide === "T" ? "CT" : "T";

  // Сохраняем в команды
  db.update(matchTeams).set({ digitalStartSide: team1StartSide }).where(eq(matchTeams.id, team1.id)).run();
  db.update(matchTeams).set({ digitalStartSide: team2StartSide }).where(eq(matchTeams.id, team2.id)).run();

  const half1Rounds = settings.digitalRoundsHalf1; 
  const half2Rounds = settings.digitalRoundsHalf2; 

  let roundNum = 1;

  for (let i = 0; i < half1Rounds; i++) {
    db.insert(digitalRounds)
      .values({
        matchId,
        roundNumber: roundNum++,
        half: 1,
        team1Side: team1StartSide,
        team2Side: team2StartSide,
        status: "pending",
      })
      .run();
  }

  for (let i = 0; i < half2Rounds; i++) {
    db.insert(digitalRounds)
      .values({
        matchId,
        roundNumber: roundNum++,
        half: 2,
        team1Side: team2StartSide,
        team2Side: team1StartSide,
        status: "pending",
      })
      .run();
  }

  // Логируем
  db.insert(matchStatusLog).values({
    matchId,
    fromStatus: match.status,
    toStatus: match.status,
    changedBy: userId,
    note: `Судья сгенерировал раунды CS2: Слот 1 (${team1StartSide}), Слот 2 (${team2StartSide})`,
  }).run();
}


function initPhysicalRounds(matchId: number): void {
  const match = db.select().from(matches).where(eq(matches.id, matchId)).get()!;
  const settings = db
    .select()
    .from(competitionSettings)
    .where(eq(competitionSettings.competitionId, match.competitionId))
    .get();

  if (!settings) return;

  const matchTeamRows = db
    .select()
    .from(matchTeams)
    .where(eq(matchTeams.matchId, matchId))
    .all();

  const team1 = matchTeamRows.find((t) => t.teamSlot === 1);
  const team2 = matchTeamRows.find((t) => t.teamSlot === 2);
  if (!team1 || !team2) return;

  // --- ЛОГИКА ПЕРЕНОСА СТОРОН ИЗ CS2 В ЛАЗЕРТАГ ---
  // Смотрим, кто за кого начал играть в 1 раунде CS2
  const firstDigitalRound = db
    .select()
    .from(digitalRounds)
    .where(and(eq(digitalRounds.matchId, matchId), eq(digitalRounds.roundNumber, 1)))
    .get();

  let team1StartSide: PhysicalSide = "attack"; // дефолт
  
  if (firstDigitalRound) {
    // Если команда 1 была Террористами (T) в CS2, они Атака в Лазертаге. Если CT - Защита.
    if (firstDigitalRound.team1Side === "T") {
      team1StartSide = "attack";
    } else {
      team1StartSide = "defense";
    }
  }

  // Обновляем стартовую сторону лазертага в базе
  const team2StartSide: PhysicalSide = team1StartSide === "attack" ? "defense" : "attack";

  db.update(matchTeams)
    .set({ physicalStartSide: team1StartSide })
    .where(eq(matchTeams.id, team1.id))
    .run();
    
  db.update(matchTeams)
    .set({ physicalStartSide: team2StartSide })
    .where(eq(matchTeams.id, team2.id))
    .run();

  const totalRounds = settings.physTotalRounds;
  const sideSwitchRound = settings.physSideSwitchRound;

  db.delete(physicalRounds).where(eq(physicalRounds.matchId, matchId)).run();

  for (let i = 1; i <= totalRounds; i++) {
    const switched = i > sideSwitchRound;
    const t1Side: PhysicalSide = switched
      ? team1StartSide === "attack" ? "defense" : "attack"
      : team1StartSide;
    const t2Side: PhysicalSide = switched
      ? team2StartSide === "attack" ? "defense" : "attack"
      : team2StartSide;

    db.insert(physicalRounds)
      .values({
        matchId,
        roundNumber: i,
        team1Side: t1Side,
        team2Side: t2Side,
        status: "pending",
      })
      .run();
  }
}

// -------------------------------------------------------
// Пересчёт очков
// -------------------------------------------------------

export function recalcMatchScores(matchId: number): void {
  const match = db.select().from(matches).where(eq(matches.id, matchId)).get();
  if (!match) return;

  const matchTeamRows = db
    .select()
    .from(matchTeams)
    .where(eq(matchTeams.matchId, matchId))
    .all();

  const team1 = matchTeamRows.find((t) => t.teamSlot === 1);
  const team2 = matchTeamRows.find((t) => t.teamSlot === 2);
  if (!team1 || !team2) return;

  const settings = db
    .select()
    .from(competitionSettings)
    .where(eq(competitionSettings.competitionId, match.competitionId))
    .get();

  const dRounds = db
    .select()
    .from(digitalRounds)
    .where(and(eq(digitalRounds.matchId, matchId)))
    .all();

  let scoreDigitalTeam1 = 0;
  let scoreDigitalTeam2 = 0;

  for (const round of dRounds) {
    if (round.status !== "completed") continue;
    if (round.winnerTeamId === team1.compTeamId) {
      scoreDigitalTeam1 += round.pointsAwarded ?? 0;
    } else if (round.winnerTeamId === team2.compTeamId) {
      scoreDigitalTeam2 += round.pointsAwarded ?? 0;
    }
  }

  const pRounds = db
    .select()
    .from(physicalRounds)
    .where(eq(physicalRounds.matchId, matchId))
    .all();

  let scorePhysicalTeam1 = 0;
  let scorePhysicalTeam2 = 0;

  for (const round of pRounds) {
    if (round.status !== "completed") continue;
    if (round.winnerTeamId === team1.compTeamId) {
      scorePhysicalTeam1 += round.pointsAwarded ?? 0;
    } else if (round.winnerTeamId === team2.compTeamId) {
      scorePhysicalTeam2 += round.pointsAwarded ?? 0;
    }
  }

  const violations = db
    .select()
    .from(matchViolations)
    .where(eq(matchViolations.matchId, matchId))
    .all();

  for (const v of violations) {
    if (v.compTeamId === team1.compTeamId) {
      scorePhysicalTeam1 -= v.penaltyPts ?? 0;
    } else if (v.compTeamId === team2.compTeamId) {
      scorePhysicalTeam2 -= v.penaltyPts ?? 0;
    }
  }

  const dw = settings?.digitalWeight ?? 1.0;
  const pw = settings?.physicalWeight ?? 1.0;

  const scoreTotalTeam1 = scoreDigitalTeam1 * dw + scorePhysicalTeam1 * pw;
  const scoreTotalTeam2 = scoreDigitalTeam2 * dw + scorePhysicalTeam2 * pw;

  let winnerTeamId: number | null = null;
  if (match.status === "finished" || match.status === "approved" || match.status === "locked") {
    if (scoreTotalTeam1 > scoreTotalTeam2) winnerTeamId = team1.compTeamId;
    else if (scoreTotalTeam2 > scoreTotalTeam1) winnerTeamId = team2.compTeamId;
  }

  db.update(matches)
    .set({
      scoreDigitalTeam1,
      scoreDigitalTeam2,
      scorePhysicalTeam1,
      scorePhysicalTeam2,
      scoreTotalTeam1,
      scoreTotalTeam2,
      winnerTeamId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(matches.id, matchId))
    .run();
}

export function getMatchStatusLog(matchId: number) {
  return db
    .select()
    .from(matchStatusLog)
    .where(eq(matchStatusLog.matchId, matchId))
    .all();
}