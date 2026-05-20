/**
 * РОУТЫ ГЛОБАЛЬНЫХ КОМАНД
 *
 * GET    /api/v1/teams                        — список глобальных команд
 * POST   /api/v1/teams                        — создать команду
 * GET    /api/v1/teams/:id                    — детально
 * PATCH  /api/v1/teams/:id                    — обновить
 * DELETE /api/v1/teams/:id                    — архивировать
 * POST   /api/v1/teams/:id/players            — добавить игрока
 * PATCH  /api/v1/teams/:id/players/:pid       — обновить игрока
 * DELETE /api/v1/teams/:id/players/:pid       — удалить игрока
 * POST   /api/v1/teams/:id/officials          — добавить официальное лицо
 * DELETE /api/v1/teams/:id/officials/:oid     — удалить
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import type { UserRole } from "@shared/schema";
import { z } from "zod";
import {
  getAllGlobalTeams,
  getGlobalTeamById,
  createGlobalTeam,
  updateGlobalTeam,
  archiveGlobalTeam,
  addPlayerToTeam,
  removePlayerFromTeam,
  updatePlayer,
  addOfficialToTeam,
  removeOfficialFromTeam,
} from "../services/global-team.service";

const router = Router();
router.use(requireAuth);

// -------------------------------------------------------
// Список и создание
// -------------------------------------------------------

router.get("/", (req, res, next) => {
  try {
    const includeArchived = req.query.includeArchived === "true";
    const teams = getAllGlobalTeams(!includeArchived);
    res.json({ success: true, data: teams });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

    const team = getGlobalTeamById(id);
    res.json({ success: true, data: team });
  } catch (err) {
    next(err);
  }
});

const teamSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  region: z.string().optional(),
  notes: z.string().optional(),
});

router.post(
  "/",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const parsed = teamSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }

      const team = createGlobalTeam(parsed.data);
      res.status(201).json({ success: true, data: team });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/:id",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

      const parsed = teamSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }

      const team = updateGlobalTeam(id, parsed.data);
      res.json({ success: true, data: team });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/:id",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

      const team = archiveGlobalTeam(id);
      res.json({ success: true, data: team });
    } catch (err) {
      next(err);
    }
  }
);

// -------------------------------------------------------
// Игроки
// -------------------------------------------------------

const playerSchema = z.object({
  fullName: z.string().min(1, "Имя обязательно"),
  number: z.number().int().min(0).optional(),
  position: z.string().optional(),
  isReserve: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

router.post(
  "/:id/players",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

      const parsed = playerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }

      const player = addPlayerToTeam(id, { ...parsed.data, teamId: id });
      res.status(201).json({ success: true, data: player });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/:id/players/:pid",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const pid = parseInt(req.params.pid as string);
      if (isNaN(pid)) return res.status(400).json({ success: false, error: { message: "Некорректный ID игрока" } });

      const parsed = playerSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }

      const player = updatePlayer(pid, parsed.data as any);
      res.json({ success: true, data: player });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/:id/players/:pid",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const pid = parseInt(req.params.pid as string);
      if (isNaN(pid)) return res.status(400).json({ success: false, error: { message: "Некорректный ID игрока" } });

      removePlayerFromTeam(pid);
      res.json({ success: true, data: { deleted: true } });
    } catch (err) {
      next(err);
    }
  }
);

// -------------------------------------------------------
// Официальные лица
// -------------------------------------------------------

const officialSchema = z.object({
  fullName: z.string().min(1, "Имя обязательно"),
  role: z.string().min(1, "Роль обязательна"),
});

router.post(
  "/:id/officials",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

      const parsed = officialSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }

      const official = addOfficialToTeam(id, { ...parsed.data, teamId: id });
      res.status(201).json({ success: true, data: official });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/:id/officials/:oid",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const oid = parseInt(req.params.oid as string);
      if (isNaN(oid)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

      removeOfficialFromTeam(oid);
      res.json({ success: true, data: { deleted: true } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
