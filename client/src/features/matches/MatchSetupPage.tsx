/**
 * СТРАНИЦА НАСТРОЙКИ МАТЧА (PRO-Версия)
 *
 * Профессиональный интерфейс судьи:
 * - Слева: Основные настройки (Команды, Карты, Составы)
 * - Справа: Боковая панель (Статус, Управление, Журнал)
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { fetchCompetitionTeams } from "../competitions/competitions.api";
import { fetchMatch, setupMatchTeams, transitionMatchStatus, fetchMatchStatusLog } from "./matches.api";
import { MatchStatusBadge } from "./MatchStatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Gamepad2, Shield, Save, Loader2, History, AlertCircle, 
  Map as MapIcon, CheckCircle2, Undo2, UserCheck, PlayCircle, Settings2
} from "lucide-react";
import type { MatchStatus } from "@shared/schema";

const STATUS_TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  draft: ["setup"],
  setup: ["digital_phase"],
  digital_phase: ["physical_phase"],
  physical_phase: ["finished"],
  finished: ["approved", "digital_phase"],
  approved: ["locked"],
  locked: [],
};

const TRANSITION_LABELS: Partial<Record<MatchStatus, string>> = {
  setup: "Утвердить черновик",
  digital_phase: "Начать CS2 (Цифра)",
  physical_phase: "В Лазертаг (Физика)",
  finished: "Завершить матч",
  approved: "Утвердить протокол",
  locked: "Закрыть матч",
};

const TRANSITION_VARIANT: Partial<Record<MatchStatus, "default" | "outline" | "destructive" | "secondary">> = {
  setup: "outline",
  digital_phase: "default",
  physical_phase: "default",
  finished: "default",
  approved: "secondary",
  locked: "destructive",
};

function useMaps() {
  return useQuery({
    queryKey: ["/api/v1/references/maps"],
    queryFn: async () => {
      const res = await fetch("/api/v1/references/maps").then(r => r.json());
      return res.data;
    },
  });
}

interface VetoAction { mapId: number; action: "ban" | "pick"; teamSlot: 1 | 2; }

export default function MatchSetupPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const params = useParams<{ matchId: string }>();
  const matchId = parseInt(params.matchId ?? "0", 10);
  const isAdmin = user?.role === "chief_judge" || user?.role === "chief_secretary";

  const { data: matchSetup, isLoading, isError } = useQuery({
    queryKey: [`/api/v1/matches/${matchId}`],
    queryFn: () => fetchMatch(matchId),
    enabled: !isNaN(matchId) && matchId > 0,
  });

  const match = matchSetup?.match;
  const matchTeams = matchSetup?.teams ?? [];
  const isDraftOrSetup = match?.status === "draft" || match?.status === "setup";
  
  const { data: compTeams } = useQuery({
    queryKey: [`/api/v1/competitions/${match?.competitionId}/teams`],
    queryFn: () => fetchCompetitionTeams(match!.competitionId),
    enabled: !!match?.competitionId,
  });

  const { data: maps } = useMaps();

  const { data: statusLog } = useQuery({
    queryKey: [`/api/v1/matches/${matchId}/status-log`],
    queryFn: () => fetchMatchStatusLog(matchId),
    enabled: !!match,
  });

  const [slot1TeamId, setSlot1TeamId] = useState<string>("none");
  const [slot2TeamId, setSlot2TeamId] = useState<string>("none");
  const [vetoLog, setVetoLog] = useState<VetoAction[]>([]);
  
  const [digitalRoster, setDigitalRoster] = useState<Record<number, boolean>>({});
  const [physicalRoster, setPhysicalRoster] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (matchTeams.length > 0) {
      const t1 = matchTeams.find((t: any) => t.teamSlot === 1);
      const t2 = matchTeams.find((t: any) => t.teamSlot === 2);
      if (t1) setSlot1TeamId(String(t1.compTeamId));
      if (t2) setSlot2TeamId(String(t2.compTeamId));
      
      const initDig: Record<number, boolean> = {};
      const initPhy: Record<number, boolean> = {};
      matchTeams.forEach((team: any) => {
        team.players?.forEach((p: any) => {
          initDig[p.id] = p.playedDigital ?? true;
          initPhy[p.id] = p.playedPhysical ?? true;
        });
      });
      setDigitalRoster(initDig);
      setPhysicalRoster(initPhy);
    }
  }, [matchTeams]);

  const setupMutation = useMutation({
    mutationFn: async () => {
      if (slot1TeamId === "none" || slot2TeamId === "none") throw new Error("Выберите обе команды");
      if (slot1TeamId === slot2TeamId) throw new Error("Команды должны быть разными");
      const pickedMap = vetoLog.find(v => v.action === "pick");
      
      const payload = {
        team1: { compTeamId: parseInt(slot1TeamId) },
        team2: { compTeamId: parseInt(slot2TeamId) },
        vetoLog, 
        mapId: pickedMap?.mapId
      };
      
      return setupMatchTeams(matchId, payload as any);
    },
    onSuccess: () => {
      toast({ title: "Настройки матча сохранены" });
      queryClient.invalidateQueries({ queryKey: [`/api/v1/matches/${matchId}`] });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const rosterMutation = useMutation({
    mutationFn: async () => {
      const payload = Object.keys(digitalRoster).map(id => ({
        id: parseInt(id), playedDigital: digitalRoster[parseInt(id)], playedPhysical: physicalRoster[parseInt(id)]
      }));
      const res = await fetch(`/api/v1/matches/${matchId}/roster`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ players: payload })
      });
      if (!res.ok) throw new Error("Ошибка сервера при сохранении состава");
      return true;
    },
    onSuccess: () => {
      toast({ title: "Протокол явки обновлен", description: "Составы успешно зафиксированы." });
      queryClient.invalidateQueries({ queryKey: [`/api/v1/matches/${matchId}`] });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const transitionMutation = useMutation({
    mutationFn: async (target: MatchStatus) => transitionMatchStatus(matchId, target),
    onSuccess: (m, targetStatus) => {
      toast({ title: "Статус изменен", description: `Матч переведен в: ${TRANSITION_LABELS[targetStatus] || targetStatus}` });
      queryClient.invalidateQueries({ queryKey: [`/api/v1/matches/${matchId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/v1/matches/${matchId}/status-log`] });
      
      if (targetStatus === "digital_phase") {
        navigate(`/matches/${matchId}/digital`);
      }
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  if (isNaN(matchId) || matchId <= 0) return <AppShell><div className="flex h-full items-center justify-center"><AlertCircle className="w-8 h-8 text-muted-foreground mr-2" /> Неверный ID матча</div></AppShell>;
  if (isLoading) return <AppShell><div className="p-6 max-w-4xl mx-auto"><Skeleton className="h-40 w-full mb-4"/><Skeleton className="h-40 w-full"/></div></AppShell>;
  if (isError || !match) return <AppShell><div className="flex h-full items-center justify-center"><p className="text-muted-foreground">Матч не найден</p></div></AppShell>;
  if (!isAdmin) return <AppShell><div className="flex h-full items-center justify-center"><p className="text-muted-foreground">Доступ запрещен</p></div></AppShell>;

  const team1Name = compTeams?.find((t: any) => String(t.id) === slot1TeamId)?.name || "Слот 1";
  const team2Name = compTeams?.find((t: any) => String(t.id) === slot2TeamId)?.name || "Слот 2";
  const isVetoFinished = vetoLog.some(v => v.action === "pick");
  const availableTransitions = STATUS_TRANSITIONS[match.status] ?? [];

  return (
    <AppShell activeMatchId={match.id} activeMatchStatus={match.status}>
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-muted/5">
        
        <div className="flex items-center justify-between px-6 py-4 bg-background border-b border-border shadow-sm flex-shrink-0 z-10">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(match.competitionId ? `/competitions/${match.competitionId}` : "/competitions")} className="h-9 w-9 rounded-full bg-muted/50 hover:bg-muted">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                Матч #{match.matchNumber ?? matchId}
                {match.stage && <Badge variant="secondary" className="uppercase text-[10px]">{match.stage}</Badge>}
              </h1>
            </div>
          </div>
          {match.status === "digital_phase" && (
            <Button onClick={() => navigate(`/matches/${matchId}/digital`)} className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-md">
              <Gamepad2 className="w-4 h-4" /> Открыть панель CS2
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col lg:flex-row max-w-7xl mx-auto">
            
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 lg:pr-3 space-y-6 scrollbar-thin">
              
              {/* Блок 1: Выбор команд */}
              <Card className="border-border shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
                  <CardTitle className="text-base flex items-center gap-2"><Settings2 className="w-4 h-4 text-primary"/> Выбор команд</CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Команда 1 */}
                    <div className="space-y-4 p-4 rounded-xl border border-border bg-background shadow-sm">
                      <Badge className="bg-primary/10 text-primary">Слот 1</Badge>
                      <Select value={slot1TeamId} onValueChange={setSlot1TeamId} disabled={!isDraftOrSetup}>
                        <SelectTrigger><SelectValue placeholder="Выберите команду..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Не выбрана</SelectItem>
                          {compTeams?.map((t: any) => <SelectItem key={`team1-${t.id}`} value={String(t.id)} disabled={String(t.id) === slot2TeamId}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Команда 2 */}
                    <div className="space-y-4 p-4 rounded-xl border border-border bg-background shadow-sm">
                      <Badge variant="secondary">Слот 2</Badge>
                      <Select value={slot2TeamId} onValueChange={setSlot2TeamId} disabled={!isDraftOrSetup}>
                        <SelectTrigger><SelectValue placeholder="Выберите команду..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Не выбрана</SelectItem>
                          {compTeams?.map((t: any) => <SelectItem key={`team2-${t.id}`} value={String(t.id)} disabled={String(t.id) === slot1TeamId}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Блок 2: Бан/Пик */}
              <Card className={`border-border shadow-sm ${slot1TeamId === "none" || slot2TeamId === "none" ? "opacity-50 pointer-events-none grayscale" : ""}`}>
                <CardHeader className="pb-3 border-b border-border/50 bg-muted/10 flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><MapIcon className="w-4 h-4 text-primary"/> Процесс Бан/Пик (CS2)</CardTitle>
                  {isDraftOrSetup && vetoLog.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setVetoLog(prev => prev.slice(0, -1))} className="h-7 text-xs"><Undo2 className="w-3 h-3 mr-1"/> Отменить</Button>
                  )}
                </CardHeader>
                <CardContent className="p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {maps?.map((map: any) => {
                      const veto = vetoLog.find(v => v.mapId === map.id);
                      const isBanned = veto?.action === "ban";
                      const isPicked = veto?.action === "pick";
                      return (
                        <div key={`map-${map.id}`} className={`p-3 rounded-xl border flex flex-col items-center gap-3 ${isBanned ? "bg-muted opacity-50" : isPicked ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "bg-background hover:border-primary/50"}`}>
                          <span className="text-sm font-bold">{map.name}</span>
                          <div className="min-h-[36px] w-full flex items-center justify-center">
                            {veto ? (
                              <Badge variant={isPicked ? "default" : "destructive"} className="text-[9px] uppercase"><span className="mr-1">{isPicked ? "Пик" : "Бан"}</span> {veto.teamSlot === 1 ? team1Name.substring(0,4) : team2Name.substring(0,4)}</Badge>
                            ) : isDraftOrSetup && !isVetoFinished ? (
                              <div className="flex flex-col gap-1 w-full">
                                <div className="flex gap-1 w-full"><Button variant="outline" size="sm" className="h-6 flex-1 text-[9px] px-0 bg-destructive/5 hover:bg-destructive hover:text-white" onClick={() => setVetoLog(p => [...p, { mapId: map.id, action: "ban", teamSlot: 1 }])}>Бан {team1Name.substring(0,2)}</Button><Button variant="outline" size="sm" className="h-6 flex-1 text-[9px] px-0 bg-destructive/5 hover:bg-destructive hover:text-white" onClick={() => setVetoLog(p => [...p, { mapId: map.id, action: "ban", teamSlot: 2 }])}>Бан {team2Name.substring(0,2)}</Button></div>
                                <div className="flex gap-1 w-full"><Button variant="outline" size="sm" className="h-6 flex-1 text-[9px] px-0 bg-primary/5 hover:bg-primary hover:text-white" onClick={() => setVetoLog(p => [...p, { mapId: map.id, action: "pick", teamSlot: 1 }])}>Пик {team1Name.substring(0,2)}</Button><Button variant="outline" size="sm" className="h-6 flex-1 text-[9px] px-0 bg-primary/5 hover:bg-primary hover:text-white" onClick={() => setVetoLog(p => [...p, { mapId: map.id, action: "pick", teamSlot: 2 }])}>Пик {team2Name.substring(0,2)}</Button></div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {isDraftOrSetup && (
                    <div className="mt-4 flex justify-end">
                      <Button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 shadow-md">
                        {setupMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Сохранить настройки и карты
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Блок 3: Составы (Явка) */}
              {matchTeams.length >= 2 && match.status !== "draft" && (
                <Card className="border-border shadow-sm">
                  <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
                    <CardTitle className="text-base flex items-center gap-2"><UserCheck className="w-4 h-4 text-emerald-600"/> Утверждение явки игроков</CardTitle>
                    <CardDescription>Укажите, кто фактически играет в CS2 и Лазертаге. Сделайте это до старта этапа.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {matchTeams.sort((a: any, b: any) => a.teamSlot - b.teamSlot).map((team: any) => (
                        <div key={`roster-team-${team.teamSlot}`} className="border rounded-xl overflow-hidden shadow-sm">
                          <div className="bg-muted/50 p-2 border-b flex justify-between items-center px-3">
                            <Badge variant="outline" className="bg-background">Слот {team.teamSlot}</Badge>
                            <span className="font-bold text-sm">{team.compTeam.name}</span>
                          </div>
                          <div className="flex items-center text-[10px] font-bold text-muted-foreground uppercase bg-muted/20 p-2 border-b">
                            <div className="flex-1 px-2">Игрок</div><div className="w-12 text-center text-blue-600">CS2</div><div className="w-12 text-center text-green-600">Л-ТАГ</div>
                          </div>
                          <div className="divide-y divide-border/50">
                            {team.players?.map((p: any) => {
                              const isDigitalLocked = match.status !== "setup";
                              const isPhysicalLocked = ["physical_phase", "finished", "approved", "locked"].includes(match.status);
                              
                              return (
                                <div key={`player-${p.id}`} className="flex items-center p-2 hover:bg-muted/20">
                                  <div className="flex-1 flex items-center gap-2 min-w-0 px-2">
                                    <span className="text-sm font-medium truncate">{p.fullName}</span>
                                    {p.isReserve && <Badge variant="secondary" className="text-[8px] uppercase px-1 h-4">Резерв</Badge>}
                                  </div>
                                  <div className="w-12 flex justify-center">
                                    <Checkbox 
                                      checked={digitalRoster[p.id] ?? true} 
                                      onCheckedChange={(c) => setDigitalRoster(prev => ({...prev, [p.id]: !!c}))} 
                                      disabled={isDigitalLocked} 
                                      className={isDigitalLocked ? "opacity-50 cursor-not-allowed" : "data-[state=checked]:bg-blue-600"} 
                                    />
                                  </div>
                                  <div className="w-12 flex justify-center">
                                    <Checkbox 
                                      checked={physicalRoster[p.id] ?? true} 
                                      onCheckedChange={(c) => setPhysicalRoster(prev => ({...prev, [p.id]: !!c}))} 
                                      disabled={isPhysicalLocked} 
                                      className={isPhysicalLocked ? "opacity-50 cursor-not-allowed" : "data-[state=checked]:bg-green-600"} 
                                    />
                                  </div>
                                </div>
                              );
                            })}
                            
                            {(!team.players || team.players.length === 0) && (
                              <p className="text-xs text-muted-foreground italic p-4 text-center">Нет игроков в составе</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/20 p-4 rounded-xl border border-border/50">
                      <div className="text-xs text-muted-foreground text-center sm:text-left">
                        {match.status === "setup" ? (
                          "Поставьте галочки и зафиксируйте явку перед стартом CS2."
                        ) : match.status === "digital_phase" ? (
                          <span className="text-amber-600 font-medium">CS2 заблокирован. Можно корректировать только состав на Лазертаг.</span>
                        ) : (
                          "Составы заблокированы для изменений."
                        )}
                      </div>
                      <Button 
                        onClick={() => rosterMutation.mutate()} 
                        disabled={rosterMutation.isPending || ["finished", "approved", "locked"].includes(match.status)} 
                        variant="secondary" 
                        className="shadow-sm border border-border w-full sm:w-auto"
                      >
                        {rosterMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Зафиксировать явку
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

            </div>

            {/* ПРАВАЯ КОЛОНКА */}
            <div className="w-full lg:w-[320px] xl:w-[380px] bg-muted/10 border-t lg:border-t-0 lg:border-l border-border p-4 lg:p-6 flex flex-col gap-6 flex-shrink-0">
              
              <Card className="border-primary/20 shadow-md bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-primary flex items-center gap-2"><Shield className="w-4 h-4"/> Статус матча</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center py-2 bg-background rounded-lg border shadow-inner">
                    <MatchStatusBadge status={match.status} className="text-sm px-4 py-1.5" />
                  </div>
                  {availableTransitions.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-primary/10">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground text-center">Следующий шаг</p>
                      {availableTransitions.map(ts => (
                        <Button key={`btn-trans-${ts}`} onClick={() => transitionMutation.mutate(ts)} disabled={transitionMutation.isPending} variant={TRANSITION_VARIANT[ts] ?? "default"} className="w-full shadow-sm">
                          {transitionMutation.isPending && transitionMutation.variables === ts ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                          {TRANSITION_LABELS[ts] ?? ts}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="flex-1 flex flex-col border-border/50 shadow-sm overflow-hidden min-h-[300px]">
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4 text-muted-foreground"/> Лог изменений</CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-4 relative before:absolute before:inset-0 before:ml-6 before:w-0.5 before:bg-border/50">
                      {statusLog?.map((log: any, idx: number) => {
                        const STATUS_NAMES: Record<string, string> = {
                          draft: "Черновик",
                          setup: "Настройка",
                          digital_phase: "CS2 (Цифра)",
                          physical_phase: "Лазертаг (Физика)",
                          finished: "Завершён",
                          approved: "Утверждён",
                          locked: "Закрыт"
                        };
                        
                        const fromName = log.fromStatus ? (STATUS_NAMES[log.fromStatus] || log.fromStatus) : null;
                        const toName = STATUS_NAMES[log.toStatus] || log.toStatus;

                        return (
                          <div key={log.id || `log-${idx}`} className="relative flex items-start gap-3">
                            <div className="w-4 h-4 rounded-full bg-background border-2 border-primary z-10 mt-1 shadow-sm shrink-0" />
                            <div className="bg-background border rounded-lg p-2.5 shadow-sm text-xs flex-1">
                              <div className="flex justify-between items-center mb-1.5 border-b pb-1">
                                <span className="font-semibold text-primary">
                                  {new Date(log.changedAt).toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"})}
                                </span>
                                <span className="text-[9px] text-muted-foreground">
                                  {log.changedByName || "Система"}
                                </span>
                              </div>
                              <div className="flex flex-col gap-1">
                                {fromName ? (
                                  <span className="text-muted-foreground">
                                    Переход: <span className="font-medium text-foreground">{fromName}</span> → <span className="font-medium text-primary">{toName}</span>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    Создан в статусе: <span className="font-medium text-primary">{toName}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {(!statusLog || statusLog.length === 0) && (
                         <p className="text-xs text-muted-foreground italic text-center pt-4">Нет записей в журнале</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}