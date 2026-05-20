/**
 * ДИАЛОГ РЕГИСТРАЦИИ НАРУШЕНИЯ
 *
 * Позволяет зарегистрировать нарушение для одной из команд матча.
 * При выборе типа нарушения автоматически заполняется поле штрафных очков.
 */

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { registerViolation, fetchViolationTypes } from "./violations.api";
import { fetchMatch } from "../matches.api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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

export function RegisterViolationDialog({
  open,
  onOpenChange,
  matchId,
}: Props) {
  const { toast } = useToast();

  const [compTeamId, setCompTeamId] = useState<string>("");
  const [matchPlayerId, setMatchPlayerId] = useState<string>("team");
  const [violationTypeId, setViolationTypeId] = useState<string>("none");
  const [phase, setPhase] = useState<Phase>("general");
  const [roundNumber, setRoundNumber] = useState<string>("");
  const [penaltyPts, setPenaltyPts] = useState<string>("0");
  const [note, setNote] = useState<string>("");

  const { data: matchData } = useQuery({
    queryKey: ["/api/v1/matches", matchId],
    queryFn: () => fetchMatch(matchId),
    enabled: open && matchId > 0,
  });

  const { data: violationTypes = [] } = useQuery({
    queryKey: ["/api/v1/references/violation-types"],
    queryFn: fetchViolationTypes,
    enabled: open,
  });

  const teams = useMemo(() => {
    const raw = Array.isArray(matchData?.teams) ? matchData.teams : [];
    return raw.filter((t) => t && t.compTeamId != null);
  }, [matchData]);

  const allPlayers = useMemo(() => {
    const raw = Array.isArray(matchData?.players) ? matchData.players : [];
    return raw.filter((p) => p && p.id != null);
  }, [matchData]);

  const playersOfTeam = useMemo(() => {
    if (!compTeamId) return [];
    return allPlayers.filter((p) => p.compTeamId === Number(compTeamId));
  }, [allPlayers, compTeamId]);

  const safeViolationTypes = useMemo(() => {
    return (violationTypes ?? []).filter(
      (v) => v && v.id != null && v.isActive
    );
  }, [violationTypes]);

  useEffect(() => {
    if (!violationTypeId || violationTypeId === "none") {
      setPenaltyPts("0");
      return;
    }

    const vt = safeViolationTypes.find(
      (v) => v.id === Number(violationTypeId)
    );

    setPenaltyPts(String(vt?.penaltyPts ?? 0));
  }, [violationTypeId, safeViolationTypes]);

  useEffect(() => {
    setMatchPlayerId("team");
  }, [compTeamId]);

  function resetForm() {
    setCompTeamId("");
    setMatchPlayerId("team");
    setViolationTypeId("none");
    setPhase("general");
    setRoundNumber("");
    setPenaltyPts("0");
    setNote("");
  }

  function handleClose(nextOpen = false) {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        compTeamId: Number(compTeamId),
        matchPlayerId:
          matchPlayerId && matchPlayerId !== "team"
            ? Number(matchPlayerId)
            : undefined,
        violationTypeId:
          violationTypeId && violationTypeId !== "none"
            ? Number(violationTypeId)
            : undefined,
        phase,
        roundNumber: roundNumber.trim() ? Number(roundNumber) : undefined,
        penaltyPts: Number(penaltyPts || 0),
        note: note.trim() || undefined,
      };

      if (!Number.isFinite(payload.compTeamId) || payload.compTeamId <= 0) {
        throw new Error("Выберите корректную команду");
      }

      if (
        payload.matchPlayerId !== undefined &&
        (!Number.isFinite(payload.matchPlayerId) || payload.matchPlayerId <= 0)
      ) {
        throw new Error("Выберите корректного игрока");
      }

      if (
        payload.violationTypeId !== undefined &&
        (!Number.isFinite(payload.violationTypeId) || payload.violationTypeId <= 0)
      ) {
        throw new Error("Выберите корректный тип нарушения");
      }

      if (
        payload.roundNumber !== undefined &&
        (!Number.isFinite(payload.roundNumber) || payload.roundNumber <= 0)
      ) {
        throw new Error("Раунд должен быть больше 0");
      }

      if (!Number.isFinite(payload.penaltyPts) || payload.penaltyPts < 0) {
        throw new Error("Штрафные очки указаны неверно");
      }

      return registerViolation(matchId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["/api/v1/matches", matchId, "violations"],
      });

      toast({
        title: "Нарушение зарегистрировано",
        description: "Нарушение успешно сохранено в протоколе матча.",
      });

      handleClose(false);
    },
    onError: (err) => {
      toast({
        title: "Ошибка",
        description:
          err instanceof Error
            ? err.message
            : "Не удалось зарегистрировать нарушение",
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
          <DialogTitle>Зарегистрировать нарушение</DialogTitle>
          <DialogDescription>
            Выберите команду, при необходимости игрока и тип нарушения, затем
            укажите фазу, раунд и штрафные очки.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="viol-team">Команда *</Label>
            <Select value={compTeamId} onValueChange={setCompTeamId}>
              <SelectTrigger id="viol-team" data-testid="select-violation-team">
                <SelectValue placeholder="Выберите команду" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem
                    key={`viol-team-${t.compTeamId}`}
                    value={String(t.compTeamId)}
                  >
                    {t.team?.name ?? `Команда #${t.compTeamId}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="viol-player">
              Игрок{" "}
              <span className="text-muted-foreground text-xs">
                (не обязательно)
              </span>
            </Label>
            <Select
              value={matchPlayerId}
              onValueChange={setMatchPlayerId}
              disabled={!compTeamId}
            >
              <SelectTrigger
                id="viol-player"
                data-testid="select-violation-player"
              >
                <SelectValue placeholder="Командное нарушение" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">— Командное нарушение</SelectItem>
                {playersOfTeam.map((p) => (
                  <SelectItem
                    key={`viol-player-${p.id}`}
                    value={String(p.id)}
                  >
                    {p.number ? `#${p.number} ` : ""}
                    {p.fullName ?? `Игрок #${p.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="viol-type">Тип нарушения</Label>
            <Select value={violationTypeId} onValueChange={setViolationTypeId}>
              <SelectTrigger id="viol-type" data-testid="select-violation-type">
                <SelectValue placeholder="Выберите тип" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Без типа</SelectItem>
                {safeViolationTypes.map((v) => (
                  <SelectItem
                    key={`viol-type-${v.id}`}
                    value={String(v.id)}
                  >
                    {(v.article ?? "Без статьи")} —{" "}
                    {v.description ?? "Без описания"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="viol-phase">Фаза *</Label>
            <Select value={phase} onValueChange={(v) => setPhase(v as Phase)}>
              <SelectTrigger id="viol-phase" data-testid="select-violation-phase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["digital", "physical", "general"] as Phase[]).map((p) => (
                  <SelectItem key={`viol-phase-${p}`} value={p}>
                    {PHASE_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="viol-round">
              Раунд{" "}
              <span className="text-muted-foreground text-xs">
                (не обязательно)
              </span>
            </Label>
            <Input
              id="viol-round"
              data-testid="input-violation-round"
              type="number"
              min={1}
              placeholder="Например, 5"
              value={roundNumber}
              onChange={(e) => setRoundNumber(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="viol-penalty">Штрафные очки</Label>
            <Input
              id="viol-penalty"
              data-testid="input-violation-penalty"
              type="number"
              step="0.5"
              min={0}
              value={penaltyPts}
              onChange={(e) => setPenaltyPts(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="viol-note">
              Заметка{" "}
              <span className="text-muted-foreground text-xs">
                (не обязательно)
              </span>
            </Label>
            <Textarea
              id="viol-note"
              data-testid="input-violation-note"
              placeholder="Описание нарушения..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={mutation.isPending}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              data-testid="btn-submit-violation"
              disabled={!compTeamId || mutation.isPending}
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Зарегистрировать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}