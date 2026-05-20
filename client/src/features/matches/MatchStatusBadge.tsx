/**
 * КОМПОНЕНТ БЕЙДЖА СТАТУСА МАТЧА
 *
 * Отображает статус матча в виде цветного бейджа с русской меткой.
 * Используется на странице настройки матча и в списке матчей.
 */

import { Badge } from "@/components/ui/badge";
import type { MatchStatus } from "@shared/schema";

/** Конфигурация отображения каждого статуса */
const STATUS_CONFIG: Record<MatchStatus, { label: string; className: string }> = {
  draft: {
    label: "Черновик",
    className: "bg-muted/50 text-muted-foreground border-border",
  },
  setup: {
    label: "Настройка",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  digital_phase: {
    label: "Цифровой этап",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  physical_phase: {
    label: "Физический этап",
    className: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  },
  finished: {
    label: "Завершён",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  approved: {
    label: "Утверждён",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  locked: {
    label: "Заблокирован",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
  },
};

interface MatchStatusBadgeProps {
  status: MatchStatus;
  className?: string;
}

/**
 * Бейдж статуса матча.
 * Автоматически подбирает цвет и метку по значению статуса.
 */
export function MatchStatusBadge({ status, className }: MatchStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;

  return (
    <Badge
      variant="outline"
      data-testid={`match-status-badge-${status}`}
      className={`text-xs font-medium ${config.className} ${className ?? ""}`}
    >
      {config.label}
    </Badge>
  );
}

/**
 * Получить конфигурацию статуса матча (для внешнего использования).
 */
export function getMatchStatusConfig(status: MatchStatus) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
}

export { STATUS_CONFIG as MATCH_STATUS_CONFIG };
