/**
 * РЕДАКТОР РАУНДА ЦИФРОВОГО ЭТАПА
 *
 * Компонент для просмотра и изменения данных одного раунда.
 * Используется внутри Sheet (боковой панели) на DigitalPhasePage.
 *
 * Отображает:
 * - Кнопки выбора победителя (CT / T / не сыгран)
 * - Флаги: Активация, Взрыв, Обезвреживание
 * - Тип победы (winType)
 * - Заметку
 * - Кнопки сохранить / отменить
 */

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { updateDigitalRound } from "./digital.api";
import type { DigitalRound, WinTypeDigital } from "@shared/schema";
import type { UpsertDigitalRoundRequest } from "@shared/contracts/api";
import { Loader2, ShieldCheck, Bomb, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------
// Типы и интерфейсы
// -----------------------------------------------------------

export interface RoundEditorProps {
  /** Раунд из базы данных */
  round: DigitalRound;
  /** ID матча для API-запроса */
  matchId: number;
  /** Название команды 1 */
  team1Name: string;
  /** Название команды 2 */
  team2Name: string;
  /** ID команды 1 */
  team1CompTeamId: number;
  /** ID команды 2 */
  team2CompTeamId: number;
  /** Сторона команды 1 в этом раунде */
  team1Side: "CT" | "T";
  /** Разрешено ли редактирование */
  canEdit: boolean;
  /** Вызывается после успешного сохранения */
  onSaved: () => void;
}

/** Метки типов победы */
const WIN_TYPE_LABELS: Record<WinTypeDigital, string> = {
  elimination: "Уничтожение",
  bomb_explode: "Взрыв бомбы",
  bomb_defuse: "Обезвреживание",
  time_out: "Таймаут",
  technical: "Техническая",
};

// -----------------------------------------------------------
// Компонент
// -----------------------------------------------------------

export function RoundEditor({
  round,
  matchId,
  team1Name,
  team2Name,
  team1CompTeamId,
  team2CompTeamId,
  team1Side,
  canEdit,
  onSaved,
}: RoundEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const team2Side: "CT" | "T" = team1Side === "CT" ? "T" : "CT";

  const ctTeamId = useMemo(
    () => (team1Side === "CT" ? team1CompTeamId : team2CompTeamId),
    [team1Side, team1CompTeamId, team2CompTeamId]
  );

  const tTeamId = useMemo(
    () => (team1Side === "T" ? team1CompTeamId : team2CompTeamId),
    [team1Side, team1CompTeamId, team2CompTeamId]
  );

  const ctTeamName = team1Side === "CT" ? team1Name : team2Name;
  const tTeamName = team1Side === "T" ? team1Name : team2Name;

  // -----------------------------------------------------------
  // Локальное состояние формы
  // -----------------------------------------------------------

  const [winnerTeamId, setWinnerTeamId] = useState<number | null>(
    round.winnerTeamId ?? null
  );
  const [activation, setActivation] = useState<boolean>(!!round.activation);
  const [explosion, setExplosion] = useState<boolean>(!!round.explosion);
  const [deactivation, setDeactivation] = useState<boolean>(!!round.deactivation);

  const [winType, setWinType] = useState<WinTypeDigital | "none">(
    round.winType ?? "none"
  );
  const [note, setNote] = useState<string>(round.note ?? "");

  const isCtWinner = winnerTeamId === ctTeamId;
  const isTWinner = winnerTeamId === tTeamId;
  const hasWinner = winnerTeamId !== null;

  // -----------------------------------------------------------
  // Автологика по флагам
  // -----------------------------------------------------------

  function handleToggleExplosion(value: boolean) {
    setExplosion(value);
    if (value) {
      setActivation(true);
      setDeactivation(false);
      if (winType === "none") setWinType("bomb_explode");
    } else if (winType === "bomb_explode") {
      setWinType("none");
    }
  }

  function handleToggleDeactivation(value: boolean) {
    setDeactivation(value);
    if (value) {
      setActivation(true);
      setExplosion(false);
      if (winType === "none") setWinType("bomb_defuse");
    } else if (winType === "bomb_defuse") {
      setWinType("none");
    }
  }

  function handleToggleActivation(value: boolean) {
    setActivation(value);
    if (!value) {
      setExplosion(false);
      setDeactivation(false);
      if (winType === "bomb_explode" || winType === "bomb_defuse") {
        setWinType("none");
      }
    }
  }

  // -----------------------------------------------------------
  // Мутация сохранения
  // -----------------------------------------------------------

  const mutation = useMutation({
    mutationFn: (data: UpsertDigitalRoundRequest) =>
      updateDigitalRound(matchId, round.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/v1/matches", matchId, "digital-rounds"],
      });
      toast({
        title: "Раунд сохранён",
        description: `Раунд ${round.roundNumber} обновлён успешно.`,
      });
      onSaved();
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Ошибка сохранения",
        description: err.message,
      });
    },
  });

  function handleSave() {
    if (hasWinner && winType === "none") {
      toast({
        variant: "destructive",
        title: "Не выбран тип победы",
        description: "Укажите тип победы или снимите победителя.",
      });
      return;
    }

    const payload: UpsertDigitalRoundRequest = {
      roundNumber: round.roundNumber,
      half: round.half,
      activation,
      explosion,
      deactivation,
      winnerTeamId,
      winType: winType === "none" ? null : winType,
      note: note.trim() || null,
      status: hasWinner ? "completed" : "pending",
    };

    mutation.mutate(payload);
  }

  function handleClearWinner() {
    setWinnerTeamId(null);
    setWinType("none");
    setActivation(false);
    setExplosion(false);
    setDeactivation(false);
  }

  return (
    <div className="flex flex-col gap-5 py-1">
      {/* Стороны команд */}
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-2.5">
        <div>
          <span className="text-foreground font-medium">{team1Name}</span>
          <span
            className={cn(
              "ml-1.5 font-bold",
              team1Side === "CT" ? "text-blue-400" : "text-yellow-400"
            )}
          >
            [{team1Side}]
          </span>
        </div>
        <div className="text-right">
          <span
            className={cn(
              "mr-1.5 font-bold",
              team2Side === "CT" ? "text-blue-400" : "text-yellow-400"
            )}
          >
            [{team2Side}]
          </span>
          <span className="text-foreground font-medium">{team2Name}</span>
        </div>
      </div>

      {/* Победитель */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Победитель раунда
        </Label>
        <div className="flex gap-2">
          <Button
            data-testid={`btn-winner-ct-round-${round.roundNumber}`}
            variant="outline"
            size="sm"
            disabled={!canEdit || mutation.isPending}
            onClick={() => setWinnerTeamId(ctTeamId)}
            className={cn(
              "flex-1 gap-1.5",
              isCtWinner && "border-blue-500 bg-blue-500/10 text-blue-400"
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            CT победили
          </Button>

          <Button
            data-testid={`btn-winner-t-round-${round.roundNumber}`}
            variant="outline"
            size="sm"
            disabled={!canEdit || mutation.isPending}
            onClick={() => setWinnerTeamId(tTeamId)}
            className={cn(
              "flex-1 gap-1.5",
              isTWinner && "border-yellow-500 bg-yellow-500/10 text-yellow-400"
            )}
          >
            <Bomb className="w-3.5 h-3.5" />
            T победили
          </Button>

          <Button
            data-testid={`btn-no-winner-round-${round.roundNumber}`}
            variant="outline"
            size="sm"
            disabled={!canEdit || mutation.isPending}
            onClick={handleClearWinner}
            className={cn(
              "flex-none px-3",
              !hasWinner &&
                "border-muted-foreground/50 bg-muted/30 text-muted-foreground"
            )}
          >
            —
          </Button>
        </div>

        <div className="text-[11px] text-muted-foreground">
          CT: <span className="font-medium text-foreground">{ctTeamName}</span>
          {" · "}
          T: <span className="font-medium text-foreground">{tTeamName}</span>
        </div>
      </div>

      {/* Флаги */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Флаги раунда (A/P/D)
        </Label>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`activation-${round.id}`}
              checked={activation}
              onCheckedChange={(v) => handleToggleActivation(!!v)}
              disabled={!canEdit || mutation.isPending}
            />
            <label
              htmlFor={`activation-${round.id}`}
              className="flex cursor-pointer select-none items-center gap-1.5 text-sm"
            >
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              Активация (A)
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id={`explosion-${round.id}`}
              checked={explosion}
              onCheckedChange={(v) => handleToggleExplosion(!!v)}
              disabled={!canEdit || mutation.isPending}
            />
            <label
              htmlFor={`explosion-${round.id}`}
              className="flex cursor-pointer select-none items-center gap-1.5 text-sm"
            >
              <Bomb className="w-3.5 h-3.5 text-red-400" />
              Взрыв (P)
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id={`deactivation-${round.id}`}
              checked={deactivation}
              onCheckedChange={(v) => handleToggleDeactivation(!!v)}
              disabled={!canEdit || mutation.isPending}
            />
            <label
              htmlFor={`deactivation-${round.id}`}
              className="flex cursor-pointer select-none items-center gap-1.5 text-sm"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
              Обезвреживание (D)
            </label>
          </div>
        </div>
      </div>

      {/* Тип победы */}
      <div className="space-y-2">
        <Label
          htmlFor={`win-type-${round.id}`}
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Тип победы
        </Label>
        <Select
          value={winType}
          onValueChange={(v) => setWinType(v as WinTypeDigital | "none")}
          disabled={!canEdit || mutation.isPending || !hasWinner}
        >
          <SelectTrigger
            id={`win-type-${round.id}`}
            data-testid={`select-win-type-round-${round.roundNumber}`}
            className="h-8 text-sm"
          >
            <SelectValue placeholder="Не указан" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Не указан</SelectItem>
            {(Object.keys(WIN_TYPE_LABELS) as WinTypeDigital[]).map((key) => (
              <SelectItem key={key} value={key}>
                {WIN_TYPE_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Заметка */}
      <div className="space-y-2">
        <Label
          htmlFor={`note-${round.id}`}
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Заметка
        </Label>
        <Textarea
          id={`note-${round.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={!canEdit || mutation.isPending}
          placeholder="Необязательный комментарий к раунду..."
          rows={2}
          className="resize-none text-sm"
        />
      </div>

      {/* Действия */}
      {canEdit && (
        <div className="flex gap-2 pt-1">
          <Button
            data-testid={`btn-save-round-${round.roundNumber}`}
            onClick={handleSave}
            disabled={mutation.isPending}
            size="sm"
            className="flex-1 gap-1.5"
          >
            {mutation.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            Сохранить
          </Button>

          <Button
            data-testid={`btn-cancel-round-${round.roundNumber}`}
            variant="outline"
            size="sm"
            onClick={onSaved}
            disabled={mutation.isPending}
            className="flex-none px-4"
          >
            Отмена
          </Button>
        </div>
      )}
    </div>
  );
}