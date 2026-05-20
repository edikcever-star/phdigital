/**
 * СТРАНИЦА НАРУШЕНИЙ И ЗАМЕН
 *
 * Отображает два таба: «Нарушения» и «Замены».
 * Доступна по маршруту /#/matches/:matchId/violations
 *
 * Нарушения:
 *   - Таблица всех нарушений матча
 *   - Итог штрафов по командам
 *   - Регистрация нарушений (admin/data_entry)
 *   - Удаление нарушений (только admin)
 *
 * Замены:
 *   - Таблица всех замен матча
 *   - Регистрация замен (admin/data_entry)
 */

import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import {
  fetchViolations,
  deleteViolation,
  fetchSubstitutions,
  fetchViolationTypes,
} from "./violations.api";
import { fetchMatch } from "../matches.api";
import { RegisterViolationDialog } from "./RegisterViolationDialog";
import { RegisterSubstitutionDialog } from "./RegisterSubstitutionDialog";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft,
  AlertTriangle,
  ArrowRightLeft,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchViolation, MatchSubstitution, Phase } from "@shared/schema";

const PHASE_LABELS: Record<Phase, string> = {
  digital: "Цифровой",
  physical: "Физический",
  general: "Общее",
};

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/50 border border-border">
        {icon}
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <TableRow>
      {Array.from({ length: cols }).map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  );
}

interface ViolationsTabProps {
  matchId: number;
  canRegister: boolean;
  canDelete: boolean;
}

