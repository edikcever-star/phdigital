/**
 * СТРАНИЦА ЦИФРОВОГО ЭТАПА (СУДЕЙСКИЙ ТЕРМИНАЛ CS2/VALORANT)
 *
 * - Таблица с колонками Стор, Потери (Смерти), А, П, Д, О (Победа).
 * - Быстрые кнопки с встроенным учетом смертей (0..5).
 * - Выбор потерь мгновенно сохраняется в стейт и отправляется на сервер без сброса UI.
 * - Цвет Террористов (T) — красный.
 */

import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { fetchDigitalRounds, assignDigitalSides, updateDigitalRound } from "./digital.api";
import { transitionMatchStatus } from "../matches.api";
import { RoundEditor } from "./RoundEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { 
  Gamepad2, ChevronLeft, Shield, Bomb, AlertCircle, Zap, ShieldCheck, 
  Swords, Skull, Play, CheckCircle2, Clock, Flag, ArrowRightLeft, 
  Map as MapIcon, TimerReset, RotateCcw
} from "lucide-react";
import type { DigitalRoundWithStats, UpsertDigitalRoundRequest } from "@shared/contracts/api";
import type { RoundStatus, WinTypeDigital } from "@shared/schema";

// -----------------------------------------------------------
// Типы
// -----------------------------------------------------------

type QuickRoundMutationInput = { roundId: number } & UpsertDigitalRoundRequest;

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

function getHalfLabel(half: number): string {
  if (half === 1) return "Первая половина";
  if (half === 2) return "Вторая половина";
  return `Овертайм ${half - 2}`;
}

function sideBg(side: "T" | "CT") { 
  return side === "T" ? "bg-red-500/15 text-red-600 dark:text-red-500" : "bg-blue-500/15 text-blue-600 dark:text-blue-500"; 
}

// -----------------------------------------------------------
// Компоненты UI
// -----------------------------------------------------------

function DigitalPageSkeleton() {
  return (
    <AppShell>
      <div className="flex-1 flex flex-col p-6 space-y-6">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="flex-1 flex gap-6">
          <Skeleton className="flex-1 rounded-2xl" />
          <Skeleton className="w-[450px] rounded-2xl" />
        </div>
      </div>
    </AppShell>
  );
}

// -----------------------------------------------------------
// ОСНОВНАЯ СТРАНИЦА
// -----------------------------------------------------------

