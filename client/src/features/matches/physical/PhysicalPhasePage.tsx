/**
 * СТРАНИЦА ФИЗИЧЕСКОГО ЭТАПА (ЛАЗЕРТАГ)
 *
 * - Таблица с колонками Стор, Фраги, А, П, Д, О (Победа).
 * - Быстрые кнопки с встроенным учетом фрагов (0..5).
 * - Вкладка "Детально" с использованием компонента PhysRoundEditor.
 * - Мгновенное сохранение в базу.
 * - ОТОБРАЖЕНИЕ СЧЕТА ЦИФРОВОГО ЭТАПА под основным счетом.
 */

import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { fetchPhysicalRounds, assignPhysicalSides, updatePhysicalRound } from "./physical.api";
// Нам нужно импортировать запрос для получения цифровых раундов, чтобы посчитать их счет
import { fetchDigitalRounds } from "../digital/digital.api";
import { transitionMatchStatus } from "../matches.api";
import { PhysRoundEditor } from "./PhysRoundEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { 
  Gamepad2, ChevronLeft, Shield, Bomb, AlertCircle, Zap, ShieldCheck, 
  Swords, Play, Target, Clock, Flag, ArrowRightLeft, Map as MapIcon, 
  TimerReset, RotateCcw, Monitor
} from "lucide-react";
import type { PhysicalRound, DigitalRound, CompetitionSettings } from "@shared/schema";

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

function sideBg(side: "attack" | "defense" | string) { 
  return side === "attack" ? "bg-red-500/15 text-red-600 dark:text-red-500" : "bg-blue-500/15 text-blue-600 dark:text-blue-500"; 
}

function getSideLabel(side: string) {
  return side === "attack" ? "Атака" : "Защита";
}

