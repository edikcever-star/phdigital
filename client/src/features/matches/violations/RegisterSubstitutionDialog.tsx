/**
 * ДИАЛОГ РЕГИСТРАЦИИ ЗАМЕНЫ
 *
 * Позволяет зарегистрировать замену в матче:
 * - выбрать команду;
 * - указать игрока, который выходит;
 * - указать игрока, который входит;
 * - выбрать фазу;
 * - при необходимости указать номер раунда и заметку.
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { fetchMatch } from "../matches.api";
import { registerSubstitution } from "./violations.api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { Phase } from "@shared/schema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: number;
}

const PHASE_LABELS: Record<Phase, string> = {
  digital: "Цифровой",
  physical: "Физический",
  general: "Общее",
};

export function RegisterSubstitutionDialog({
  open,
  onOpenChange,
  matchId,
}: Props) {
  const { toast } = useToast();

  // -----------------------------
  // Состояние формы
  // -----------------------------
  const [compTeamId, setCompTeamId] = useState<string>("");
  const [playerOutId, setPlayerOutId] = useState<string>("");
  const [playerInId, setPlayerInId] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("general");
  const [roundNumber, setRoundNumber] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // -----------------------------
  // Данные матча: команды и игроки
  // -----------------------------
  const { data: matchData } = useQuery({
    queryKey: ["/api/v1/matches", matchId],
    queryFn: () => fetchMatch(matchId),
    enabled: open && matchId > 0,
  });

  /**
   * Безопасно нормализуем список команд.
   * Оставляем только те элементы, где есть compTeamId.
   */
  const teams = useMemo(() => {
    const raw = Array.isArray(matchData?.teams) ? matchData.teams : [];
    return raw.filter(
      (t): t is NonNullable<typeof t> =>
        Boolean(t && t.compTeamId != null)
    );
  }, [matchData]);

  /**
   * Безопасно нормализуем список игроков.
   * Оставляем только элементы, где есть id.
   */
  const allPlayers = useMemo(() => {
    const raw = Array.isArray(matchData?.players) ? matchData.players : [];
    return raw.filter(
      (p): p is NonNullable<typeof p> =>
        Boolean(p && p.id != null)
    );
  }, [matchData]);

  /**
   * Игроки выбранной команды.
   */
  const playersOfTeam = useMemo(() => {
    if (!compTeamId) return [];
    return allPlayers.filter((p) => p.compTeamId === Number(compTeamId));
  }, [allPlayers, compTeamId]);

  /**
   * При смене команды сбрасываем выбранных игроков,
   * чтобы не осталось старое значение от другой команды.
   */
  useEffect(() => {
    setPlayerOutId("");
    setPlayerInId("");
  }, [compTeamId]);

  /**
   * Закрытие диалога с полной очисткой формы.
   */
  function handleClose() {
    setCompTeamId("");
    setPlayerOutId("");
    setPlayerInId("");
    setPhase("general");
    setRoundNumber("");
    setNote("");
    onOpenChange(false);
  }

  // -----------------------------
  // Мутация регистрации замены
  // -----------------------------
  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        compTeamId: Number(compTeamId),
        playerOutId: Number(playerOutId),
        playerInId: Number(playerInId),
        phase,
        roundNumber:
          roundNumber.trim() !== "" ? Number(roundNumber) : undefined,
        note: note.trim() !== "" ? note.trim() : undefined,
      };

      if (!Number.isFinite(payload.compTeamId) || payload.compTeamId <= 0) {
        throw new Error("Выберите корректную команду");
      }

      if (!Number.isFinite(payload.playerOutId) || payload.playerOutId <= 0) {
        throw new Error("Выберите игрока, который выходит");
      }

      if (!Number.isFinite(payload.playerInId) || payload.playerInId <= 0) {
        throw new Error("Выберите игрока, который входит");
      }

      if (payload.playerOutId === payload.playerInId) {
        throw new Error("Игрок на выход и на вход не могут совпадать");
      }

      if (
        payload.roundNumber !== undefined &&
        (!Number.isFinite(payload.roundNumber) || payload.roundNumber <= 0)
      ) {
        throw new Error("Раунд должен быть больше 0");
      }

      return registerSubstitution(matchId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/v1/matches", matchId, "substitutions"],
      });

      toast({
        title: "Замена зарегистрирована",
        description: "Замена успешно сохранена в протоколе матча.",
      });

      handleClose();
    },
    onError: (err) => {
      toast({
        title: "Ошибка",
        description:
          err instanceof Error ? err.message : "Не удалось зарегистрировать замену",
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Зарегистрировать замену</DialogTitle>
          <DialogDescription>
            Выберите команду, игрока на выход, игрока на вход, фазу и при необходимости укажите раунд.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Команда */}
          <div className="space-y-1.5">
            <Label htmlFor="sub-team">Команда *</Label>
            <Select value={compTeamId} onValueChange={setCompTeamId}>
              <SelectTrigger id="sub-team" data-testid="select-substitution-team">
                <SelectValue placeholder="Выберите команду" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem
                    key={`sub-team-${t.compTeamId}`}
                    value={String(t.compTeamId)}
                  >
                    {t.team?.name ?? `Команда #${t.compTeamId}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Игрок выходит */}
          <div className="space-y-1.5">
            <Label htmlFor="sub-player-out">Игрок выходит *</Label>
            <Select
              value={playerOutId}
              onValueChange={setPlayerOutId}
              disabled={!compTeamId}
            >
              <SelectTrigger
                id="sub-player-out"
                data-testid="select-substitution-player-out"
              >
                <SelectValue placeholder="Выберите игрока" />
              </SelectTrigger>
              <SelectContent>
                {playersOfTeam.map((p) => (
                  <SelectItem
                    key={`sub-player-out-${p.id}`}
                    value={String(p.id)}
                  >
                    {p.number ? `#${p.number} ` : ""}
                    {p.fullName ?? `Игрок #${p.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Игрок входит */}
          <div className="space-y-1.5">
            <Label htmlFor="sub-player-in">Игрок входит *</Label>
            <Select
              value={playerInId}
              onValueChange={setPlayerInId}
              disabled={!compTeamId}
            >
              <SelectTrigger
                id="sub-player-in"
                data-testid="select-substitution-player-in"
              >
                <SelectValue placeholder="Выберите игрока" />
              </SelectTrigger>
              <SelectContent>
                {playersOfTeam
                  .filter((p) => String(p.id) !== playerOutId)
                  .map((p) => (
                    <SelectItem
                      key={`sub-player-in-${p.id}`}
                      value={String(p.id)}
                    >
                      {p.number ? `#${p.number} ` : ""}
                      {p.fullName ?? `Игрок #${p.id}`}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Фаза */}
          <div className="space-y-1.5">
            <Label htmlFor="sub-phase">Фаза *</Label>
            <Select value={phase} onValueChange={(v) => setPhase(v as Phase)}>
              <SelectTrigger id="sub-phase" data-testid="select-substitution-phase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["digital", "physical", "general"] as Phase[]).map((p) => (
                  <SelectItem key={`sub-phase-${p}`} value={p}>
                    {PHASE_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Раунд */}
          <div className="space-y-1.5">
            <Label htmlFor="sub-round">
              Раунд{" "}
              <span className="text-muted-foreground text-xs">(не обязательно)</span>
            </Label>
            <Input
              id="sub-round"
              data-testid="input-substitution-round"
              type="number"
              min={1}
              placeholder="Например, 3"
              value={roundNumber}
              onChange={(e) => setRoundNumber(e.target.value)}
            />
          </div>

          {/* Заметка */}
          <div className="space-y-1.5">
            <Label htmlFor="sub-note">
              Заметка{" "}
              <span className="text-muted-foreground text-xs">(не обязательно)</span>
            </Label>
            <Textarea
              id="sub-note"
              data-testid="input-substitution-note"
              placeholder="Причина или комментарий..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={mutation.isPending}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              data-testid="btn-submit-substitution"
              disabled={
                !compTeamId || !playerOutId || !playerInId || mutation.isPending
              }
            >
              {mutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Зарегистрировать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}