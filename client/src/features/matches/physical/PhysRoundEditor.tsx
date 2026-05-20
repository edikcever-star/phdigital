/**
 * РЕДАКТОР РАУНДА ФИЗИЧЕСКОГО ЭТАПА
 *
 * Встраиваемый компонент для редактирования данных одного раунда.
 * Отображается внутри Sheet (боковая панель) на странице физического этапа.
 *
 * Поля:
 * - fragsTeam1 / fragsTeam2 — очки команд (фраги / количество)
 * - winType    — тип победы (activation, explosion, deactivation, frag_win, technical)
 * - winnerTeamId — ID победившей компетишн-команды (или null)
 * - penaltyPoints — штрафные очки (ОТДЕЛЬНОЕ поле, никогда не смешивать)
 * - status     — "pending" | "completed"
 * - note       — произвольная заметка
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updatePhysicalRound } from "./physical.api";
import type { PhysicalRound, CompetitionSettings, WinTypePhysical } from "@shared/schema";
import type { UpsertPhysicalRoundRequest } from "@shared/contracts/api";

// -------------------------------------------------------
// Локальные константы
// -------------------------------------------------------

/** Метки типов победы */
const WIN_TYPE_LABELS: Record<WinTypePhysical, string> = {
  activation: "Активация",
  explosion: "Подрыв",
  deactivation: "Деактивация",
  frag_win:   "Выживание (фраги)",
  technical:  "Техническая победа",
};

/** Метки сторон */
const SIDE_LABELS: Record<string, string> = {
  attack:  "АТАКА",
  defense: "ЗАЩИТА",
};

// -------------------------------------------------------
// Props
// -------------------------------------------------------

export interface PhysRoundEditorProps {
  /** Раунд для редактирования */
  round: PhysicalRound;
  /** ID матча */
  matchId: number;
  /** Название команды 1 */
  team1Name: string;
  /** Название команды 2 */
  team2Name: string;
  /** ID компетишн-команды 1 (для определения winnerTeamId) */
  team1CompId: number;
  /** ID компетишн-команды 2 */
  team2CompId: number;
  /** Сторона команды 1 в этом раунде */
  team1Side: string;
  /** Может ли текущий пользователь редактировать */
  canEdit: boolean;
  /** Настройки соревнования (для отображения системы очков) */
  settings?: CompetitionSettings;
  /** Колбэк после успешного сохранения */
  onSaved: () => void;
}

// -------------------------------------------------------
// Основной компонент
// -------------------------------------------------------

