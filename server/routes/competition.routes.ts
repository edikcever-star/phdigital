/**
 * РОУТЫ СОРЕВНОВАНИЙ
 *
 * GET    /api/v1/competitions            — список соревнований
 * POST   /api/v1/competitions            — создать соревнование
 * GET    /api/v1/competitions/:id        — детальная информация
 * PATCH  /api/v1/competitions/:id        — обновить
 * GET    /api/v1/competitions/:id/settings — получить настройки (ДОБАВЛЕНО)
 * PATCH  /api/v1/competitions/:id/settings — обновить настройки
 * GET    /api/v1/competitions/:id/teams  — команды соревнования
 * POST   /api/v1/competitions/:id/teams  — добавить команду
 * GET    /api/v1/competitions/:id/staff  — судейская бригада
 * POST   /api/v1/competitions/:id/staff  — добавить судью в бригаду
 */



import * as competitionService from "../services/competition.service";
import { removeStaffFromCompetition } from "../services/competition.service";
import { removeTeamFromCompetition } from "../services/competition.service";
import { Router } from "express";
import { requireAuth, getCurrentUser } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import type { UserRole } from "@shared/schema";
import { z } from "zod";
import {
  getAllCompetitions,
  getCompetitionById,
  createCompetition,
  updateCompetition,
  getCompetitionSettings,
  generateCompetitionBracket,
  updateCompetitionSettings,
  getCompetitionTeams,
  addTeamToCompetition,
  getCompetitionStaff,
  addStaffToCompetition,
} from "../services/competition.service";

const router = Router();

// Все роуты соревнований требуют аутентификации
router.use(requireAuth);

// -------------------------------------------------------
// Соревнования
// -------------------------------------------------------

/**
 * GET /api/v1/competitions
 * Список всех соревнований.
 */
router.get("/", (req, res, next) => {
  try {
    const competitions = getAllCompetitions();
    res.json({ success: true, data: competitions });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/competitions/:id
 * Детальная информация о соревновании.
 */
router.get("/:id", (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

    const competition = getCompetitionById(id);
    res.json({ success: true, data: competition });
  } catch (err) {
    next(err);
  }
});

const createCompetitionSchema = z.object({
  name: z.string().min(2, "Название слишком короткое"),
  startDate: z.string().min(1, "Укажите дату начала"),
  endDate: z.string().min(1, "Укажите дату окончания"),
  venue: z.string().optional(),
  format: z.enum(["olympic", "round_robin", "group_playoff"]).optional(),
  status: z.enum(["active", "finished", "archived"]).optional(),
  plannedParticipants: z.number().optional(),
});

/**
 * POST /api/v1/competitions
 * Создать новое соревнование. Доступно: chief_judge, chief_secretary.
 */
router.post(
  "/",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const parsed = createCompetitionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }

      const user = getCurrentUser(req);
      const competition = createCompetition(parsed.data as any, user.id);
      res.status(201).json({ success: true, data: competition });
    } catch (err) {
      next(err);
    }
  }
);

const updateCompetitionSchema = createCompetitionSchema.partial();

/**
 * PATCH /api/v1/competitions/:id
 * Обновить данные соревнования.
 */
router.patch(
  "/:id",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

      const parsed = updateCompetitionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }

      const competition = updateCompetition(id, parsed.data);
      res.json({ success: true, data: competition });
    } catch (err) {
      next(err);
    }
  }
);

// -------------------------------------------------------
// Настройки этапов
// -------------------------------------------------------

/**
 * GET /api/v1/competitions/:id/settings
 * Получить настройки этапов соревнования (ДОБАВЛЕНО)
 */
router.get("/:id/settings", (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

    const settings = getCompetitionSettings(id);
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

const updateSettingsSchema = z.object({
  digitalRoundsHalf1: z.number().int().min(1).max(30).optional(),
  digitalRoundsHalf2: z.number().int().min(1).max(30).optional(),
  overtimeEnabled: z.boolean().optional(),
  overtimeType: z.string().optional(),
  digitalRoundWinPts: z.number().min(0).optional(),
  physTotalRounds: z.number().int().min(1).max(50).optional(),
  physSideSwitchRound: z.number().int().min(1).optional(),
  physActivationPts: z.number().min(0).optional(),
  physExplosionPts: z.number().min(0).optional(),
  physDeactivationPts: z.number().min(0).optional(),
  physFragWinPts: z.number().min(0).optional(),
  digitalWeight: z.number().min(0).max(10).optional(),
  physicalWeight: z.number().min(0).max(10).optional(),
});

/**
 * PATCH /api/v1/competitions/:id/settings
 * Обновить настройки этапов соревнования.
 */
router.patch(
  "/:id/settings",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

      const parsed = updateSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }

      const settings = updateCompetitionSettings(id, parsed.data);
      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  }
);

// -------------------------------------------------------
// Команды соревнования
// -------------------------------------------------------


/**
 * GET /api/v1/competitions/:id/teams
 * Список команд с игроками.
 */
router.get("/:id/teams", (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

    const teams = getCompetitionTeams(id);
    res.json({ success: true, data: teams });
  } catch (err) {
    next(err);
  }
});