function ViolationsTab({ matchId, canRegister, canDelete }: ViolationsTabProps) {
  const { toast } = useToast();
  const [registerOpen, setRegisterOpen] = useState(false);

  const {
    data: violations = [],
    isLoading: violationsLoading,
    isError: violationsError,
  } = useQuery({
    queryKey: ["/api/v1/matches", matchId, "violations"],
    queryFn: () => fetchViolations(matchId),
    enabled: matchId > 0,
  });

  const { data: matchData } = useQuery({
    queryKey: ["/api/v1/matches", matchId],
    queryFn: () => fetchMatch(matchId),
    enabled: matchId > 0,
  });

  const { data: violationTypes = [] } = useQuery({
    queryKey: ["/api/v1/references/violation-types"],
    queryFn: fetchViolationTypes,
  });

  const deleteMutation = useMutation({
    mutationFn: (violationId: number) => deleteViolation(matchId, violationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/v1/matches", matchId, "violations"],
      });
      toast({ title: "Нарушение удалено" });
    },
    onError: (err) => {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "Не удалось удалить нарушение",
        variant: "destructive",
      });
    },
  });

  const teams = Array.isArray(matchData?.teams) ? matchData.teams : [];
  const players = Array.isArray(matchData?.players) ? matchData.players : [];
  const safeViolationTypes = Array.isArray(violationTypes) ? violationTypes : [];

  const getTeamName = (compTeamId: number) => {
    const teamEntry = teams.find((t) => t && t.compTeamId === compTeamId);
    return teamEntry?.team?.name ?? `Команда #${compTeamId}`;
  };

  const getPlayerName = (matchPlayerId: number | null) => {
    if (!matchPlayerId) return "—";
    const p = players.find((p) => p && p.id === matchPlayerId);
    if (!p) return `#${matchPlayerId}`;
    return `${p.number ? `#${p.number} ` : ""}${p.fullName ?? `Игрок #${matchPlayerId}`}`;
  };

  const getViolationTypeName = (typeId: number | null) => {
    if (!typeId) return "—";
    const vt = safeViolationTypes.find((v) => v && v.id === typeId);
    if (!vt) return `#${typeId}`;
    const article = vt.article ?? "Без статьи";
    const description = vt.description ?? "Без описания";
    return `${article} — ${description}`;
  };

  const safeViolations = Array.isArray(violations) ? violations : [];

  const penaltyByTeam = safeViolations.reduce<Record<number, number>>((acc, v) => {
    if (!v) return acc;
    acc[v.compTeamId] = (acc[v.compTeamId] ?? 0) + (v.penaltyPts ?? 0);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Нарушения</h2>
          {!violationsLoading && (
            <Badge variant="secondary" className="text-xs">
              {safeViolations.length}
            </Badge>
          )}
        </div>
        {canRegister && (
          <Button
            data-testid="btn-register-violation"
            size="sm"
            onClick={() => setRegisterOpen(true)}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Зарегистрировать нарушение
          </Button>
        )}
      </div>

      {Object.keys(penaltyByTeam).length > 0 && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(penaltyByTeam).map(([teamId, pts]) => (
            <div
              key={teamId}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20"
            >
              <span className="text-xs text-muted-foreground">
                {getTeamName(Number(teamId))}
              </span>
              <span
                className={cn(
                  "text-xs font-bold tabular-nums",
                  pts > 0 ? "text-destructive" : "text-muted-foreground"
                )}
              >
                −{pts} шт.
              </span>
            </div>
          ))}
        </div>
      )}

      {violationsLoading && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Команда</TableHead>
                <TableHead>Игрок</TableHead>
                <TableHead>Тип нарушения</TableHead>
                <TableHead>Фаза</TableHead>
                <TableHead>Раунд</TableHead>
                <TableHead>Штраф</TableHead>
                <TableHead>Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 3 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={7} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {violationsError && (
        <div className="flex items-center justify-center py-10">
          <p className="text-sm text-destructive">Не удалось загрузить нарушения</p>
        </div>
      )}

      {!violationsLoading && !violationsError && safeViolations.length === 0 && (
        <EmptyState
          icon={<AlertTriangle className="w-7 h-7 text-muted-foreground" />}
          message="Нарушений нет"
        />
      )}

      {!violationsLoading && !violationsError && safeViolations.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Команда</TableHead>
                <TableHead>Игрок</TableHead>
                <TableHead>Тип нарушения</TableHead>
                <TableHead>Фаза</TableHead>
                <TableHead className="text-center">Раунд</TableHead>
                <TableHead className="text-center">Штраф</TableHead>
                <TableHead>Дата</TableHead>
                {canDelete && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {safeViolations.filter(Boolean).map((v) => (
                <ViolationRow
                  key={v.id}
                  violation={v}
                  teamName={getTeamName(v.compTeamId)}
                  playerName={getPlayerName(v.matchPlayerId)}
                  violationTypeName={getViolationTypeName(v.violationTypeId)}
                  canDelete={canDelete}
                  isDeleting={deleteMutation.isPending}
                  onDelete={() => deleteMutation.mutate(v.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RegisterViolationDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        matchId={matchId}
      />
    </div>
  );
}

interface ViolationRowProps {
  violation: MatchViolation;
  teamName: string;
  playerName: string;
  violationTypeName: string;
  canDelete: boolean;
  isDeleting: boolean;
  onDelete: () => void;
}

function ViolationRow({
  violation,
  teamName,
  playerName,
  violationTypeName,
  canDelete,
  isDeleting,
  onDelete,
}: ViolationRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium text-sm">{teamName}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{playerName}</TableCell>
      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
        {violationTypeName}
      </TableCell>
      <TableCell className="text-sm">
        {PHASE_LABELS[violation.phase]}
      </TableCell>
      <TableCell className="text-center text-sm text-muted-foreground">
        {violation.roundNumber ?? "—"}
      </TableCell>
      <TableCell className="text-center">
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            violation.penaltyPts > 0 ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {violation.penaltyPts > 0 ? `−${violation.penaltyPts}` : "0"}
        </span>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {new Date(violation.createdAt).toLocaleString("ru-RU", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </TableCell>
      {canDelete && (
        <TableCell>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                data-testid={`btn-delete-violation-${violation.id}`}
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить нарушение?</AlertDialogTitle>
                <AlertDialogDescription>
                  Нарушение будет удалено из протокола матча. Это действие нельзя отменить.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  data-testid={`btn-confirm-delete-violation-${violation.id}`}
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Удалить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TableCell>
      )}
    </TableRow>
  );
}

interface SubstitutionsTabProps {
  matchId: number;
  canRegister: boolean;
}

function SubstitutionsTab({ matchId, canRegister }: SubstitutionsTabProps) {
  const [registerOpen, setRegisterOpen] = useState(false);

  const {
    data: substitutions = [],
    isLoading: subsLoading,
    isError: subsError,
  } = useQuery({
    queryKey: ["/api/v1/matches", matchId, "substitutions"],
    queryFn: () => fetchSubstitutions(matchId),
    enabled: matchId > 0,
  });

  const { data: matchData } = useQuery({
    queryKey: ["/api/v1/matches", matchId],
    queryFn: () => fetchMatch(matchId),
    enabled: matchId > 0,
  });

  const teams = Array.isArray(matchData?.teams) ? matchData.teams : [];
  const players = Array.isArray(matchData?.players) ? matchData.players : [];
  const safeSubstitutions = Array.isArray(substitutions) ? substitutions : [];

  const getTeamName = (compTeamId: number) => {
    const teamEntry = teams.find((t) => t && t.compTeamId === compTeamId);
    return teamEntry?.team?.name ?? `Команда #${compTeamId}`;
  };

  const getPlayerName = (matchPlayerId: number) => {
    const p = players.find((p) => p && p.id === matchPlayerId);
    if (!p) return `#${matchPlayerId}`;
    return `${p.number ? `#${p.number} ` : ""}${p.fullName ?? `Игрок #${matchPlayerId}`}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Замены</h2>
          {!subsLoading && (
            <Badge variant="secondary" className="text-xs">
              {safeSubstitutions.length}
            </Badge>
          )}
        </div>
        {canRegister && (
          <Button
            data-testid="btn-register-substitution"
            size="sm"
            onClick={() => setRegisterOpen(true)}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Зарегистрировать замену
          </Button>
        )}
      </div>

      {subsLoading && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Команда</TableHead>
                <TableHead>Вышел</TableHead>
                <TableHead>Вошёл</TableHead>
                <TableHead>Фаза</TableHead>
                <TableHead>Раунд</TableHead>
                <TableHead>Заметка</TableHead>
                <TableHead>Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 3 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={7} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {subsError && (
        <div className="flex items-center justify-center py-10">
          <p className="text-sm text-destructive">Не удалось загрузить замены</p>
        </div>
      )}

      {!subsLoading && !subsError && safeSubstitutions.length === 0 && (
        <EmptyState
          icon={<ArrowRightLeft className="w-7 h-7 text-muted-foreground" />}
          message="Замен нет"
        />
      )}

      {!subsLoading && !subsError && safeSubstitutions.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Команда</TableHead>
                <TableHead>Вышел</TableHead>
                <TableHead>Вошёл</TableHead>
                <TableHead>Фаза</TableHead>
                <TableHead className="text-center">Раунд</TableHead>
                <TableHead>Заметка</TableHead>
                <TableHead>Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safeSubstitutions.filter(Boolean).map((s) => (
                <SubstitutionRow
                  key={s.id}
                  substitution={s}
                  teamName={getTeamName(s.compTeamId)}
                  playerOutName={getPlayerName(s.playerOutId)}
                  playerInName={getPlayerName(s.playerInId)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RegisterSubstitutionDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        matchId={matchId}
      />
    </div>
  );
}

interface SubstitutionRowProps {
  substitution: MatchSubstitution;
  teamName: string;
  playerOutName: string;
  playerInName: string;
}

function SubstitutionRow({
  substitution,
  teamName,
  playerOutName,
  playerInName,
}: SubstitutionRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium text-sm">{teamName}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{playerOutName}</TableCell>
      <TableCell className="text-sm text-foreground">{playerInName}</TableCell>
      <TableCell className="text-sm">
        {PHASE_LABELS[substitution.phase]}
      </TableCell>
      <TableCell className="text-center text-sm text-muted-foreground">
        {substitution.roundNumber ?? "—"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
        {substitution.note ?? "—"}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {new Date(substitution.createdAt).toLocaleString("ru-RU", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </TableCell>
    </TableRow>
  );
}

export default function ViolationsPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = parseInt(params.matchId ?? "0", 10);
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const isAdmin =
    user?.role === "chief_judge" || user?.role === "chief_secretary";

  const canRegister =
    isAdmin ||
    user?.role === "deputy_judge" ||
    user?.role === "tech_secretary";

  const { data: matchData } = useQuery({
    queryKey: ["/api/v1/matches", matchId],
    queryFn: () => fetchMatch(matchId),
    enabled: matchId > 0,
  });

  const teams = Array.isArray(matchData?.teams) ? matchData.teams : [];
  const team1Name = teams[0]?.team?.name;
  const team2Name = teams[1]?.team?.name;

  const matchTitle =
    team1Name && team2Name
      ? `${team1Name} vs ${team2Name}`
      : `Матч #${matchId}`;

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1 as unknown as string)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Назад"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <AlertTriangle className="w-4 h-4 text-primary" />

            <h1 className="text-base font-semibold text-foreground">
              Нарушения и замены
            </h1>

            {matchTitle && (
              <Badge variant="secondary" className="text-xs font-normal">
                {matchTitle}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="violations" className="space-y-6">
            <TabsList className="w-full max-w-xs">
              <TabsTrigger value="violations" className="flex-1 gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Нарушения
              </TabsTrigger>
              <TabsTrigger value="substitutions" className="flex-1 gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Замены
              </TabsTrigger>
            </TabsList>

            <TabsContent value="violations" className="mt-0">
              <ViolationsTab
                matchId={matchId}
                canRegister={canRegister}
                canDelete={isAdmin}
              />
            </TabsContent>

            <TabsContent value="substitutions" className="mt-0">
              <SubstitutionsTab
                matchId={matchId}
                canRegister={canRegister}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppShell>
  );
}