export function PhysRoundEditor({
  round,
  matchId,
  team1Name,
  team2Name,
  team1CompId,
  team2CompId,
  team1Side,
  canEdit,
  settings,
  onSaved,
}: PhysRoundEditorProps) {
  const qc = useQueryClient();

  // Локальное состояние формы — инициализируем из пришедших данных
  const [fragsTeam1, setFragsTeam1] = useState(String(round.fragsTeam1));
  const [fragsTeam2, setFragsTeam2] = useState(String(round.fragsTeam2));
  const [winnerSlot, setWinnerSlot] = useState<"team1" | "team2" | "none">(() => {
    if (round.winnerTeamId === team1CompId) return "team1";
    if (round.winnerTeamId === team2CompId) return "team2";
    return "none";
  });
  const [winType, setWinType] = useState<WinTypePhysical | "none">(
    round.winType ?? "none"
  );
  const [penaltyPoints, setPenaltyPoints] = useState(String(round.penaltyPoints));
  const [note, setNote] = useState(round.note ?? "");

  // Мутация сохранения
  const mutation = useMutation({
    mutationFn: (data: UpsertPhysicalRoundRequest) =>
      updatePhysicalRound(matchId, round.id, data),
    onSuccess: () => {
      // Инвалидируем кеш раундов физического этапа
      qc.invalidateQueries({
        queryKey: ["/api/v1/matches", matchId, "physical-rounds"],
      });
      onSaved();
    },
  });

  /** Обработчик сохранения формы */
  function handleSave() {
    const team1Frags = parseInt(fragsTeam1) || 0;
    const team2Frags = parseInt(fragsTeam2) || 0;
    const penalty = parseFloat(penaltyPoints) || 0;

    // Определяем ID победителя на основе выбранного слота
    let winnerTeamId: number | null = null;
    if (winnerSlot === "team1") winnerTeamId = team1CompId;
    if (winnerSlot === "team2") winnerTeamId = team2CompId;

    const payload: UpsertPhysicalRoundRequest = {
      roundNumber: round.roundNumber,
      fragsTeam1: team1Frags,
      fragsTeam2: team2Frags,
      winnerTeamId,
      winType:       winType !== "none" ? (winType as WinTypePhysical) : null,
      // Флаги активности (activation/explosion/deactivation)
      activation:    winType === "activation",
      explosion:     winType === "explosion",
      deactivation:  winType === "deactivation",
      // Штрафные очки — всегда в отдельном поле
      penaltyPoints: penalty,
      note: note.trim() || null,
      status: winnerTeamId !== null ? "completed" : "pending",
    };

    mutation.mutate(payload);
  }

  // Определяем сторону команды 2 (всегда противоположная)
  const team2Side = team1Side === "attack" ? "defense" : "attack";

  const isBusy = mutation.isPending;

  return (
    <div className="space-y-5">
      {/* Заголовок раунда */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">
          Раунд {round.roundNumber}
        </h3>
        <Badge
          variant="outline"
          className={
            round.status === "completed"
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-border text-muted-foreground"
          }
        >
          {round.status === "completed" ? "Сыгран" : "Не сыгран"}
        </Badge>
      </div>

      {/* Стороны команд */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg border border-border bg-muted/20 p-2.5 text-center">
          <div className="text-xs text-muted-foreground mb-0.5">{team1Name}</div>
          <div className={`text-xs font-semibold ${team1Side === "attack" ? "text-red-400" : "text-blue-400"}`}>
            {SIDE_LABELS[team1Side] ?? team1Side}
          </div>
        </div>
        <div className="flex items-center text-muted-foreground text-xs">vs</div>
        <div className="flex-1 rounded-lg border border-border bg-muted/20 p-2.5 text-center">
          <div className="text-xs text-muted-foreground mb-0.5">{team2Name}</div>
          <div className={`text-xs font-semibold ${team2Side === "attack" ? "text-red-400" : "text-blue-400"}`}>
            {SIDE_LABELS[team2Side] ?? team2Side}
          </div>
        </div>
      </div>

      {/* Очки команд */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{team1Name} — очки</Label>
          <Input
            data-testid="input-frags-team1"
            type="number"
            min={0}
            value={fragsTeam1}
            onChange={(e) => setFragsTeam1(e.target.value)}
            disabled={!canEdit || isBusy}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{team2Name} — очки</Label>
          <Input
            data-testid="input-frags-team2"
            type="number"
            min={0}
            value={fragsTeam2}
            onChange={(e) => setFragsTeam2(e.target.value)}
            disabled={!canEdit || isBusy}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Тип победы */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Тип победы</Label>
        <Select
          value={winType}
          onValueChange={(v) => setWinType(v as WinTypePhysical | "none")}
          disabled={!canEdit || isBusy}
        >
          <SelectTrigger data-testid="select-win-type" className="h-8 text-sm">
            <SelectValue placeholder="Не определён" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Не определён</SelectItem>
            {(Object.entries(WIN_TYPE_LABELS) as [WinTypePhysical, string][]).map(
              ([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Победитель */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Победитель раунда</Label>
        <div className="flex gap-2">
          <Button
            data-testid="btn-winner-team1"
            type="button"
            size="sm"
            variant={winnerSlot === "team1" ? "default" : "outline"}
            onClick={() => setWinnerSlot(winnerSlot === "team1" ? "none" : "team1")}
            disabled={!canEdit || isBusy}
            className="flex-1 h-8 text-xs"
          >
            {team1Name}
          </Button>
          <Button
            data-testid="btn-winner-team2"
            type="button"
            size="sm"
            variant={winnerSlot === "team2" ? "default" : "outline"}
            onClick={() => setWinnerSlot(winnerSlot === "team2" ? "none" : "team2")}
            disabled={!canEdit || isBusy}
            className="flex-1 h-8 text-xs"
          >
            {team2Name}
          </Button>
          <Button
            data-testid="btn-winner-none"
            type="button"
            size="sm"
            variant={winnerSlot === "none" ? "secondary" : "ghost"}
            onClick={() => setWinnerSlot("none")}
            disabled={!canEdit || isBusy}
            className="h-8 text-xs px-3"
          >
            Ничья
          </Button>
        </div>
      </div>

      {/* Штрафные очки — ОТДЕЛЬНОЕ поле, выделено визуально */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          Штрафные очки
        </Label>
        <Input
          data-testid="input-penalty-points"
          type="number"
          min={0}
          step={0.5}
          value={penaltyPoints}
          onChange={(e) => setPenaltyPoints(e.target.value)}
          disabled={!canEdit || isBusy}
          className={`h-8 text-sm ${parseFloat(penaltyPoints) > 0 ? "border-amber-500/50 text-amber-400" : ""}`}
        />
        {parseFloat(penaltyPoints) > 0 && (
          <p className="text-xs text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Штрафные очки учитываются отдельно
          </p>
        )}
      </div>

      {/* Заметка */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Заметка</Label>
        <Textarea
          data-testid="input-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={!canEdit || isBusy}
          placeholder="Комментарий к раунду..."
          className="text-sm resize-none"
          rows={2}
        />
      </div>

      {/* Справка по системе очков (если есть настройки) */}
      {settings && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Система очков
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-xs text-muted-foreground">Активация</span>
            <span className="text-xs font-semibold text-foreground">
              {settings.physActivationPts} очка
            </span>
            <span className="text-xs text-muted-foreground">Подрыв</span>
            <span className="text-xs font-semibold text-foreground">
              {settings.physExplosionPts} очка
            </span>
            <span className="text-xs text-muted-foreground">Деактивация</span>
            <span className="text-xs font-semibold text-foreground">
              {settings.physDeactivationPts} очко
            </span>
            <span className="text-xs text-muted-foreground">Фраг</span>
            <span className="text-xs font-semibold text-foreground">
              {settings.physFragWinPts} очко
            </span>
          </div>
        </div>
      )}

      {/* Ошибка сохранения */}
      {mutation.isError && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Ошибка сохранения"}
        </p>
      )}

      {/* Кнопка сохранения */}
      {canEdit && (
        <Button
          data-testid="btn-save-round"
          onClick={handleSave}
          disabled={isBusy}
          className="w-full gap-2"
          size="sm"
        >
          {isBusy ? (
            <>
              <span className="animate-spin">⟳</span>
              Сохранение...
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              Сохранить
            </>
          )}
        </Button>
      )}

      {/* Успешное сохранение */}
      {mutation.isSuccess && (
        <p className="text-xs text-green-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Раунд сохранён
        </p>
      )}
    </div>
  );
}
