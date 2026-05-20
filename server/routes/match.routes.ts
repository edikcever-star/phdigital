/**
 * РОУТЫ МАТЧЕЙ
 *
 * GET    /api/v1/matches/:id                     — детальная информация
 * GET    /api/v1/competitions/:cid/matches       — матчи соревнования
 * POST   /api/v1/competitions/:cid/matches       — создать матч
 * POST   /api/v1/matches/:id/setup-teams         — настройка команд
 * POST   /api/v1/matches/:id/transition          — смена статуса
 * GET    /api/v1/matches/:id/status-log          — журнал статусов
 *
 * --- Цифровой этап ---
 * GET    /api/v1/matches/:id/digital-rounds      — данные цифрового этапа (DigitalPhaseDTO)
 * POST   /api/v1/matches/:id/digital-rounds/init — инициализация стартовых сторон и 24 раундов
 * PATCH  /api/v1/matches/:id/digital-rounds/:rid — обновить раунд
 *
 * --- Физический этап ---
 * POST   /api/v1/matches/:id/physical-sides      — инициализация стартовых сторон и раундов лазертага
 * GET    /api/v1/matches/:id/physical-rounds     — список раундов
 * PATCH  /api/v1/matches/:id/physical-rounds/:rid — обновить раунд
 *
 * --- Нарушения и замены ---
 * GET    /api/v1/matches/:id/violations          — нарушения
 * POST   /api/v1/matches/:id/violations          — зарегистрировать
 * DELETE /api/v1/matches/:id/violations/:vid     — удалить
 * GET    /api/v1/matches/:id/substitutions       — замены
 * POST   /api/v1/matches/:id/substitutions       — зарегистрировать
 */

import { Router } from "express";
import { z } from "zod";
import { requireAuth, getCurrentUser } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import type { UserRole } from "@shared/schema";
import {
  getMatchById,
  getMatchesByCompetition,
  createMatch,
  setupMatchTeams,
  transitionMatchStatus,
  getMatchStatusLog,
} from "../services/match.service";
import {
  getDigitalRounds,
  updateDigitalRound,
  getPhysicalRounds,
  updatePhysicalRound,
  initDigitalRounds,
  initPhysicalRounds,
} from "../services/round.service";
import {
  getMatchViolations,
  registerViolation,
  deleteViolation,
  getMatchSubstitutions,
  registerSubstitution,
} from "../services/violation.service";
import { broadcastMatchUpdate } from "../ws/ws-server";

const router = Router();

// Все маршруты матчей требуют авторизации
router.use(requireAuth);

// -------------------------------------------------------
// Вспомогательная функция проверки ID (Улучшена для TypeScript)
// -------------------------------------------------------

function parseIdParam(params: any, key: string) {
  const id = parseInt(params[key] ?? "", 10);
  if (isNaN(id) || id <= 0) return null;
  return id;
}

// -------------------------------------------------------
// Матчи соревнования
// -------------------------------------------------------

const createMatchSchema = z.object({
  competitionId: z.number().int().positive(),
  matchNumber: z.string().optional(),
  stage: z.string().optional(),
  scheduledAt: z.string().optional(),
  expectedViewers: z.number().int().min(0).optional(),
});

/**
 * GET /api/v1/competitions/:cid/matches
 */
router.get("/competitions/:cid/matches", (req, res, next) => {
  try {
    const cid = parseIdParam(req.params, "cid");
    if (!cid) {
      return res
        .status(400)
        .json({ success: false, error: { message: "Некорректный ID соревнования" } });
    }

    const list = getMatchesByCompetition(cid);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/competitions/:cid/matches
 */
router.post(
  "/competitions/:cid/matches",
  requireRole(["chief_judge", "chief_secretary"] as UserRole[]),
  (req, res, next) => {
    try {
      const cid = parseIdParam(req.params, "cid");
      if (!cid) {
        return res
          .status(400)
          .json({ success: false, error: { message: "Некорректный ID соревнования" } });
      }

      const parsed = createMatchSchema.safeParse({
        ...req.body,
        competitionId: cid,
      });

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }

      const user = getCurrentUser(req);
      const match = createMatch(parsed.data as any, user.id);
      res.status(201).json({ success: true, data: match });
    } catch (err) {
      next(err);
    }
  },
);

// -------------------------------------------------------
// Конкретный матч
// -------------------------------------------------------

/**
 * GET /api/v1/matches/:id
 */
router.get("/:id", (req, res, next) => {
  try {
    const id = parseIdParam(req.params, "id");
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: { message: "Некорректный ID матча" } });
    }

    const match = getMatchById(id);
    res.json({ success: true, data: match });
  } catch (err) {
    next(err);
  }
});