export default function DigitalPhasePage() {
  const params = useParams<{ matchId: string }>();
  const matchId = parseInt(params.matchId ?? "0", 10);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"quick" | "detailed">("quick");

  // Локальные стейты для смертей в текущем выбранном раунде
  const [tDeaths, setTDeaths] = useState<number>(0);
  const [ctDeaths, setCtDeaths] = useState<number>(0);

  const canEdit = user?.role === "chief_judge" || user?.role === "chief_secretary" || user?.role === "tech_secretary";
  const isAdmin = user?.role === "chief_judge" || user?.role === "chief_secretary";

  // --- Запросы ---
  const { data: rawMatchData, isLoading: isMatchLoading, isError: isMatchError } = useQuery({
    queryKey: ["/api/v1/matches", matchId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/matches/${matchId}`);
      if (!res.ok) throw new Error("Не удалось загрузить данные матча");
      const json = await res.json();
      return json.data || json; 
    },
    enabled: matchId > 0,
  });

  const { data: phaseData, isLoading: isRoundsLoading } = useQuery({
    queryKey: ["/api/v1/matches", matchId, "digital-rounds"],
    queryFn: () => fetchDigitalRounds(matchId),
    enabled: matchId > 0,
  });

  // --- Мутации ---
  const assignSidesMutation = useMutation({
    mutationFn: (team1Side: "T" | "CT") => assignDigitalSides(matchId, team1Side),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/v1/matches", matchId, "digital-rounds"] });
      toast({ title: "Стороны назначены", description: "Таймлайн сгенерирован." });
    }
  });

  const finishMutation = useMutation({
    mutationFn: () => transitionMatchStatus(matchId, "finished"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/v1/matches", matchId] });
      toast({ title: "Этап завершен" });
    },
  });

  const quickMutation = useMutation({
    mutationFn: ({ roundId, ...data }: QuickRoundMutationInput) => updateDigitalRound(matchId, roundId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/v1/matches", matchId, "digital-rounds"] });
    },
    onError: (err) => {
      console.error("Ошибка обновления раунда:", err);
      toast({ title: "Ошибка сохранения", description: "Не удалось сохранить результат", variant: "destructive" });
    }
  });

  const rounds: DigitalRoundWithStats[] = phaseData?.rounds ?? [];
  const teamStats = phaseData?.teamStats;

  const selectedRound = rounds.find((r) => r.id === selectedRoundId) ?? null;

  // ИСПРАВЛЕНИЕ: Синхронизация смертей происходит ТОЛЬКО при смене раунда (selectedRoundId)
  // Это предотвращает сброс UI, когда сервер отвечает на запросы в фоне.
  useEffect(() => {
    if (selectedRound) {
      const isT1T = selectedRound.team1Side === "T";
      const rAny = selectedRound as any;
      setTDeaths(isT1T ? (rAny.team1Deaths ?? 0) : (rAny.team2Deaths ?? 0));
      setCtDeaths(isT1T ? (rAny.team2Deaths ?? 0) : (rAny.team1Deaths ?? 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoundId]);

  // Авто-выбор первого несыгранного раунда при первой загрузке
  useEffect(() => {
    if (rounds.length > 0 && selectedRoundId === null) {
      const active = rounds.find(r => r.status === "in_progress" || r.status === "pending");
      setSelectedRoundId(active ? active.id : rounds[rounds.length - 1].id);
    }
  }, [rounds, selectedRoundId]);

  if (isNaN(matchId) || matchId <= 0 || isMatchError) {
    return <AppShell><div className="flex h-full items-center justify-center text-destructive"><AlertCircle className="mr-2" />Ошибка загрузки матча</div></AppShell>;
  }

  if (isMatchLoading || isRoundsLoading) return <DigitalPageSkeleton />;

  // Извлекаем данные команд
  const matchTeam1 = rawMatchData?.teams?.find((t: any) => t.teamSlot === 1);
  const matchTeam2 = rawMatchData?.teams?.find((t: any) => t.teamSlot === 2);

  const team1Name = matchTeam1?.compTeam?.name ?? rawMatchData?.team1?.name ?? teamStats?.team1?.name ?? "Команда 1";
  const team2Name = matchTeam2?.compTeam?.name ?? rawMatchData?.team2?.name ?? teamStats?.team2?.name ?? "Команда 2";
  
  const team1CompTeamId = matchTeam1?.compTeam?.id ?? matchTeam1?.compTeamId ?? rawMatchData?.team1Id ?? teamStats?.team1?.compTeamId ?? -1;
  const team2CompTeamId = matchTeam2?.compTeam?.id ?? matchTeam2?.compTeamId ?? rawMatchData?.team2Id ?? teamStats?.team2?.compTeamId ?? -2;

  const currentHalf = phaseData?.currentHalf ?? 1;
  const completedRoundsCount = rounds.filter((r) => r.status === "completed").length;
  
  const team1RoundsWon = teamStats?.team1.roundsWon ?? 0;
  const team2RoundsWon = teamStats?.team2.roundsWon ?? 0;

  // Для отображения текущих сторон в хедере
  const currentRoundForHeader = rounds.find(r => r.status !== "completed") ?? rounds[rounds.length - 1];
  const t1CurrentSide = currentRoundForHeader?.team1Side ?? "T";
  const t2CurrentSide = t1CurrentSide === "T" ? "CT" : "T";
  const mapName = rawMatchData?.match?.digitalMap ?? "Карта не выбрана";

  const sortedRounds = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);

  // Мгновенное сохранение смертей при клике на цифру
  const handleDeathsChange = (side: "T" | "CT", count: number) => {
    if (!selectedRound) return;
    
    // Обновляем локальный стейт (он мгновенно отразится в таблице)
    if (side === "T") setTDeaths(count);
    else setCtDeaths(count);

    const isT1T = selectedRound.team1Side === "T";
    
    const newTDeaths = side === "T" ? count : tDeaths;
    const newCtDeaths = side === "CT" ? count : ctDeaths;

    const team1FinalDeaths = isT1T ? newTDeaths : newCtDeaths;
    const team2FinalDeaths = isT1T ? newCtDeaths : newTDeaths;

    // Сразу сохраняем на сервер в фоне
    quickMutation.mutate({
      roundId: selectedRound.id,
      roundNumber: selectedRound.roundNumber,
      status: selectedRound.status,
      winnerTeamId: selectedRound.winnerTeamId ?? null,
      winType: selectedRound.winType ?? null,
      activation: !!selectedRound.activation,
      explosion: !!selectedRound.explosion,
      deactivation: !!selectedRound.deactivation,
      team1Deaths: team1FinalDeaths,
      team2Deaths: team2FinalDeaths
    } as QuickRoundMutationInput);
  };

  // Обработчик быстрых кнопок с учетом смертей
  const handleQuickWin = (
    winnerId: number | null, 
    winType: WinTypeDigital | null, 
    opts: { act?: boolean, exp?: boolean, def?: boolean, forceEliminated?: "T" | "CT" }
  ) => {
    if (!selectedRound) return;

    const isT1T = selectedRound.team1Side === "T";

    const finalTDeaths = opts.forceEliminated === "T" ? 5 : tDeaths;
    const finalCtDeaths = opts.forceEliminated === "CT" ? 5 : ctDeaths;

    const team1FinalDeaths = isT1T ? finalTDeaths : finalCtDeaths;
    const team2FinalDeaths = isT1T ? finalCtDeaths : finalTDeaths;

    setTDeaths(finalTDeaths);
    setCtDeaths(finalCtDeaths);

    quickMutation.mutate({
      roundId: selectedRound.id,
      roundNumber: selectedRound.roundNumber,
      status: winnerId ? "completed" : "pending",
      winnerTeamId: winnerId,
      winType: winType,
      activation: !!opts.act,
      explosion: !!opts.exp,
      deactivation: !!opts.def,
      team1Deaths: team1FinalDeaths,
      team2Deaths: team2FinalDeaths
    } as QuickRoundMutationInput, {
      onSuccess: () => {
        toast({ title: "Раунд сохранен", duration: 2000 });
        // Авто-переключение на следующий раунд ТОЛЬКО если завершили раунд
        if (winnerId && selectedRoundId !== null) {
          const sorted = [...(phaseData?.rounds ?? [])].sort((a, b) => a.roundNumber - b.roundNumber);
          const currentIndex = sorted.findIndex(r => r.id === selectedRoundId);
          if (currentIndex !== -1 && currentIndex < sorted.length - 1) {
            setSelectedRoundId(sorted[currentIndex + 1].id);
          }
        }
      }
    });
  };

  return (
    <AppShell activeMatchId={matchId} activeMatchStatus={rawMatchData?.match?.status || rawMatchData?.status}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        
        {/* === ГЛОБАЛЬНЫЙ ХЕДЕР === */}
        <header className="flex-shrink-0 border-b bg-card/80 backdrop-blur-xl z-20">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => navigate(`/matches/${matchId}`)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-card text-muted-foreground transition-colors hover:text-foreground hover:border-primary/50 shadow-sm mr-2">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.15)]">
                <Gamepad2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-black uppercase tracking-tight">Цифровой этап</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-widest bg-muted"><MapIcon className="w-3 h-3 mr-1"/> {mapName}</Badge>
                  {rounds.length > 0 && <span className="text-muted-foreground text-xs font-bold">• Раунд {completedRoundsCount + 1} ({getHalfLabel(currentHalf)})</span>}
                </div>
              </div>
            </div>

            {rounds.length > 0 && (
              <div className="flex items-center gap-6 bg-background border px-6 py-2 rounded-2xl shadow-inner">
                {/* Команда 1 */}
                <div className="flex flex-col items-end">
                  <span className="text-sm font-black truncate text-foreground">{team1Name}</span>
                  <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-0 h-4", sideBg(t1CurrentSide))}>{t1CurrentSide}</Badge>
                </div>
                {/* СЧЕТ */}
                <div className="flex items-center gap-4">
                  <span className={cn("text-5xl font-black tabular-nums", team1RoundsWon > team2RoundsWon ? "text-primary" : "text-foreground")}>{team1RoundsWon}</span>
                  <span className="text-2xl text-muted-foreground/30 font-light">:</span>
                  <span className={cn("text-5xl font-black tabular-nums", team2RoundsWon > team1RoundsWon ? "text-primary" : "text-foreground")}>{team2RoundsWon}</span>
                </div>
                {/* Команда 2 */}
                <div className="flex flex-col items-start">
                  <span className="text-sm font-black truncate text-foreground">{team2Name}</span>
                  <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-0 h-4", sideBg(t2CurrentSide))}>{t2CurrentSide}</Badge>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => navigate(`/matches/${matchId}/physical`)} className="font-bold uppercase tracking-wider text-xs border-dashed">
                <ArrowRightLeft className="w-3.5 h-3.5 mr-2" /> Физический этап
              </Button>
              {isAdmin && (
                <Button variant="destructive" onClick={() => finishMutation.mutate()} disabled={finishMutation.isPending} className="font-bold uppercase tracking-wider text-xs">
                  <Flag className="w-3.5 h-3.5 mr-2" /> Завершить
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* === ОСНОВНОЙ КОНТЕНТ === */}
        <div className="flex-1 overflow-hidden">
          {rounds.length === 0 ? (
            /* ЭКРАН ВЫБОРА СТОРОН */
            <div className="flex flex-col items-center justify-center h-full p-6 animate-in fade-in zoom-in-95">
              <div className="text-center mb-10">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 ring-1 ring-primary/30 shadow-[0_0_30px_rgba(var(--primary),0.2)]">
                  <Swords className="h-10 w-10" />
                </div>
                <h2 className="text-4xl font-black uppercase tracking-tight mb-3">Стартовые стороны</h2>
                <p className="text-muted-foreground text-lg">Кто начинает матч за сторону Террористов (Т)?</p>
              </div>
              <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
                <button disabled={!canEdit || assignSidesMutation.isPending} onClick={() => assignSidesMutation.mutate("T")} className="group relative p-8 rounded-3xl border-2 bg-card hover:border-red-500 hover:shadow-[0_0_40px_rgba(239,68,68,0.15)] transition-all text-left overflow-hidden">
                  <Badge className="bg-red-500 text-white mb-6 px-4 py-1.5 uppercase font-black tracking-widest hover:bg-red-600">ТЕРРОРИСТЫ</Badge>
                  <h3 className="text-4xl font-black mb-2 relative z-10">{team1Name}</h3>
                  <p className="text-muted-foreground font-medium relative z-10">{team2Name} начнет за Спецназ (CT)</p>
                </button>
                <button disabled={!canEdit || assignSidesMutation.isPending} onClick={() => assignSidesMutation.mutate("CT")} className="group relative p-8 rounded-3xl border-2 bg-card hover:border-red-500 hover:shadow-[0_0_40px_rgba(239,68,68,0.15)] transition-all text-left overflow-hidden">
                  <Badge className="bg-red-500 text-white mb-6 px-4 py-1.5 uppercase font-black tracking-widest hover:bg-red-600">ТЕРРОРИСТЫ</Badge>
                  <h3 className="text-4xl font-black mb-2 relative z-10">{team2Name}</h3>
                  <p className="text-muted-foreground font-medium relative z-10">{team1Name} начнет за Спецназ (CT)</p>
                </button>
              </div>
            </div>
          ) : (
            /* СПЛИТ-ЭКРАН: Таблица + Редактор */
            <div className="flex h-full w-full bg-muted/10">
              
              {/* === ЛЕВАЯ ПАНЕЛЬ: ДЕТАЛЬНАЯ ТАБЛИЦА === */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="bg-card border rounded-2xl shadow-sm overflow-hidden flex flex-col">
                  
                  <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between text-xs">
                    <span className="font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">Таблица раундов</span>
                    <div className="flex gap-4 text-muted-foreground font-medium">
                      <span className="flex items-center gap-1"><Skull className="w-3.5 h-3.5"/> Потери</span>
                      <span className="flex items-center gap-1"><Bomb className="w-3.5 h-3.5 text-red-500"/> А - Активация</span>
                      <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-red-600"/> П - Подрыв</span>
                      <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-blue-500"/> Д - Дефьюз</span>
                    </div>
                  </div>

                  <table className="w-full text-sm text-center">
                    <thead className="bg-background border-b border-border shadow-sm sticky top-0 z-10">
                      <tr>
                        <th rowSpan={2} className="py-3 px-2 border-r w-14 text-muted-foreground">#</th>
                        <th colSpan={6} className="py-2 px-4 border-r"><span className="font-black text-base truncate">{team1Name}</span></th>
                        <th colSpan={6} className="py-2 px-4"><span className="font-black text-base truncate">{team2Name}</span></th>
                      </tr>
                      <tr className="text-xs font-bold text-muted-foreground bg-muted/20 uppercase tracking-wider">
                        {/* Team 1 */}
                        <th className="py-2 w-12 border-r border-t">Стор</th>
                        <th className="py-2 w-12 border-t">Пот</th>
                        <th className="py-2 w-10 border-t">А</th>
                        <th className="py-2 w-10 border-t">П</th>
                        <th className="py-2 w-10 border-t">Д</th>
                        <th className="py-2 w-12 border-r border-t text-primary bg-primary/5">О</th>
                        {/* Team 2 */}
                        <th className="py-2 w-12 border-r border-t">Стор</th>
                        <th className="py-2 w-12 border-t">Пот</th>
                        <th className="py-2 w-10 border-t">А</th>
                        <th className="py-2 w-10 border-t">П</th>
                        <th className="py-2 w-10 border-t">Д</th>
                        <th className="py-2 w-12 border-t text-primary bg-primary/5">О</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sortedRounds.map((round, index) => {
                        const isSelected = selectedRoundId === round.id;
                        const isCompleted = round.status === "completed";
                        const isActive = round.status === "in_progress" || round.status === "pending" && !isCompleted;
                        
                        const t1Side = round.team1Side as "T" | "CT";
                        const isT1T = t1Side === "T";
                        const t2Side = t1Side === "T" ? "CT" : "T";
                        const t1Winner = round.winnerTeamId === team1CompTeamId;
                        const t2Winner = round.winnerTeamId === team2CompTeamId;

                        const rAny = round as any;
                        let t1DeathsTable = rAny.team1Deaths ?? 0;
                        let t2DeathsTable = rAny.team2Deaths ?? 0;

                        // Мгновенное отображение данных из стейта для выбранного раунда
                        if (isSelected) {
                          t1DeathsTable = isT1T ? tDeaths : ctDeaths;
                          t2DeathsTable = isT1T ? ctDeaths : tDeaths;
                        }

                        const prevRound = index > 0 ? sortedRounds[index - 1] : null;
                        const isHalfSwitch = prevRound && prevRound.half !== round.half;

                        return (
                          <tr 
                            key={round.id}
                            onClick={() => setSelectedRoundId(round.id)}
                            className={cn(
                              "transition-colors cursor-pointer group",
                              isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/50",
                              isHalfSwitch ? "border-t-4 border-t-border" : ""
                            )}
                          >
                            {/* Индикатор */}
                            <td className={cn("py-2.5 font-black border-r relative", isSelected && "text-primary")}>
                              {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                              {isActive && !isCompleted ? <Play className="w-4 h-4 mx-auto fill-primary text-primary animate-pulse" /> : round.roundNumber}
                            </td>

                            {/* --- КОМАНДА 1 --- */}
                            <td className="border-r px-1"><Badge variant="outline" className={cn("text-[10px] w-full justify-center border-0 shadow-none", sideBg(t1Side))}>{t1Side}</Badge></td>
                            <td className="font-bold tabular-nums text-muted-foreground">{isCompleted || isActive || t1DeathsTable > 0 ? t1DeathsTable : "-"}</td>
                            <td>{isCompleted && round.activation && t1Side === "T" ? <Bomb className="w-4 h-4 mx-auto text-red-500" /> : <span className="opacity-20">-</span>}</td>
                            <td>{isCompleted && round.explosion && t1Side === "T" ? <Zap className="w-4 h-4 mx-auto text-red-600" /> : <span className="opacity-20">-</span>}</td>
                            <td>{isCompleted && round.deactivation && t1Side === "CT" ? <ShieldCheck className="w-4 h-4 mx-auto text-blue-500" /> : <span className="opacity-20">-</span>}</td>
                            <td className={cn("border-r font-black text-base bg-primary/5", t1Winner ? "text-primary" : "text-transparent")}>{isCompleted && t1Winner ? "+1" : "-"}</td>

                            {/* --- КОМАНДА 2 --- */}
                            <td className="border-r px-1"><Badge variant="outline" className={cn("text-[10px] w-full justify-center border-0 shadow-none", sideBg(t2Side))}>{t2Side}</Badge></td>
                            <td className="font-bold tabular-nums text-muted-foreground">{isCompleted || isActive || t2DeathsTable > 0 ? t2DeathsTable : "-"}</td>
                            <td>{isCompleted && round.activation && t2Side === "T" ? <Bomb className="w-4 h-4 mx-auto text-red-500" /> : <span className="opacity-20">-</span>}</td>
                            <td>{isCompleted && round.explosion && t2Side === "T" ? <Zap className="w-4 h-4 mx-auto text-red-600" /> : <span className="opacity-20">-</span>}</td>
                            <td>{isCompleted && round.deactivation && t2Side === "CT" ? <ShieldCheck className="w-4 h-4 mx-auto text-blue-500" /> : <span className="opacity-20">-</span>}</td>
                            <td className={cn("font-black text-base bg-primary/5", t2Winner ? "text-primary" : "text-transparent")}>{isCompleted && t2Winner ? "+1" : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* === ПРАВАЯ ПАНЕЛЬ: БЫСТРЫЕ КНОПКИ И РЕДАКТОР === */}
              <div className="w-[480px] xl:w-[550px] border-l bg-card overflow-hidden flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.03)] z-10">
                {selectedRoundId !== null && selectedRound && (
                  <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
                    
                    {/* Хедер панели */}
                    <div className="px-6 py-4 border-b bg-background shadow-sm flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-black uppercase tracking-tight">Панель судьи</h2>
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">Раунд {selectedRound.roundNumber}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{getHalfLabel(selectedRound.half)}</Badge>
                    </div>

                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
                      <div className="px-6 pt-4">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="quick" className="font-bold uppercase tracking-wider text-xs"><Zap className="w-3.5 h-3.5 mr-2"/> Быстрый ввод</TabsTrigger>
                          <TabsTrigger value="detailed" className="font-bold uppercase tracking-wider text-xs"><Swords className="w-3.5 h-3.5 mr-2"/> Детально</TabsTrigger>
                        </TabsList>
                      </div>

                      {/* ТАБ 1: БЫСТРЫЕ КНОПКИ + СМЕРТИ */}
                      <TabsContent value="quick" className="flex-1 overflow-y-auto p-6 space-y-8 mt-0 outline-none">
                        
                        {/* Блок Террористов (T) */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Bomb className="w-5 h-5 text-red-500" />
                            <h3 className="text-lg font-black uppercase tracking-wide">Террористы (T)</h3>
                            <span className="text-muted-foreground text-sm font-semibold ml-auto">{selectedRound.team1Side === "T" ? team1Name : team2Name}</span>
                          </div>
                          
                          {/* Селектор смертей T */}
                          <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-xl mb-4 border">
                            <Skull className="w-4 h-4 text-muted-foreground ml-2" />
                            <span className="text-sm font-bold text-muted-foreground mr-2">Потери T:</span>
                            <div className="flex gap-1">
                              {[0,1,2,3,4,5].map(n => (
                                <button type="button" key={n} onClick={() => handleDeathsChange("T", n)} disabled={!canEdit}
                                  className={cn("w-8 h-8 rounded-md font-bold text-sm transition-all border", 
                                    tDeaths === n ? "bg-red-600 text-white border-red-600" : "bg-background text-foreground hover:border-red-500/50"
                                  )}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <Button 
                              onClick={() => handleQuickWin(selectedRound.team1Side === "T" ? team1CompTeamId : team2CompTeamId, "bomb_explode", { act: true, exp: true })}
                              disabled={quickMutation.isPending || !canEdit || selectedRound.status === "completed"}
                              variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-red-500/10 hover:border-red-500 hover:text-red-600"
                            >
                              <Zap className="w-6 h-6 text-red-600" />
                              <span className="font-bold">Подрыв (П)</span>
                            </Button>
                            <Button 
                              onClick={() => handleQuickWin(selectedRound.team1Side === "T" ? team1CompTeamId : team2CompTeamId, "elimination", { forceEliminated: "CT" })}
                              disabled={quickMutation.isPending || !canEdit || selectedRound.status === "completed"}
                              variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-red-500/10 hover:border-red-500 hover:text-red-600"
                            >
                              <Skull className="w-6 h-6 text-red-500" />
                              <span className="font-bold">Уничтожение CT</span>
                            </Button>
                          </div>
                        </div>

                        {/* Блок Спецназа (CT) */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-5 h-5 text-blue-500" />
                            <h3 className="text-lg font-black uppercase tracking-wide">Спецназ (CT)</h3>
                            <span className="text-muted-foreground text-sm font-semibold ml-auto">{selectedRound.team1Side === "CT" ? team1Name : team2Name}</span>
                          </div>

                          {/* Селектор смертей CT */}
                          <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-xl mb-4 border">
                            <Skull className="w-4 h-4 text-muted-foreground ml-2" />
                            <span className="text-sm font-bold text-muted-foreground mr-2">Потери CT:</span>
                            <div className="flex gap-1">
                              {[0,1,2,3,4,5].map(n => (
                                <button type="button" key={n} onClick={() => handleDeathsChange("CT", n)} disabled={!canEdit}
                                  className={cn("w-8 h-8 rounded-md font-bold text-sm transition-all border", 
                                    ctDeaths === n ? "bg-blue-600 text-white border-blue-600" : "bg-background text-foreground hover:border-blue-500/50"
                                  )}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <Button 
                              onClick={() => handleQuickWin(selectedRound.team1Side === "CT" ? team1CompTeamId : team2CompTeamId, "bomb_defuse", { act: true, def: true })}
                              disabled={quickMutation.isPending || !canEdit || selectedRound.status === "completed"}
                              variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-blue-500/10 hover:border-blue-500 hover:text-blue-600"
                            >
                              <ShieldCheck className="w-6 h-6 text-blue-500" />
                              <span className="font-bold">Дефьюз (А+Д)</span>
                            </Button>
                            <Button 
                              onClick={() => handleQuickWin(selectedRound.team1Side === "CT" ? team1CompTeamId : team2CompTeamId, "elimination", { forceEliminated: "T" })}
                              disabled={quickMutation.isPending || !canEdit || selectedRound.status === "completed"}
                              variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-blue-500/10 hover:border-blue-500 hover:text-blue-600"
                            >
                              <Skull className="w-6 h-6 text-blue-500" />
                              <span className="font-bold">Уничтожение T</span>
                            </Button>
                            <Button 
                              onClick={() => handleQuickWin(selectedRound.team1Side === "CT" ? team1CompTeamId : team2CompTeamId, "time_out", {})}
                              disabled={quickMutation.isPending || !canEdit || selectedRound.status === "completed"}
                              variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 col-span-2 hover:bg-blue-500/10 hover:border-blue-500 hover:text-blue-600"
                            >
                              <TimerReset className="w-6 h-6 text-blue-500" />
                              <span className="font-bold">Победа по времени</span>
                            </Button>
                          </div>
                        </div>

                        <div className="pt-6 border-t border-dashed">
                          <Button 
                            onClick={() => handleQuickWin(null, null, { act: false, exp: false, def: false })}
                            disabled={quickMutation.isPending || !canEdit || selectedRound.status === "pending"}
                            variant="secondary" className="w-full font-bold text-muted-foreground hover:text-destructive"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" /> Сбросить результат раунда
                          </Button>
                        </div>

                      </TabsContent>

                      {/* ТАБ 2: ДЕТАЛЬНЫЙ (RoundEditor) */}
                      <TabsContent value="detailed" className="flex-1 overflow-y-auto p-6 mt-0 outline-none border-t">
                        <RoundEditor 
                          round={selectedRound} 
                          matchId={matchId} 
                          team1Name={team1Name} 
                          team2Name={team2Name} 
                          team1CompTeamId={team1CompTeamId} 
                          team2CompTeamId={team2CompTeamId} 
                          team1Side={selectedRound.team1Side as "T" | "CT"} 
                          canEdit={canEdit} 
                          onSaved={() => { 
                            toast({ title: "Сохранено", description: `Данные обновлены.` });
                            qc.invalidateQueries({ queryKey: ["/api/v1/matches", matchId, "digital-rounds"] });
                          }} 
                        />
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}