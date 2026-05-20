/**
 * Константы ролей и прав доступа.
 *
 * Используются на сервере для проверки прав (roleMiddleware)
 * и на клиенте для скрытия/отображения элементов UI.
 *
 * ВАЖНО: Фронтенд скрывает кнопки — но сервер ОБЯЗАН
 * повторно проверять права при каждом запросе.
 */

import type { UserRole } from "../schema";

// -----------------------------------------------------------
// Описание ролей для отображения в UI
// -----------------------------------------------------------

export const ROLE_LABELS: Record<UserRole, string> = {
  chief_judge: "Главный судья",
  chief_secretary: "Главный секретарь",
  deputy_judge: "Заместитель судьи",
  tech_secretary: "Технический секретарь",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  chief_judge: "Полный доступ. Создание/завершение/утверждение матчей.",
  chief_secretary:
    "Полный доступ. Управление соревнованиями и командами.",
  deputy_judge: "Ввод данных этапов, нарушений и замен.",
  tech_secretary: "Ввод данных этапов, нарушений и замен.",
};

// -----------------------------------------------------------
// Группы ролей для проверки прав на сервере
// -----------------------------------------------------------

/** Роли с полным доступом — все модули, утверждение матча */
export const ADMIN_ROLES: UserRole[] = ["chief_judge", "chief_secretary"];

/** Роли, которые могут вводить данные этапов */
export const DATA_ENTRY_ROLES: UserRole[] = [
  "chief_judge",
  "chief_secretary",
  "deputy_judge",
  "tech_secretary",
];

/** Только главный судья может разблокировать завершённый матч */
export const UNLOCK_ROLES: UserRole[] = ["chief_judge"];

/** Роли, которые могут утверждать протокол */
export const APPROVE_ROLES: UserRole[] = ["chief_judge", "chief_secretary"];

// -----------------------------------------------------------
// Проверочные функции (используются в middleware)
// -----------------------------------------------------------

export function isAdmin(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function canEnterData(role: UserRole): boolean {
  return DATA_ENTRY_ROLES.includes(role);
}

export function canApproveMatch(role: UserRole): boolean {
  return APPROVE_ROLES.includes(role);
}

export function canUnlockMatch(role: UserRole): boolean {
  return UNLOCK_ROLES.includes(role);
}

export function canManageCompetition(role: UserRole): boolean {
  return isAdmin(role);
}

export function canEditRosters(role: UserRole): boolean {
  return isAdmin(role);
}

export function canEditReferences(role: UserRole): boolean {
  return isAdmin(role);
}