const setupTeamsSchema = z.object({
  team1: z.object({
    compTeamId: z.number().int().positive(),
    digitalStartSide: z.enum(["T", "CT"]).optional(),
    physicalStartSide: z.enum(["attack", "defense"]).optional(),
  }),
  team2: z.object({
    compTeamId: z.number().int().positive(),
    digitalStartSide: z.enum(["T", "CT"]).optional(),
    physicalStartSide: z.enum(["attack", "defense"]).optional(),
  }),
});

/**
 * POST /api/v1/matches/:id/setup-teams
 */
router.post(
  "/:id/setup-teams",
  requireRole(["chief_judge", "chief_secretary"] as UserRole[]),
  (req, res, next) => {
    try {
      const id = parseIdParam(req.params, "id");
      if (!id) {
        return res
          .status(400)
          .json({ success: false, error: { message: "Некорректный ID матча" } });
    }

      const parsed = setupTeamsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }

      const user = getCurrentUser(req);
      setupMatchTeams(id, parsed.data.team1, parsed.data.team2, user.id);
      const updated = getMatchById(id);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

const transitionSchema = z.object({
  targetStatus: z
    .enum(["draft", "setup", "digital_phase", "physical_phase", "finished", "approved", "locked"])
    .optional(),
  status: z
    .enum(["draft", "setup", "digital_phase", "physical_phase", "finished", "approved", "locked"])
    .optional(),
  note: z.string().optional(),
});

/**
 * POST /api/v1/matches/:id/transition
 */
router.post(
  "/:id/transition",
  requireRole(["chief_judge", "chief_secretary"] as UserRole[]),
  (req, res, next) => {
    try {
      const id = parseIdParam(req.params, "id");
      if (!id) {
        return res
          .status(400)
          .json({ success: false, error: { message: "Некорректный ID матча" } });
      }

      const parsed = transitionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }

      const user = getCurrentUser(req);
      const targetStatus = parsed.data.targetStatus ?? parsed.data.status;
      if (!targetStatus) {
        return res
          .status(400)
          .json({ success: false, error: { message: "Укажите targetStatus" } });
      }

      const match = transitionMatchStatus(id, targetStatus, user.id, parsed.data.note);
      res.json({ success: true, data: match });

      broadcastMatchUpdate(id, "match:status", {
        matchId: id,
        status: match.status,
        changedBy: user.displayName ?? String(user.id),
        changedAt: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/matches/:id/status-log
 */
router.get("/:id/status-log", (req, res, next) => {
  try {
    const id = parseIdParam(req.params, "id");
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: { message: "Некорректный ID матча" } });
    }

    const log = getMatchStatusLog(id);
    res.json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------
// Цифровой этап
// -------------------------------------------------------

/**
 * POST /api/v1/matches/:id/digital-rounds/init
 * Инициализация раундов цифрового этапа (выбор сторон)
 */
router.post(
  "/:id/digital-rounds/init",
  requireRole(["chief_judge", "chief_secretary", "tech_secretary"] as UserRole[]),
  (req, res, next) => {
    try {
      const matchId = parseIdParam(req.params, "id");
      if (!matchId) {
        return res.status(400).json({ success: false, error: { message: "Некорректный ID матча" } });
      }

      const { team1Side } = req.body;
      if (team1Side !== "T" && team1Side !== "CT") {
        return res.status(400).json({ success: false, error: { message: "Сторона team1Side должна быть 'T' или 'CT'" } });
      }

      // Вызываем сервис
      initDigitalRounds(matchId, team1Side);

      // Оповещаем клиентов
      broadcastMatchUpdate(matchId, "digital_round:updated", { matchId, action: "init" });

      return res.json({ success: true, message: "Раунды успешно сгенерированы" });
    } catch (err: any) {
      if (err.message === "Раунды уже сгенерированы") {
        return res.status(400).json({ success: false, error: { message: err.message } });
      }
      next(err);
    }
  }
);

/**
 * GET /api/v1/matches/:id/digital-rounds
 */
router.get("/:id/digital-rounds", (req, res, next) => {
  try {
    const id = parseIdParam(req.params, "id");
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: { message: "Некорректный ID матча" } });
    }

    const rounds = getDigitalRounds(id);

    if (rounds.length === 0) {
      return res.json({
        success: true,
        data: {
          rounds: [],
          teamStats: null,
          currentHalf: 1,
        },
      });
    }

    const matchDetail = getMatchById(id);
    const team1 = matchDetail.teams.find((t) => t.teamSlot === 1);
    const team2 = matchDetail.teams.find((t) => t.teamSlot === 2);

    if (!team1 || !team2) {
      return res.json({
        success: true,
        data: {
          rounds,
          teamStats: null,
          currentHalf: 1,
        },
      });
    }

    const team1RoundsWon = rounds.filter(
      (r) => r.winnerTeamId === team1.compTeam.id,
    ).length;
    const team2RoundsWon = rounds.filter(
      (r) => r.winnerTeamId === team2.compTeam.id,
    ).length;

    let currentHalf = 1;
    const firstPending = rounds.find(
      (r) => r.status !== "completed" && r.status !== "cancelled",
    );
    if (firstPending) {
      currentHalf = firstPending.half;
    } else {
      currentHalf = rounds.reduce((max, r) => (r.half > max ? r.half : max), 1);
    }

    const dto = {
      rounds,
      teamStats: {
        team1: {
          compTeamId: team1.compTeam.id,
          name: team1.compTeam.name,
          roundsWon: team1RoundsWon,
        },
        team2: {
          compTeamId: team2.compTeam.id,
          name: team2.compTeam.name,
          roundsWon: team2RoundsWon,
        },
      },
      currentHalf,
    };

    return res.json({ success: true, data: dto });
  } catch (err) {
    next(err);
  }
});


const updateDigitalRoundSchema = z.object({
  winnerTeamId: z.number().int().positive().nullable().optional(),
  winType: z
    .enum(["elimination", "bomb_explode", "bomb_defuse", "time_out", "technical"])
    .nullable()
    .optional(),
  activation: z.boolean().optional(),
  explosion: z.boolean().optional(),
  deactivation: z.boolean().optional(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  extraData: z.string().optional(),
  
  // === ДОБАВЬ ЭТИ ДВЕ СТРОКИ СЮДА: ===
  team1Deaths: z.number().int().min(0).max(5).optional(),
  team2Deaths: z.number().int().min(0).max(5).optional(),
});

/**
 * PATCH /api/v1/matches/:id/digital-rounds/:rid
 */
router.patch(
  "/:id/digital-rounds/:rid",
  requireRole(["chief_judge", "chief_secretary", "tech_secretary"] as UserRole[]),
  (req, res, next) => {
    try {
      const matchId = parseIdParam(req.params, "id");
      if (!matchId) {
        return res
          .status(400)
          .json({ success: false, error: { message: "Некорректный ID матча" } });
      }

      const rid = parseIdParam(req.params, "rid");
      if (!rid) {
        return res.status(400).json({
          success: false,
          error: { message: "Некорректный ID раунда" },
        });
      }

      const parsed = updateDigitalRoundSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }

      const user = getCurrentUser(req);
      const round = updateDigitalRound(rid, parsed.data as any, user.id);
      res.json({ success: true, data: round });

      broadcastMatchUpdate(matchId, "digital_round:updated", { matchId, round });
    } catch (err) {
      next(err);
    }
  },
);

// -------------------------------------------------------
// Физический этап
// -------------------------------------------------------

/**
 * POST /api/v1/matches/:id/physical-sides
 * Инициализация раундов физического этапа (Лазертаг)
 */
router.post(
  "/:id/physical-sides",
  requireRole(["chief_judge", "chief_secretary", "tech_secretary"] as UserRole[]),
  (req, res, next) => {
    try {
      const matchId = parseIdParam(req.params, "id");
      if (!matchId) {
        return res.status(400).json({ success: false, error: { message: "Некорректный ID матча" } });
      }

      const { team1Side } = req.body;
      if (team1Side !== "attack" && team1Side !== "defense") {
        return res.status(400).json({ success: false, error: { message: "Сторона должна быть 'attack' или 'defense'" } });
      }

      // Вызываем сервис генерации раундов Лазертага
      initPhysicalRounds(matchId, team1Side);

      // Оповещаем клиентов (чтобы фронт обновился без перезагрузки)
      broadcastMatchUpdate(matchId, "physical_round:updated", { matchId, action: "init" });

      return res.json({ success: true, message: "Раунды физического этапа сгенерированы" });
    } catch (err: any) {
      if (err.message === "Раунды уже сгенерированы") {
        return res.status(400).json({ success: false, error: { message: err.message } });
      }
      next(err);
    }
  }
);

const updatePhysicalRoundSchema = z.object({
  fragsTeam1: z.number().int().min(0).optional(),
  fragsTeam2: z.number().int().min(0).optional(),
  activation: z.boolean().optional(),
  explosion: z.boolean().optional(),
  deactivation: z.boolean().optional(),
  winType: z
    .enum(["frag_win", "activation", "explosion", "deactivation", "technical"])
    .nullable()
    .optional(),
  winnerTeamId: z.number().int().positive().nullable().optional(),
  penaltyPoints: z.number().min(0).optional(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  note: z.string().nullable().optional(),
  extraData: z.string().nullable().optional(),
});

/**
 * GET /api/v1/matches/:id/physical-rounds
 */
router.get("/:id/physical-rounds", (req, res, next) => {
  try {
    const id = parseIdParam(req.params, "id");
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: { message: "Некорректный ID матча" } });
    }

    const rounds = getPhysicalRounds(id);
    res.json({ success: true, data: rounds });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/matches/:id/physical-rounds/:rid
 */
router.patch(
  "/:id/physical-rounds/:rid",
  requireRole(["chief_judge", "chief_secretary", "tech_secretary"] as UserRole[]),
  (req, res, next) => {
    try {
      const matchId = parseIdParam(req.params, "id");
      if (!matchId) {
        return res
          .status(400)
          .json({ success: false, error: { message: "Некорректный ID матча" } });
      }

      const rid = parseIdParam(req.params, "rid");
      if (!rid) {
        return res.status(400).json({
          success: false,
          error: { message: "Некорректный ID раунда" },
        });
      }

      const parsed = updatePhysicalRoundSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }

      const user = getCurrentUser(req);
      const round = updatePhysicalRound(rid, parsed.data as any, user.id);
      res.json({ success: true, data: round });
    } catch (err) {
      next(err);
    }
  },
);

// -------------------------------------------------------
// Нарушения
// -------------------------------------------------------

const registerViolationSchema = z.object({
  compTeamId: z.number().int().positive(),
  matchPlayerId: z.number().int().positive().optional(),
  violationTypeId: z.number().int().positive().optional(),
  phase: z.enum(["digital", "physical", "general"]).default("general"),
  roundNumber: z.number().int().min(1).optional(),
  penaltyPts: z.number().min(0).default(0),
  note: z.string().optional(),
});

/**
 * GET /api/v1/matches/:id/violations
 */
router.get("/:id/violations", (req, res, next) => {
  try {
    const id = parseIdParam(req.params, "id");
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: { message: "Некорректный ID матча" } });
    }

    const violations = getMatchViolations(id);
    res.json({ success: true, data: violations });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/matches/:id/violations
 */
router.post(
  "/:id/violations",
  requireRole(["chief_judge", "chief_secretary", "deputy_judge"] as UserRole[]),
  (req, res, next) => {
    try {
      const id = parseIdParam(req.params, "id");
      if (!id) {
        return res
          .status(400)
          .json({ success: false, error: { message: "Некорректный ID матча" } });
      }

      const parsed = registerViolationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }

      const user = getCurrentUser(req);
      const violation = registerViolation(
        { ...parsed.data, matchId: id } as any,
        user.id,
      );
      res.status(201).json({ success: true, data: violation });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/v1/matches/:id/violations/:vid
 */
router.delete(
  "/:id/violations/:vid",
  requireRole(["chief_judge", "chief_secretary"] as UserRole[]),
  (req, res, next) => {
    try {
      const vid = parseIdParam(req.params, "vid");
      if (!vid) {
        return res
          .status(400)
          .json({ success: false, error: { message: "Некорректный ID нарушения" } });
      }

      const user = getCurrentUser(req);
      deleteViolation(vid, user.id);
      res.json({ success: true, data: { deleted: true } });
    } catch (err) {
      next(err);
    }
  },
);

// -------------------------------------------------------
// Замены
// -------------------------------------------------------

const registerSubstitutionSchema = z.object({
  compTeamId: z.number().int().positive(),
  playerOutId: z.number().int().positive(),
  playerInId: z.number().int().positive(),
  phase: z.enum(["digital", "physical", "general"]),
  roundNumber: z.number().int().min(1).optional(),
  reason: z.string().optional(),
  note: z.string().optional(),
});

/**
 * GET /api/v1/matches/:id/substitutions
 */
router.get("/:id/substitutions", (req, res, next) => {
  try {
    const id = parseIdParam(req.params, "id");
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: { message: "Некорректный ID матча" } });
    }

    const subs = getMatchSubstitutions(id);
    res.json({ success: true, data: subs });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/matches/:id/substitutions
 */
router.post(
  "/:id/substitutions",
  requireRole(["chief_judge", "chief_secretary", "deputy_judge"] as UserRole[]),
  (req, res, next) => {
    try {
      const id = parseIdParam(req.params, "id");
      if (!id) {
        return res
          .status(400)
          .json({ success: false, error: { message: "Некорректный ID матча" } });
      }

      const parsed = registerSubstitutionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }

      const user = getCurrentUser(req);
      const sub = registerSubstitution(
        { ...parsed.data, matchId: id } as any,
        user.id,
      );
      res.status(201).json({ success: true, data: sub });
    } catch (err) {
      next(err);
    }
  },
);

export default router;