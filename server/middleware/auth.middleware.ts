/**
 * MIDDLEWARE АУТЕНТИФИКАЦИИ
 *
 * Проверяет, что пользователь вошёл в систему (сессия активна).
 * Если сессии нет — возвращает 401.
 *
 * Используется как базовый guard для всех /api/v1/* роутов.
 * После прохождения этого middleware req.session.user гарантированно существует.
 */

import type { Request, Response, NextFunction } from "express";
import type { AuthUser } from "../../shared/contracts/api";

// Расширяем типы сессии Express
declare module "express-session" {
  interface SessionData {
    user: AuthUser;
  }
}

/**
 * Требует активную сессию.
 * При отсутствии сессии возвращает 401 Unauthorized.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.session?.user) {
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Требуется авторизация. Войдите в систему.",
      },
    });
    return;
  }
  next();
}

/**
 * Получает текущего авторизованного пользователя из сессии.
 * Используется в route handlers после requireAuth.
 */
export function getCurrentUser(req: Request): AuthUser {
  if (!req.session?.user) {
    throw new Error("getCurrentUser вызван без requireAuth middleware");
  }
  return req.session.user;
}
