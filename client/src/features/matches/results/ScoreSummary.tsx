/**
 * КОМПОНЕНТ ИТОГОВОГО СЧЁТА МАТЧА
 *
 * Отображает крупный финальный счёт, победителя, очки по этапам
 * и штрафные очки обеих команд.
 *
 * Используется на странице MatchResultsPage.
 */

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Trophy, Minus } from "lucide-react";

// -----------------------------------------------------------
// Интерфейс пропсов
// -----------------------------------------------------------

export interface ScoreSummaryProps {
  /** Название первой команды */
  team1Name: string;
  /** Название второй команды */
  team2Name: string;
  /** Победа первой команды в цифровом этапе (раунды) */
  digitalTeam1: number;
  /** Победа второй команды в цифровом этапе (раунды) */
  digitalTeam2: number;
  /** Очки первой команды в физическом этапе */
  physicalTeam1: number;
  /** Очки второй команды в физическом этапе */
  physicalTeam2: number;
  /** Итоговые очки первой команды */
  totalTeam1: number;
  /** Итоговые очки второй команды */
  totalTeam2: number;
  /** Штрафные очки первой команды */
  penaltyTeam1: number;
  /** Штрафные очки второй команды */
  penaltyTeam2: number;
  /** Слот победителя: 1, 2 или null при ничьей */
  winnerTeamSlot: 1 | 2 | null;
}

// -----------------------------------------------------------
// Вспомогательный компонент: ряд детализации очков
// -----------------------------------------------------------

interface ScoreRowProps {
  label: string;
  value1: number;
  value2: number;
  /** Подсветить меньшее значение как проигравшее */
  lowerIsBetter?: boolean;
  /** Класс для метки */
  labelClassName?: string;
}

function ScoreRow({
  label,
  value1,
  value2,
  lowerIsBetter = false,
  labelClassName,
}: ScoreRowProps) {
  // Определяем кто лидирует для подсветки
  const team1Leads = lowerIsBetter ? value1 < value2 : value1 > value2;
  const team2Leads = lowerIsBetter ? value2 < value1 : value2 > value1;

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span
        className={cn(
          "text-sm font-semibold tabular-nums min-w-[2.5rem] text-right",
          team1Leads ? "text-green-400" : "text-foreground/70"
        )}
      >
        {value1}
      </span>
      <span
        className={cn(
          "flex-1 text-center text-xs text-muted-foreground",
          labelClassName
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums min-w-[2.5rem] text-left",
          team2Leads ? "text-green-400" : "text-foreground/70"
        )}
      >
        {value2}
      </span>
    </div>
  );
}

// -----------------------------------------------------------
// Основной компонент
// -----------------------------------------------------------

export function ScoreSummary({
  team1Name,
  team2Name,
  digitalTeam1,
  digitalTeam2,
  physicalTeam1,
  physicalTeam2,
  totalTeam1,
  totalTeam2,
  penaltyTeam1,
  penaltyTeam2,
  winnerTeamSlot,
}: ScoreSummaryProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* ——————————————————————————————————
          Верхняя панель: крупный счёт
      —————————————————————————————————— */}
      <div className="relative flex items-center justify-center gap-0 px-6 py-8 bg-gradient-to-b from-card to-card/80">
        {/* Команда 1 */}
        <div
          className={cn(
            "flex flex-col items-center gap-2 flex-1 px-4 py-3 rounded-l-lg border",
            winnerTeamSlot === 1
              ? "border-green-500/50 bg-green-500/5"
              : "border-transparent bg-transparent"
          )}
        >
          {winnerTeamSlot === 1 && (
            <Trophy className="w-4 h-4 text-green-400" />
          )}
          <span
            className={cn(
              "text-sm font-semibold text-center leading-tight max-w-[140px] break-words",
              winnerTeamSlot === 1 ? "text-green-400" : "text-foreground"
            )}
          >
            {team1Name}
          </span>
          {winnerTeamSlot === 1 && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-green-500/40 text-green-400"
            >
              Победитель
            </Badge>
          )}
        </div>

        {/* Итоговый счёт */}
        <div className="flex items-center gap-4 px-6">
          <span
            data-testid="results-score-team1"
            className="text-5xl font-extrabold tabular-nums text-foreground"
          >
            {totalTeam1}
          </span>
          <span className="text-3xl font-light text-muted-foreground">:</span>
          <span
            data-testid="results-score-team2"
            className="text-5xl font-extrabold tabular-nums text-foreground"
          >
            {totalTeam2}
          </span>
        </div>

        {/* Команда 2 */}
        <div
          className={cn(
            "flex flex-col items-center gap-2 flex-1 px-4 py-3 rounded-r-lg border",
            winnerTeamSlot === 2
              ? "border-green-500/50 bg-green-500/5"
              : "border-transparent bg-transparent"
          )}
        >
          {winnerTeamSlot === 2 && (
            <Trophy className="w-4 h-4 text-green-400" />
          )}
          <span
            className={cn(
              "text-sm font-semibold text-center leading-tight max-w-[140px] break-words",
              winnerTeamSlot === 2 ? "text-green-400" : "text-foreground"
            )}
          >
            {team2Name}
          </span>
          {winnerTeamSlot === 2 && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-green-500/40 text-green-400"
            >
              Победитель
            </Badge>
          )}
        </div>
      </div>

      {/* ——————————————————————————————————
          Разделитель с надписью «Детализация»
      —————————————————————————————————— */}
      <div className="flex items-center gap-3 px-6 py-2 border-t border-border bg-muted/20">
        <div className="h-px flex-1 bg-border/50" />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          Детализация очков
        </span>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      {/* ——————————————————————————————————
          Детализация по строкам
      —————————————————————————————————— */}
      <div className="px-6 pb-5 space-y-0">
        <ScoreRow
          label="Цифровой этап (раунды)"
          value1={digitalTeam1}
          value2={digitalTeam2}
        />
        <ScoreRow
          label="Физический этап (очки)"
          value1={physicalTeam1}
          value2={physicalTeam2}
        />

        {/* Разделитель перед штрафами */}
        <div className="flex items-center gap-2 py-1">
          <div className="h-px flex-1 bg-border/30" />
          <Minus className="w-3 h-3 text-border/60" />
          <div className="h-px flex-1 bg-border/30" />
        </div>

        <ScoreRow
          label="Штрафные очки"
          value1={penaltyTeam1}
          value2={penaltyTeam2}
          lowerIsBetter
          labelClassName="text-orange-400/80"
        />

        {/* Итог */}
        <div className="flex items-center justify-between gap-3 pt-2 mt-1 border-t border-border/40">
          <span className="text-base font-bold tabular-nums text-foreground min-w-[2.5rem] text-right">
            {totalTeam1}
          </span>
          <span className="flex-1 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Итого
          </span>
          <span className="text-base font-bold tabular-nums text-foreground min-w-[2.5rem] text-left">
            {totalTeam2}
          </span>
        </div>
      </div>
    </div>
  );
}