const addTeamSchema = z.object({
  name: z.string().min(1, "Название команды обязательно"),
  globalTeamId: z.number().int().positive().optional(),
  region: z.string().optional(),
  copyFromGlobal: z.boolean().optional().default(true),
});

/**
 * POST /api/v1/competitions/:id/teams
 * Добавить команду в соревнование.
 */
router.post(
  "/:id/teams",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

      const parsed = addTeamSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }

      const team = addTeamToCompetition(id, parsed.data as any);
      res.status(201).json({ success: true, data: team });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/competitions/:id/teams/:teamId
 * Удалить команду из соревнования.
 */
router.delete(
  "/:id/teams/:teamId",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const competitionId = parseInt(req.params.id as string);
      const teamId = parseInt(req.params.teamId as string);
      
      if (isNaN(competitionId) || isNaN(teamId)) {
        return res.status(400).json({ success: false, error: { message: "Некорректные параметры" } });
      }

      removeTeamFromCompetition(competitionId, teamId);
      res.json({ success: true, message: "Команда удалена" });
    } catch (err) {
      next(err);
    }
  }
);



// -------------------------------------------------------
// Судейская бригада соревнования
// -------------------------------------------------------




/**
 * GET /api/v1/competitions/:id/staff
 * Список судейской бригады.
 */
router.get("/:id/staff", (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

    const staff = getCompetitionStaff(id);
    res.json({ success: true, data: staff });
  } catch (err) {
    next(err);
  }
});

const addStaffSchema = z.object({
  judgeId: z.number().int().positive(),
  staffRole: z.string().min(1),
});

/**
 * DELETE /api/v1/competitions/:id/staff/:staffId
 * Удалить персонал из соревнования.
 */
router.delete(
  "/:id/staff/:staffId",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const competitionId = parseInt(req.params.id as string);
      const staffId = parseInt(req.params.staffId as string);
      
      if (isNaN(competitionId) || isNaN(staffId)) {
        return res.status(400).json({ success: false, error: { message: "Некорректные параметры" } });
      }

      removeStaffFromCompetition(competitionId, staffId);
      res.json({ success: true, message: "Судья удален" });
    } catch (err) {
      next(err);
    }
  }
);



/**
 * POST /api/v1/competitions/:id/staff
 * Добавить судью в бригаду соревнования.
 */
router.post(
  "/:id/staff",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

      const parsed = addStaffSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }

      const entry = addStaffToCompetition(id, parsed.data.judgeId, parsed.data.staffRole);
      res.status(201).json({ success: true, data: entry });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// УПРАВЛЕНИЕ СОСТАВАМИ РУЧНЫХ КОМАНД (ИГРОКИ И ПЕРСОНАЛ)
// ============================================================================

// Назначить/снять капитана
router.patch("/:id/teams/:teamId/players/:playerId/captain", (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const playerId = parseInt(req.params.playerId);
    const { isCaptain } = req.body;

    if (isNaN(teamId) || isNaN(playerId)) {
      return res.status(400).json({ success: false, message: "Неверный ID команды или игрока" });
    }

    // Если назначаем — снимаем со всей команды и ставим на этого
    // Если снимаем — просто сбрасываем null
    competitionService.setTeamCaptain(teamId, isCaptain ? playerId : null);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Добавить игрока в команду
router.post("/:id/teams/:teamId/players", (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) return res.status(400).json({ success: false, message: "Неверный ID команды" });

    const player = competitionService.addPlayerToTeam(teamId, req.body);
    res.json({ success: true, data: player });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Удалить игрока из команды
router.delete("/:id/teams/:teamId/players/:playerId", (req, res) => {
  try {
    const playerId = parseInt(req.params.playerId);
    if (isNaN(playerId)) return res.status(400).json({ success: false, message: "Неверный ID игрока" });

    competitionService.removePlayerFromTeam(playerId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Добавить официальное лицо (тренера) в команду
router.post("/:id/teams/:teamId/officials", (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) return res.status(400).json({ success: false, message: "Неверный ID команды" });

    const official = competitionService.addOfficialToTeam(teamId, req.body);
    res.json({ success: true, data: official });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Удалить официальное лицо из команды
router.delete("/:id/teams/:teamId/officials/:officialId", (req, res) => {
  try {
    const officialId = parseInt(req.params.officialId);
    if (isNaN(officialId)) return res.status(400).json({ success: false, message: "Неверный ID тренера" });

    competitionService.removeOfficialFromTeam(officialId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ============================================================================
// ГЕНЕРАЦИЯ ТУРНИРНОЙ СЕТКИ (ФОРМАТ ПРОВЕДЕНИЯ)
// ============================================================================

/**
 * POST /api/v1/competitions/:id/generate-bracket
 * Сгенерировать матчи на основе команд и формата соревнования.
 */
router.post(
  "/:id/generate-bracket",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

      const matches = competitionService.generateCompetitionBracket(id);
      res.status(201).json({ success: true, data: matches, message: "Турнирная сетка успешно сгенерирована" });
    } catch (err) {
      next(err);
    }
  }
);


export default router;