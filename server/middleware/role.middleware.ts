/**
 * MIDDLEWARE ПРОВЕРКИ РОЛЕЙ
 *
 * Проверяет, что авторизованный пользователь имеет нужную роль.
 * Всегда вызывается ПОСЛЕ requireAuth.
 *
 * ВАЖНО: Фронтенд скрывает кнопки на основе роли — но это только UX.
 * Сервер ОБЯЗАН проверять права при каждом запросе независимо от клиента.
 */

import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "../../shared/schema";

/**
 * Создаёт middleware, который допускает только указанные роли.
 *
 * Использование:
 *   router.post('/approve', requireAuth, requireRole(['chief_judge', 'chief_secretary']), handler)
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.session?.user;

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Требуется авторизация." },
      });
      return;
    }

    if (!allowedRoles.includes(user.role as UserRole)) {
      res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Доступ запрещён. Требуется роль: ${allowedRoles.join(" или ")}.`,
          details: {
            yourRole: user.role,
            requiredRoles: allowedRoles,
          },
        },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware для ролей администраторов (главный судья / главный секретарь).
 * Используется для защиты операций создания/редактирования соревнований и матчей.
 */
export const requireAdmin = requireRole(["chief_judge", "chief_secretary"]);

/**
 * Middleware для операций ввода данных.
 * Допускает всех активных пользователей системы.
 */
export const requireDataEntry = requireRole([
  "chief_judge",
  "chief_secretary",
  "deputy_judge",
  "tech_secretary",
]);

/**
 * Middleware только для главного судьи.
 * Используется для разблокировки матча и критических операций.
 */
export const requireChiefJudge = requireRole(["chief_judge"]);

/**
 * Middleware для утверждения протокола.
 */
export const requireApprover = requireRole(["chief_judge", "chief_secretary"]);
