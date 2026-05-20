/**
 * Константы статусов матча и разрешённых переходов.
 *
 * Эта таблица переходов — единственный источник истины для логики статусов.
 * Используется в match-transitions.ts для валидации команд клиента.
 */

import type { MatchStatus, UserRole } from "../schema";

// -----------------------------------------------------------
// Описание статусов для UI
// -----------------------------------------------------------

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  draft: "Черновик",
  setup: "Настройка",
  digital_phase: "Цифровой этап",
  physical_phase: "Физический этап",
  finished: "Завершён",
  approved: "Утверждён",
  locked: "Заблокирован",
};

export const MATCH_STATUS_COLORS: Record<MatchStatus, string> = {
  draft: "gray",
  setup: "blue",
  digital_phase: "cyan",
  physical_phase: "orange",
  finished: "yellow",
  approved: "green",
  locked: "purple",
};

// -----------------------------------------------------------
// Таблица разрешённых переходов статусов
// [fromStatus] → [toStatus, allowedRoles, description]
// -----------------------------------------------------------

export interface StatusTransition {
  from: MatchStatus;
  to: MatchStatus;
  allowedRoles: UserRole[];
  label: string;
  requiresConfirmation: boolean;
}

export const STATUS_TRANSITIONS: StatusTransition[] = [
  {
    from: "draft",
    to: "setup",
    allowedRoles: ["chief_judge", "chief_secretary"],
    label: "Начать настройку",
    requiresConfirmation: false,
  },
  {
    from: "setup",
    to: "digital_phase",
    allowedRoles: ["chief_judge", "chief_secretary"],
    label: "Начать матч (цифровой этап)",
    requiresConfirmation: true,
  },
  {
    from: "digital_phase",
    to: "physical_phase",
    allowedRoles: ["chief_judge", "chief_secretary"],
    label: "Перейти к физическому этапу",
    requiresConfirmation: true,
  },
  {
    from: "physical_phase",
    to: "finished",
    allowedRoles: ["chief_judge", "chief_secretary"],
    label: "Завершить матч",
    requiresConfirmation: true,
  },
  {
    from: "finished",
    to: "approved",
    allowedRoles: ["chief_judge", "chief_secretary"],
    label: "Утвердить протокол",
    requiresConfirmation: true,
  },
  {
    from: "approved",
    to: "locked",
    allowedRoles: ["chief_judge"],
    label: "Заблокировать протокол",
    requiresConfirmation: true,
  },
  // Разблокировка — только назад в setup (для исправлений)
  {
    from: "approved",
    to: "setup",
    allowedRoles: ["chief_judge"],
    label: "Разблокировать для правки",
    requiresConfirmation: true,
  },
  {
    from: "locked",
    to: "setup",
    allowedRoles: ["chief_judge"],
    label: "Разблокировать",
    requiresConfirmation: true,
  },
];

// -----------------------------------------------------------
// Вспомогательные функции
// -----------------------------------------------------------

/** Можно ли редактировать данные матча в текущем статусе? */
export function canEditMatchData(status: MatchStatus): boolean {
  return ["setup", "digital_phase", "physical_phase"].includes(status);
}

/** Можно ли вводить данные цифрового этапа? */
export function canEditDigitalRounds(status: MatchStatus): boolean {
  return status === "digital_phase";
}

/** Можно ли вводить данные физического этапа? */
export function canEditPhysicalRounds(status: MatchStatus): boolean {
  return status === "physical_phase";
}

/** Можно ли регистрировать нарушения и замены? */
export function canEditViolations(status: MatchStatus): boolean {
  return ["digital_phase", "physical_phase"].includes(status);
}

/** Является ли матч завершённым (read-only для данных)? */
export function isMatchReadOnly(status: MatchStatus): boolean {
  return ["finished", "approved", "locked"].includes(status);
}

/** Доступна ли кнопка перехода для данной роли? */
export function canTransition(
  from: MatchStatus,
  to: MatchStatus,
  role: UserRole
): boolean {
  const transition = STATUS_TRANSITIONS.find(
    (t) => t.from === from && t.to === to
  );
  return transition ? transition.allowedRoles.includes(role) : false;
}

/** Получить список доступных переходов из текущего статуса */
export function getAvailableTransitions(
  from: MatchStatus,
  role: UserRole
): StatusTransition[] {
  return STATUS_TRANSITIONS.filter(
    (t) => t.from === from && t.allowedRoles.includes(role)
  );
}
