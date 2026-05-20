/**
 * МАРШРУТЫ АУТЕНТИФИКАЦИИ
 *
 * POST /api/v1/auth/login  — вход в систему
 * POST /api/v1/auth/logout — выход
 * GET  /api/v1/auth/me     — текущий пользователь
 * GET  /api/v1/auth/users  — список пользователей (для экрана выбора)
 * POST /api/v1/auth/users  — создание пользователя (admin only)
 * PUT  /api/v1/auth/users/:id — обновление пользователя (admin only)
 */

import { Router } from "express";
import { z } from "zod";
import { loginUser, getAllUsers, createUser, updateUser } from "../services/auth.service";
import { requireAuth, getCurrentUser } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/role.middleware";
import { ROLE_LABELS } from "../../shared/constants/roles";

const router = Router();

// Схемы валидации
const loginSchema = z.object({
  displayName: z.string().min(2, "Имя должно быть не менее 2 символов"),
  role: z.enum(["chief_judge", "chief_secretary", "deputy_judge", "tech_secretary"]),
  pin: z.string().optional(),
});

const createUserSchema = z.object({
  displayName: z.string().min(2),
  role: z.enum(["chief_judge", "chief_secretary", "deputy_judge", "tech_secretary"]),
  pin: z.string().optional(),
});

// -----------------------------------------------------------
// POST /login — вход в систему
// -----------------------------------------------------------
router.post("/login", async (req, res) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Неверные данные для входа.",
        details: parseResult.error.flatten(),
      },
    });
    return;
  }

  const { displayName, role, pin } = parseResult.data;

  const user = await loginUser({ displayName, role, pin });

  if (!user) {
    res.status(401).json({
      success: false,
      error: {
        code: "AUTH_FAILED",
        message: "Неверное имя, роль или PIN.",
      },
    });
    return;
  }

  // Записываем пользователя в сессию
  req.session.user = user;

  // Сохраняем сессию явно (для надёжности)
  req.session.save((err) => {
    if (err) {
      console.error("Ошибка сохранения сессии:", err);
      res.status(500).json({
        success: false,
        error: { code: "SESSION_ERROR", message: "Ошибка создания сессии." },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        user,
        message: `Добро пожаловать, ${user.displayName}! Роль: ${ROLE_LABELS[user.role]}`,
      },
    });
  });
});

// -----------------------------------------------------------
// POST /logout — выход из системы
// -----------------------------------------------------------
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Ошибка уничтожения сессии:", err);
    }
    res.json({ success: true, data: null });
  });
});

// -----------------------------------------------------------
// GET /me — текущий пользователь
// -----------------------------------------------------------
router.get("/me", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  res.json({ success: true, data: user });
});

// -----------------------------------------------------------
// GET /users — список пользователей (для экрана выбора)
// -----------------------------------------------------------
router.get("/users", (req, res) => {
  // Публичный endpoint — возвращает только displayName, role, requiresPin
  const users = getAllUsers();
  res.json({ success: true, data: users });
});

// -----------------------------------------------------------
// POST /users — создание пользователя (admin only)
// -----------------------------------------------------------
router.post("/users", requireAuth, requireAdmin, (req, res) => {
  const parseResult = createUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Неверные данные.",
        details: parseResult.error.flatten(),
      },
    });
    return;
  }

  const user = createUser(parseResult.data);
  res.status(201).json({ success: true, data: user });
});

// -----------------------------------------------------------
// PUT /users/:id — обновление пользователя (admin only)
// -----------------------------------------------------------
router.put("/users/:id", requireAuth, requireAdmin, (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "Неверный ID пользователя." },
    });
    return;
  }

  const updateSchema = z.object({
    displayName: z.string().min(2).optional(),
    role: z
      .enum([
        "chief_judge",
        "chief_secretary",
        "deputy_judge",
        "tech_secretary",
      ])
      .optional(),
    pin: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
  });

  const parseResult = updateSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Неверные данные." },
    });
    return;
  }

  const updated = updateUser(id, parseResult.data as Parameters<typeof updateUser>[1]);
  res.json({ success: true, data: updated });
});

export default router;
