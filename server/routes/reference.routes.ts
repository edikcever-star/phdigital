/**
 * РОУТЫ СПРАВОЧНИКОВ
 *
 * Судьи, карты (CS2), типы нарушений.
 * Эти данные глобальные — не привязаны к соревнованию.
 *
 * GET/POST /api/v1/references/judges
 * PATCH    /api/v1/references/judges/:id
 * DELETE   /api/v1/references/judges/:id   (deactivate)
 *
 * GET/POST /api/v1/references/maps
 * PATCH    /api/v1/references/maps/:id
 *
 * GET/POST /api/v1/references/violation-types
 * PATCH    /api/v1/references/violation-types/:id
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import type { UserRole } from "@shared/schema";
import { z } from "zod";
import {
  getAllJudges,
  getJudgeById,
  createJudge,
  updateJudge,
  deactivateJudge,
  getAllMaps,
  getMapById,
  createMap,
  updateMap,
  getAllViolationTypes,
  getViolationTypeById,
  createViolationType,
  updateViolationType,
} from "../services/reference.service";

const router = Router();
router.use(requireAuth);

// -------------------------------------------------------
// Судьи
// -------------------------------------------------------

router.get("/judges", (req, res, next) => {
  try {
    const all = req.query.all === "true";
    const judges = getAllJudges(!all);
    res.json({ success: true, data: judges });
  } catch (err) {
    next(err);
  }
});

router.get("/judges/:id", (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });
    res.json({ success: true, data: getJudgeById(id) });
  } catch (err) {
    next(err);
  }
});

const judgeSchema = z.object({
  fullName: z.string().min(2, "ФИО слишком короткое"),
  category: z.string().optional(),
  defaultRole: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

router.post(
  "/judges",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const parsed = judgeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }
      const judge = createJudge(parsed.data);
      res.status(201).json({ success: true, data: judge });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/judges/:id",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

      const parsed = judgeSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }
      res.json({ success: true, data: updateJudge(id, parsed.data) });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/judges/:id",
  requireRole((["chief_judge"] as UserRole[])),
  (req, res, next) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });
      res.json({ success: true, data: deactivateJudge(id) });
    } catch (err) {
      next(err);
    }
  }
);

// -------------------------------------------------------
// Карты CS2
// -------------------------------------------------------

router.get("/maps", (req, res, next) => {
  try {
    const all = req.query.all === "true";
    const mapsList = getAllMaps(!all);
    res.json({ success: true, data: mapsList });
  } catch (err) {
    next(err);
  }
});

router.get("/maps/:id", (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });
    res.json({ success: true, data: getMapById(id) });
  } catch (err) {
    next(err);
  }
});

const mapSchema = z.object({
  name: z.string().min(1, "Название карты обязательно"),
  imagePath: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

router.post(
  "/maps",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const parsed = mapSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }
      const map = createMap(parsed.data);
      res.status(201).json({ success: true, data: map });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/maps/:id",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

      const parsed = mapSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }
      res.json({ success: true, data: updateMap(id, parsed.data) });
    } catch (err) {
      next(err);
    }
  }
);

// -------------------------------------------------------
// Типы нарушений
// -------------------------------------------------------

router.get("/violation-types", (req, res, next) => {
  try {
    const all = req.query.all === "true";
    const types = getAllViolationTypes(!all);
    res.json({ success: true, data: types });
  } catch (err) {
    next(err);
  }
});

router.get("/violation-types/:id", (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });
    res.json({ success: true, data: getViolationTypeById(id) });
  } catch (err) {
    next(err);
  }
});

const violationTypeSchema = z.object({
  article: z.string().min(1, "Статья регламента обязательна"),
  description: z.string().min(1, "Описание обязательно"),
  penaltyPts: z.number().min(0).default(0),
  vtype: z.enum(["warning", "disqualification", "technical", "other"]).optional(),
  isActive: z.boolean().optional().default(true),
});

router.post(
  "/violation-types",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const parsed = violationTypeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }
      const vt = createViolationType(parsed.data);
      res.status(201).json({ success: true, data: vt });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/violation-types/:id",
  requireRole((["chief_judge", "chief_secretary"] as UserRole[])),
  (req, res, next) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ success: false, error: { message: "Некорректный ID" } });

      const parsed = violationTypeSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Ошибка валидации", details: parsed.error.flatten() },
        });
      }
      res.json({ success: true, data: updateViolationType(id, parsed.data) });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