function PhysicalPageSkeleton() {
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

export default function PhysicalPhasePage() {
  const params = useParams<{ matchId: string }>();
  const matchId = parseInt(params.matchId ?? "0", 10);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"quick" | "detailed">("quick");

  // Локальные стейты для ФРАГОВ
  const [attackFrags, setAttackFrags] = useState<number>(0);
  const [defenseFrags, setDefenseFrags] = useState<number>(0);

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

  const { data: rounds = [], isLoading: isRoundsLoading } = useQuery({
    queryKey: ["/api/v1/matches", matchId, "physical-rounds"],
    queryFn: () => fetchPhysicalRounds(matchId),
    enabled: matchId > 0,
  });

  // Запрашиваем цифровые раунды для подсчета их очков
  const { data: digitalData } = useQuery<any>({
    queryKey: ["/api/v1/matches", matchId, "digital-rounds"],
    queryFn: () => fetchDigitalRounds(matchId),
    enabled: matchId > 0,
  });

  // Безопасно достаем массив раундов цифрового этапа
  const safeDigitalRounds: DigitalRound[] = Array.isArray(digitalData) 
    ? digitalData 
    : (digitalData?.rounds || []);

  // --- Мутации ---
  const assignSidesMutation = useMutation({
    mutationFn: (team1Side: "attack" | "defense") => assignPhysicalSides(matchId, team1Side),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/v1/matches", matchId, "physical-rounds"] });
      toast({ title: "Стороны назначены", description: "Раунды лазертага сгенерированы." });
    }
  });

  const finishMutation = useMutation({
    mutationFn: () => transitionMatchStatus(matchId, "finished"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/v1/matches", matchId] });
      toast({ title: "Этап завершен" });
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message || "Не удалось завершить этап", variant: "destructive" });
    }
  });

  const quickMutation = useMutation({
    mutationFn: ({ roundId, ...data }: any) => updatePhysicalRound(matchId, roundId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/v1/matches", matchId, "physical-rounds"] });
    },
    onError: (err: any) => toast({ title: "Ошибка сохранения", description: err.message, variant: "destructive" })
  });

  const selectedRound = rounds.find((r: PhysicalRound) => r.id === selectedRoundId) ?? null;

  // Синхронизация локальных фрагов при смене раунда
  useEffect(() => {
    if (selectedRound) {
      const isT1Attack = selectedRound.team1Side === "attack";
      const rAny = selectedRound as any;
      setAttackFrags(isT1Attack ? (rAny.fragsTeam1 ?? 0) : (rAny.fragsTeam2 ?? 0));
      setDefenseFrags(isT1Attack ? (rAny.fragsTeam2 ?? 0) : (rAny.fragsTeam1 ?? 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoundId]);

  useEffect(() => {
    if (rounds.length > 0 && selectedRoundId === null) {
      const active = rounds.find((r: PhysicalRound) => r.status === "in_progress" || r.status === "pending");
      setSelectedRoundId(active ? active.id : rounds[rounds.length - 1].id);
    }
  }, [rounds, selectedRoundId]);

  if (isNaN(matchId) || matchId <= 0 || isMatchError) {
    return <AppShell><div className="flex h-full items-center justify-center text-destructive"><AlertCircle className="mr-2" />Ошибка загрузки матча</div></AppShell>;
  }

  if (isMatchLoading || isRoundsLoading) return <PhysicalPageSkeleton />;

  // Данные команд
  const matchTeam1 = rawMatchData?.teams?.find((t: any) => t.teamSlot === 1);
  const matchTeam2 = rawMatchData?.teams?.find((t: any) => t.teamSlot === 2);

  const team1Name = matchTeam1?.compTeam?.name ?? rawMatchData?.team1?.name ?? "Команда 1";
  const team2Name = matchTeam2?.compTeam?.name ?? rawMatchData?.team2?.name ?? "Команда 2";
  
  const team1CompTeamId = matchTeam1?.compTeam?.id ?? rawMatchData?.team1Id ?? -1;
  const team2CompTeamId = matchTeam2?.compTeam?.id ?? rawMatchData?.team2Id ?? -2;

  const completedRoundsCount = rounds.filter((r: PhysicalRound) => r.status === "completed").length;
  
  // Очки за ФИЗИЧЕСКИЙ этап
  const team1PhysPoints = rounds.filter((r: PhysicalRound) => r.winnerTeamId === team1CompTeamId).reduce((sum: number, r: PhysicalRound) => sum + (r.pointsAwarded || 0), 0);
  const team2PhysPoints = rounds.filter((r: PhysicalRound) => r.winnerTeamId === team2CompTeamId).reduce((sum: number, r: PhysicalRound) => sum + (r.pointsAwarded || 0), 0);

  // Очки за ЦИФРОВОЙ этап
  const team1DigPoints = safeDigitalRounds.filter((r: DigitalRound) => r.winnerTeamId === team1CompTeamId).reduce((sum: number, r: DigitalRound) => sum + (r.pointsAwarded || 0), 0);
  const team2DigPoints = safeDigitalRounds.filter((r: DigitalRound) => r.winnerTeamId === team2CompTeamId).reduce((sum: number, r: DigitalRound) => sum + (r.pointsAwarded || 0), 0);

  const currentRoundForHeader = rounds.find((r: PhysicalRound) => r.status !== "completed") ?? rounds[rounds.length - 1];
  const t1CurrentSide = currentRoundForHeader?.team1Side ?? "attack";
  const t2CurrentSide = t1CurrentSide === "attack" ? "defense" : "attack";
  const mapName = rawMatchData?.match?.physicalMap ?? "Арена Лазертаг";

  const sortedRounds = [...rounds].sort((a: PhysicalRound, b: PhysicalRound) => a.roundNumber - b.roundNumber);

  // Мгновенное сохранение фрагов
  const handleFragsChange = (side: "attack" | "defense", count: number) => {
    if (!selectedRound) return;
    
    if (side === "attack") setAttackFrags(count);
    else setDefenseFrags(count);

    const isT1Attack = selectedRound.team1Side === "attack";
    
    const newAttackFrags = side === "attack" ? count : attackFrags;
    const newDefenseFrags = side === "defense" ? count : defenseFrags;

    const team1FinalFrags = isT1Attack ? newAttackFrags : newDefenseFrags;
    const team2FinalFrags = isT1Attack ? newDefenseFrags : newAttackFrags;

    quickMutation.mutate({
      roundId: selectedRound.id,
      roundNumber: selectedRound.roundNumber,
      status: selectedRound.status,
      winnerTeamId: selectedRound.winnerTeamId ?? null,
      winType: selectedRound.winType ?? null,
      activation: !!selectedRound.activation,
      explosion: !!selectedRound.explosion,
      deactivation: !!selectedRound.deactivation,
      fragsTeam1: team1FinalFrags,
      fragsTeam2: team2FinalFrags
    });
  };

  const handleQuickWin = (
    winnerId: number | null, 
    winType: "frag_win" | "activation" | "explosion" | "deactivation" | "technical" | null, 
    opts: { act?: boolean, exp?: boolean, def?: boolean, forceFrags?: "attack" | "defense" }
  ) => {
    if (!selectedRound) return;

    const isT1Attack = selectedRound.team1Side === "attack";

    const finalAttackFrags = opts.forceFrags === "attack" ? 5 : attackFrags;
    const finalDefenseFrags = opts.forceFrags === "defense" ? 5 : defenseFrags;

    const team1FinalFrags = isT1Attack ? finalAttackFrags : finalDefenseFrags;
    const team2FinalFrags = isT1Attack ? finalDefenseFrags : finalAttackFrags;

    setAttackFrags(finalAttackFrags);
    setDefenseFrags(finalDefenseFrags);

    quickMutation.mutate({
      roundId: selectedRound.id,
      roundNumber: selectedRound.roundNumber,
      status: winnerId ? "completed" : "pending",
      winnerTeamId: winnerId,
      winType: winType,
      activation: !!opts.act,
      explosion: !!opts.exp,
      deactivation: !!opts.def,
      fragsTeam1: team1FinalFrags,
      fragsTeam2: team2FinalFrags
    }, {
      onSuccess: () => {
        toast({ title: "Раунд сохранен", duration: 2000 });
        if (winnerId && selectedRoundId !== null) {
          const currentIndex = sortedRounds.findIndex((r: PhysicalRound) => r.id === selectedRoundId);
          if (currentIndex !== -1 && currentIndex < sortedRounds.length - 1) {
            setSelectedRoundId(sortedRounds[currentIndex + 1].id);
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
                <Swords className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-black uppercase tracking-tight">Физический этап</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-widest bg-muted"><MapIcon className="w-3 h-3 mr-1"/> {mapName}</Badge>
                  {rounds.length > 0 && <span className="text-muted-foreground text-xs font-bold">• Раунд {completedRoundsCount + 1}</span>}
                </div>
              </div>
            </div>

            {rounds.length > 0 && (
              <div className="flex items-center gap-6 bg-background border px-6 py-2 rounded-2xl shadow-inner">
                {/* Команда 1 */}
                <div className="flex flex-col items-end">
                  <span className="text-sm font-black truncate text-foreground">{team1Name}</span>
                  <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-0 h-4", sideBg(t1CurrentSide))}>{getSideLabel(t1CurrentSide)}</Badge>
                </div>
                
                {/* ЦЕНТРАЛЬНЫЙ БЛОК СО СЧЕТОМ */}
                <div className="flex flex-col items-center justify-center min-w-[120px]">
                  {/* Счет текущего (физического) этапа */}
                  <div className="flex items-center gap-4">
                    <span className={cn("text-5xl font-black tabular-nums leading-none", team1PhysPoints > team2PhysPoints ? "text-primary" : "text-foreground")}>{team1PhysPoints}</span>
                    <span className="text-2xl text-muted-foreground/30 font-light leading-none">:</span>
                    <span className={cn("text-5xl font-black tabular-nums leading-none", team2PhysPoints > team1PhysPoints ? "text-primary" : "text-foreground")}>{team2PhysPoints}</span>
                  </div>
                  
                  {/* Счет цифрового этапа (маленьким текстом снизу) */}
                  <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full border border-border/50">
                    <Monitor className="w-3 h-3 text-muted-foreground/70" />
                    <span className={team1DigPoints > team2DigPoints ? "text-primary" : ""}>{team1DigPoints}</span>
                    <span className="opacity-50">-</span>
                    <span className={team2DigPoints > team1DigPoints ? "text-primary" : ""}>{team2DigPoints}</span>
                  </div>
                </div>

                {/* Команда 2 */}
                <div className="flex flex-col items-start">
                  <span className="text-sm font-black truncate text-foreground">{team2Name}</span>
                  <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-0 h-4", sideBg(t2CurrentSide))}>{getSideLabel(t2CurrentSide)}</Badge>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => navigate(`/matches/${matchId}/digital`)} className="font-bold uppercase tracking-wider text-xs border-dashed">
                <ArrowRightLeft className="w-3.5 h-3.5 mr-2" /> Цифровой этап
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
                  <Target className="h-10 w-10" />
                </div>
                <h2 className="text-4xl font-black uppercase tracking-tight mb-3">Стартовые стороны</h2>
                <p className="text-muted-foreground text-lg">Кто начинает матч в Атаке?</p>
              </div>
              <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
                <button disabled={!canEdit || assignSidesMutation.isPending} onClick={() => assignSidesMutation.mutate("attack")} className="group relative p-8 rounded-3xl border-2 bg-card hover:border-red-500 hover:shadow-[0_0_40px_rgba(239,68,68,0.15)] transition-all text-left overflow-hidden">
                  <Badge className="bg-red-500 text-white mb-6 px-4 py-1.5 uppercase font-black tracking-widest hover:bg-red-600">АТАКА</Badge>
                  <h3 className="text-4xl font-black mb-2 relative z-10">{team1Name}</h3>
                  <p className="text-muted-foreground font-medium relative z-10">{team2Name} начнет в Защите</p>
                </button>
                <button disabled={!canEdit || assignSidesMutation.isPending} onClick={() => assignSidesMutation.mutate("defense")} className="group relative p-8 rounded-3xl border-2 bg-card hover:border-red-500 hover:shadow-[0_0_40px_rgba(239,68,68,0.15)] transition-all text-left overflow-hidden">
                  <Badge className="bg-red-500 text-white mb-6 px-4 py-1.5 uppercase font-black tracking-widest hover:bg-red-600">АТАКА</Badge>
                  <h3 className="text-4xl font-black mb-2 relative z-10">{team2Name}</h3>
                  <p className="text-muted-foreground font-medium relative z-10">{team1Name} начнет в Защите</p>
                </button>
              </div>
            </div>
          ) : (
            /* СПЛИТ-ЭКРАН: Таблица + Редактор */
            <div className="flex h-full w-full bg-muted/10">
              
              {/* === ЛЕВАЯ ПАНЕЛЬ: ТАБЛИЦА === */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="bg-card border rounded-2xl shadow-sm overflow-hidden flex flex-col">
                  
                  <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between text-xs">
                    <span className="font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">Таблица раундов</span>
                    <div className="flex gap-4 text-muted-foreground font-medium">
                      <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5"/> Фраги</span>
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
                        <th className="py-2 w-12 border-r border-t">Стор</th>
                        <th className="py-2 w-12 border-t">Фраг</th>
                        <th className="py-2 w-10 border-t">А</th>
                        <th className="py-2 w-10 border-t">П</th>
                        <th className="py-2 w-10 border-t">Д</th>
                        <th className="py-2 w-12 border-r border-t text-primary bg-primary/5">О</th>

                        <th className="py-2 w-12 border-r border-t">Стор</th>
                        <th className="py-2 w-12 border-t">Фраг</th>
                        <th className="py-2 w-10 border-t">А</th>
                        <th className="py-2 w-10 border-t">П</th>
                        <th className="py-2 w-10 border-t">Д</th>
                        <th className="py-2 w-12 border-t text-primary bg-primary/5">О</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sortedRounds.map((round: PhysicalRound) => {
                        const isSelected = selectedRoundId === round.id;
                        const isCompleted = round.status === "completed";
                        const isActive = round.status === "in_progress" || round.status === "pending" && !isCompleted;
                        
                        const t1Side = round.team1Side as "attack" | "defense";
                        const isT1Attack = t1Side === "attack";
                        const t2Side = t1Side === "attack" ? "defense" : "attack";
                        const t1Winner = round.winnerTeamId === team1CompTeamId;
                        const t2Winner = round.winnerTeamId === team2CompTeamId;

                        let t1FragsTable = round.fragsTeam1 ?? 0;
                        let t2FragsTable = round.fragsTeam2 ?? 0;

                        if (isSelected) {
                          t1FragsTable = isT1Attack ? attackFrags : defenseFrags;
                          t2FragsTable = isT1Attack ? defenseFrags : attackFrags;
                        }

                        return (
                          <tr 
                            key={round.id}
                            onClick={() => setSelectedRoundId(round.id)}
                            className={cn(
                              "transition-colors cursor-pointer group",
                              isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/50"
                            )}
                          >
                            <td className={cn("py-2.5 font-black border-r relative", isSelected && "text-primary")}>
                              {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                              {isActive && !isCompleted ? <Play className="w-4 h-4 mx-auto fill-primary text-primary animate-pulse" /> : round.roundNumber}
                            </td>

                            {/* TEAM 1 */}
                            <td className="border-r px-1"><Badge variant="outline" className={cn("text-[10px] w-full justify-center border-0 shadow-none", sideBg(t1Side))}>{t1Side === 'attack' ? 'АТАКА' : 'ЗАЩ'}</Badge></td>
                            <td className="font-bold tabular-nums text-muted-foreground">{isCompleted || isActive || t1FragsTable > 0 ? t1FragsTable : "-"}</td>
                            <td>{isCompleted && round.activation && t1Side === "attack" ? <Bomb className="w-4 h-4 mx-auto text-red-500" /> : <span className="opacity-20">-</span>}</td>
                            <td>{isCompleted && round.explosion && t1Side === "attack" ? <Zap className="w-4 h-4 mx-auto text-red-600" /> : <span className="opacity-20">-</span>}</td>
                            <td>{isCompleted && round.deactivation && t1Side === "defense" ? <ShieldCheck className="w-4 h-4 mx-auto text-blue-500" /> : <span className="opacity-20">-</span>}</td>
                            <td className={cn("border-r font-black text-base bg-primary/5", t1Winner ? "text-primary" : "text-transparent")}>{isCompleted && t1Winner ? `+${round.pointsAwarded}` : "-"}</td>

                            {/* TEAM 2 */}
                            <td className="border-r px-1"><Badge variant="outline" className={cn("text-[10px] w-full justify-center border-0 shadow-none", sideBg(t2Side))}>{t2Side === 'attack' ? 'АТАКА' : 'ЗАЩ'}</Badge></td>
                            <td className="font-bold tabular-nums text-muted-foreground">{isCompleted || isActive || t2FragsTable > 0 ? t2FragsTable : "-"}</td>
                            <td>{isCompleted && round.activation && t2Side === "attack" ? <Bomb className="w-4 h-4 mx-auto text-red-500" /> : <span className="opacity-20">-</span>}</td>
                            <td>{isCompleted && round.explosion && t2Side === "attack" ? <Zap className="w-4 h-4 mx-auto text-red-600" /> : <span className="opacity-20">-</span>}</td>
                            <td>{isCompleted && round.deactivation && t2Side === "defense" ? <ShieldCheck className="w-4 h-4 mx-auto text-blue-500" /> : <span className="opacity-20">-</span>}</td>
                            <td className={cn("font-black text-base bg-primary/5", t2Winner ? "text-primary" : "text-transparent")}>{isCompleted && t2Winner ? `+${round.pointsAwarded}` : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* === ПРАВАЯ ПАНЕЛЬ: БЫСТРЫЕ КНОПКИ И ДЕТАЛЬНО === */}
              <div className="w-[480px] xl:w-[550px] border-l bg-card overflow-hidden flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.03)] z-10">
                {selectedRoundId !== null && selectedRound && (
                  <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
                    
                    <div className="px-6 py-4 border-b bg-background shadow-sm flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-black uppercase tracking-tight">Панель судьи</h2>
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">Раунд {selectedRound.roundNumber}</p>
                      </div>
                    </div>

                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
                      <div className="px-6 pt-4">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="quick" className="font-bold uppercase tracking-wider text-xs"><Zap className="w-3.5 h-3.5 mr-2"/> Быстрый ввод</TabsTrigger>
                          <TabsTrigger value="detailed" className="font-bold uppercase tracking-wider text-xs"><Swords className="w-3.5 h-3.5 mr-2"/> Детально</TabsTrigger>
                        </TabsList>
                      </div>

                      {/* ВКЛАДКА: БЫСТРЫЙ ВВОД */}
                      <TabsContent value="quick" className="flex-1 overflow-y-auto p-6 space-y-8 mt-0 outline-none">
                        
                        {/* АТАКА */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Bomb className="w-5 h-5 text-red-500" />
                            <h3 className="text-lg font-black uppercase tracking-wide">Атака</h3>
                            <span className="text-muted-foreground text-sm font-semibold ml-auto">{selectedRound.team1Side === "attack" ? team1Name : team2Name}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-xl mb-4 border">
                            <Target className="w-4 h-4 text-muted-foreground ml-2" />
                            <span className="text-sm font-bold text-muted-foreground mr-2">Фраги Атаки:</span>
                            <div className="flex gap-1">
                              {[0,1,2,3,4,5].map(n => (
                                <button type="button" key={n} onClick={() => handleFragsChange("attack", n)} disabled={!canEdit}
                                  className={cn("w-8 h-8 rounded-md font-bold text-sm transition-all border", 
                                    attackFrags === n ? "bg-red-600 text-white border-red-600" : "bg-background text-foreground hover:border-red-500/50"
                                  )}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <Button 
                              onClick={() => handleQuickWin(selectedRound.team1Side === "attack" ? team1CompTeamId : team2CompTeamId, "explosion", { act: true, exp: true })}
                              disabled={quickMutation.isPending || !canEdit || selectedRound.status === "completed"}
                              variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-red-500/10 hover:border-red-500 hover:text-red-600"
                            >
                              <Zap className="w-6 h-6 text-red-600" />
                              <span className="font-bold">Подрыв (П)</span>
                            </Button>
                            <Button 
                              onClick={() => handleQuickWin(selectedRound.team1Side === "attack" ? team1CompTeamId : team2CompTeamId, "frag_win", { forceFrags: "attack" })}
                              disabled={quickMutation.isPending || !canEdit || selectedRound.status === "completed"}
                              variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-red-500/10 hover:border-red-500 hover:text-red-600"
                            >
                              <Target className="w-6 h-6 text-red-500" />
                              <span className="font-bold">Уничтожение Защиты</span>
                            </Button>
                          </div>
                        </div>

                        {/* ЗАЩИТА */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-5 h-5 text-blue-500" />
                            <h3 className="text-lg font-black uppercase tracking-wide">Защита</h3>
                            <span className="text-muted-foreground text-sm font-semibold ml-auto">{selectedRound.team1Side === "defense" ? team1Name : team2Name}</span>
                          </div>

                          <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-xl mb-4 border">
                            <Target className="w-4 h-4 text-muted-foreground ml-2" />
                            <span className="text-sm font-bold text-muted-foreground mr-2">Фраги Защиты:</span>
                            <div className="flex gap-1">
                              {[0,1,2,3,4,5].map(n => (
                                <button type="button" key={n} onClick={() => handleFragsChange("defense", n)} disabled={!canEdit}
                                  className={cn("w-8 h-8 rounded-md font-bold text-sm transition-all border", 
                                    defenseFrags === n ? "bg-blue-600 text-white border-blue-600" : "bg-background text-foreground hover:border-blue-500/50"
                                  )}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <Button 
                              onClick={() => handleQuickWin(selectedRound.team1Side === "defense" ? team1CompTeamId : team2CompTeamId, "deactivation", { act: true, def: true })}
                              disabled={quickMutation.isPending || !canEdit || selectedRound.status === "completed"}
                              variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-blue-500/10 hover:border-blue-500 hover:text-blue-600"
                            >
                              <ShieldCheck className="w-6 h-6 text-blue-500" />
                              <span className="font-bold">Дефьюз (А+Д)</span>
                            </Button>
                            <Button 
                              onClick={() => handleQuickWin(selectedRound.team1Side === "defense" ? team1CompTeamId : team2CompTeamId, "frag_win", { forceFrags: "defense" })}
                              disabled={quickMutation.isPending || !canEdit || selectedRound.status === "completed"}
                              variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-blue-500/10 hover:border-blue-500 hover:text-blue-600"
                            >
                              <Target className="w-6 h-6 text-blue-500" />
                              <span className="font-bold">Уничтожение Атаки</span>
                            </Button>
                            <Button 
                              onClick={() => handleQuickWin(selectedRound.team1Side === "defense" ? team1CompTeamId : team2CompTeamId, "technical", {})}
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

                      {/* ВКЛАДКА: ДЕТАЛЬНО */}
                      <TabsContent value="detailed" className="flex-1 overflow-y-auto p-6 mt-0 outline-none border-t">
                        <PhysRoundEditor 
                          round={selectedRound} 
                          matchId={matchId} 
                          team1Name={team1Name} 
                          team2Name={team2Name} 
                          team1CompId={team1CompTeamId} 
                          team2CompId={team2CompTeamId} 
                          team1Side={selectedRound.team1Side} 
                          canEdit={canEdit} 
                          settings={rawMatchData?.settings}
                          onSaved={() => { 
                            toast({ title: "Сохранено", description: `Данные обновлены.` });
                            qc.invalidateQueries({ queryKey: ["/api/v1/matches", matchId, "physical-rounds"] });
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