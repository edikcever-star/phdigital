/**
 * LIVE-ПАНЕЛЬ МАТЧА (СВОДНЫЙ ПРОТОКОЛ)
 * 
 * Только для чтения. Автоматически обновляется.
 * Два экрана: "Ход матча" (Таблица) и "Текущий счет" (Дашборд).
 */

import { useState, useMemo, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchDigitalRounds } from "../digital/digital.api";
import { fetchPhysicalRounds } from "../physical/physical.api";
import AppShell from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { 
  ChevronLeft, Monitor, Swords, Trophy, Activity, Maximize, Minimize
} from "lucide-react";
import type { DigitalRound, PhysicalRound } from "@shared/schema";

export default function LiveProtocolPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = parseInt(params.matchId ?? "0", 10);
  const [, navigate] = useLocation();

  const [activeTab, setActiveTab] = useState<"protocol" | "scoreboard">("protocol");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Обновляем раз в 10 секунд, чтобы не спамить базу (вполне достаточно для Live-просмотра)
  const REFETCH_INTERVAL = 10000;

  // Слушаем изменение состояния полноэкранного режима через Esc
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // --- ЗАПРОСЫ ---
  const { data: rawMatchData, isLoading: isMatchLoading } = useQuery({
    queryKey: ["/api/v1/matches", matchId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/matches/${matchId}`);
      if (!res.ok) throw new Error("Ошибка загрузки матча");
      const json = await res.json();
      return json.data || json; 
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const { data: digitalData, isLoading: isDigLoading } = useQuery<any>({
    queryKey: ["/api/v1/matches", matchId, "digital-rounds"],
    queryFn: () => fetchDigitalRounds(matchId),
    refetchInterval: REFETCH_INTERVAL,
  });

  const { data: physicalRounds = [], isLoading: isPhysLoading } = useQuery<PhysicalRound[]>({
    queryKey: ["/api/v1/matches", matchId, "physical-rounds"],
    queryFn: () => fetchPhysicalRounds(matchId),
    refetchInterval: REFETCH_INTERVAL,
  });

  const isLoading = isMatchLoading || isDigLoading || isPhysLoading;

  // --- ОБРАБОТКА ДАННЫХ ---
  const digitalRounds: DigitalRound[] = Array.isArray(digitalData) ? digitalData : (digitalData?.rounds || []);

  const matchTeam1 = rawMatchData?.teams?.find((t: any) => t.teamSlot === 1);
  const matchTeam2 = rawMatchData?.teams?.find((t: any) => t.teamSlot === 2);
  const team1Name = matchTeam1?.compTeam?.name ?? rawMatchData?.team1?.name ?? "Команда 1";
  const team2Name = matchTeam2?.compTeam?.name ?? rawMatchData?.team2?.name ?? "Команда 2";
  const team1Id = matchTeam1?.compTeam?.id ?? rawMatchData?.team1Id ?? -1;
  const team2Id = matchTeam2?.compTeam?.id ?? rawMatchData?.team2Id ?? -2;

  // Подсчет очков
  const t1DigPts = digitalRounds.filter(r => r.winnerTeamId === team1Id && r.status === "completed").reduce((sum, r) => sum + (r.pointsAwarded || 0), 0);
  const t2DigPts = digitalRounds.filter(r => r.winnerTeamId === team2Id && r.status === "completed").reduce((sum, r) => sum + (r.pointsAwarded || 0), 0);
  
  const t1PhysPts = physicalRounds.filter(r => r.winnerTeamId === team1Id && r.status === "completed").reduce((sum, r) => sum + (r.pointsAwarded || 0), 0);
  const t2PhysPts = physicalRounds.filter(r => r.winnerTeamId === team2Id && r.status === "completed").reduce((sum, r) => sum + (r.pointsAwarded || 0), 0);

  const t1Total = t1DigPts + t1PhysPts;
  const t2Total = t2DigPts + t2PhysPts;

  // Сведение раундов для протокола
  const combinedRounds = useMemo(() => {
    const maxRound = Math.max(
      1,
      ...digitalRounds.map(r => r.roundNumber),
      ...physicalRounds.map(r => r.roundNumber)
    );

    return Array.from({ length: maxRound }, (_, i) => {
      const rn = i + 1;
      return {
        roundNumber: rn,
        digital: digitalRounds.find(r => r.roundNumber === rn),
        physical: physicalRounds.find(r => r.roundNumber === rn)
      };
    });
  }, [digitalRounds, physicalRounds]);

  // Проверка на математическую победу
  const scoreDiff = Math.abs(t1Total - t2Total);
  const winThreshold = rawMatchData?.settings?.winThreshold ?? 13; 
  const isMathWin = t1Total >= winThreshold || t2Total >= winThreshold || scoreDiff > 13;
  let leaderText = "";
  if (t1Total > t2Total) leaderText = `Лидирует ${team1Name}`;
  else if (t2Total > t1Total) leaderText = `Лидирует ${team2Name}`;
  else leaderText = "Ничья";

  // Хелперы для UI
  const getPhysSideText = (side?: string) => side === "attack" ? "А" : side === "defense" ? "З" : "-";
  const getPhysSideColor = (side?: string) => side === "attack" ? "text-red-500 font-bold" : side === "defense" ? "text-blue-500 font-bold" : "text-muted-foreground";

  const getDigSideText = (side?: string) => side === "T" ? "T" : side === "CT" ? "CT" : "-";
  const getDigSideColor = (side?: string) => side === "T" ? "text-orange-500 font-bold" : side === "CT" ? "text-blue-500 font-bold" : "text-muted-foreground";

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  if (isLoading) {
    return <AppShell><div className="p-8 space-y-6"><Skeleton className="h-20 w-full" /><Skeleton className="h-[500px] w-full" /></div></AppShell>;
  }

  // Основной контент
  const Content = (
    <div className={cn(
      "flex flex-col bg-background overflow-hidden animate-in fade-in transition-all",
      isFullscreen ? "fixed inset-0 z-50 w-screen h-screen" : "h-full"
    )}>
      {/* ХЕДЕР (скрывается в полноэкранном режиме, но появляется кнопка выхода) */}
      {!isFullscreen && (
        <header className="flex-shrink-0 border-b bg-card/80 backdrop-blur-xl z-20 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate(`/matches/${matchId}`)} className="rounded-xl mr-2">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
              <Activity className="w-5 h-5 text-primary animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight">Сводный протокол</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-widest bg-green-500/15 text-green-600">LIVE</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={toggleFullscreen} className="gap-2 text-xs font-bold uppercase tracking-wider">
              <Maximize className="w-4 h-4" /> На весь экран
            </Button>
          </div>
        </header>
      )}

      {/* КНОПКА ВЫХОДА ИЗ ФУЛСКРИНА (Показывается только в фулскрине) */}
      {isFullscreen && (
        <Button 
          variant="outline" 
          size="icon" 
          onClick={toggleFullscreen} 
          className="absolute top-4 right-4 z-50 rounded-full bg-background/50 backdrop-blur-md border-muted/50 hover:bg-background/80"
        >
          <Minimize className="w-5 h-5 text-muted-foreground" />
        </Button>
      )}

      {/* ПАНЕЛЬ НАВИГАЦИИ */}
      <div className="flex-shrink-0 px-6 py-4 border-b bg-muted/10 flex items-center justify-between z-10">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-auto">
          <TabsList className="grid w-[400px] grid-cols-2">
            <TabsTrigger value="protocol" className="font-bold uppercase tracking-wider text-xs">Ход матча</TabsTrigger>
            <TabsTrigger value="scoreboard" className="font-bold uppercase tracking-wider text-xs">Текущий счет</TabsTrigger>
          </TabsList>
        </Tabs>
        
        {isMathWin && (
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full border border-primary/20 font-black text-sm uppercase tracking-wider animate-pulse">
            <Trophy className="w-4 h-4" /> Возможна математическая победа
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden relative">
        {/* ВКЛАДКА: ХОД МАТЧА (ПРОТОКОЛ) */}
        {activeTab === "protocol" && (
          <div className="absolute inset-0 overflow-auto p-6 bg-muted/5">
            <div className="bg-card border rounded-2xl shadow-sm overflow-hidden min-w-[1000px] max-w-7xl mx-auto">
              <table className="w-full text-sm text-center">
                <thead className="bg-background border-b border-border shadow-sm sticky top-0 z-10">
                  {/* Заголовки Этапов */}
                  <tr className="bg-muted/30">
                    <th rowSpan={3} className="py-3 px-2 border-r border-b w-16 text-muted-foreground uppercase text-xs font-black tracking-widest">Раунд</th>
                    <th colSpan={10} className="py-2 px-4 border-r border-b">
                      <div className="flex items-center justify-center gap-2 font-black uppercase tracking-widest text-primary"><Monitor className="w-4 h-4"/> Цифровой этап</div>
                    </th>
                    <th colSpan={10} className="py-2 px-4 border-b">
                      <div className="flex items-center justify-center gap-2 font-black uppercase tracking-widest text-primary"><Swords className="w-4 h-4"/> Физический этап</div>
                    </th>
                  </tr>
                  {/* Заголовки Команд */}
                  <tr>
                    {/* Цифра */}
                    <th colSpan={5} className="py-2 px-2 border-r border-b text-base font-black truncate max-w-[200px]">{team1Name}</th>
                    <th colSpan={5} className="py-2 px-2 border-r border-b text-base font-black truncate max-w-[200px]">{team2Name}</th>
                    {/* Физика */}
                    <th colSpan={5} className="py-2 px-2 border-r border-b text-base font-black truncate max-w-[200px]">{team1Name}</th>
                    <th colSpan={5} className="py-2 px-2 border-b text-base font-black truncate max-w-[200px]">{team2Name}</th>
                  </tr>
                  {/* Колонки А П Д О */}
                  <tr className="text-[10px] font-bold text-muted-foreground bg-muted/10 uppercase tracking-widest">
                    {/* Цифра Команда 1 */}
                    <th className="py-2 border-r border-b w-8">Ст</th>
                    <th className="py-2 border-r border-b w-8">А</th>
                    <th className="py-2 border-r border-b w-8">П</th>
                    <th className="py-2 border-r border-b w-8">Д</th>
                    <th className="py-2 border-r border-b w-8 bg-primary/5 text-primary">О</th>
                    {/* Цифра Команда 2 */}
                    <th className="py-2 border-r border-b w-8">Ст</th>
                    <th className="py-2 border-r border-b w-8">А</th>
                    <th className="py-2 border-r border-b w-8">П</th>
                    <th className="py-2 border-r border-b w-8">Д</th>
                    <th className="py-2 border-r border-b w-8 bg-primary/5 text-primary">О</th>
                    {/* Физика Команда 1 */}
                    <th className="py-2 border-r border-b w-8">Ст</th>
                    <th className="py-2 border-r border-b w-8">А</th>
                    <th className="py-2 border-r border-b w-8">П</th>
                    <th className="py-2 border-r border-b w-8">Д</th>
                    <th className="py-2 border-r border-b w-8 bg-primary/5 text-primary">О</th>
                    {/* Физика Команда 2 */}
                    <th className="py-2 border-r border-b w-8">Ст</th>
                    <th className="py-2 border-r border-b w-8">А</th>
                    <th className="py-2 border-r border-b w-8">П</th>
                    <th className="py-2 border-r border-b w-8">Д</th>
                    <th className="py-2 border-b w-8 bg-primary/5 text-primary">О</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {combinedRounds.map((row) => {
                    const digT1Win = row.digital?.winnerTeamId === team1Id && row.digital?.status === "completed";
                    const digT2Win = row.digital?.winnerTeamId === team2Id && row.digital?.status === "completed";
                    
                    const physT1Win = row.physical?.winnerTeamId === team1Id && row.physical?.status === "completed";
                    const physT2Win = row.physical?.winnerTeamId === team2Id && row.physical?.status === "completed";

                    return (
                      <tr key={row.roundNumber} className="hover:bg-muted/50 transition-colors">
                        <td className="py-3 font-black border-r text-muted-foreground bg-muted/5">Р-{row.roundNumber}</td>
                        
                        {/* --- ЦИФРА КОМАНДА 1 --- */}
                        <td className={cn("border-r", getDigSideColor(row.digital?.team1Side))}>{getDigSideText(row.digital?.team1Side)}</td>
                        <td className="border-r">{row.digital?.activation && row.digital?.team1Side === "T" ? "●" : ""}</td>
                        <td className="border-r">{row.digital?.explosion && row.digital?.team1Side === "T" ? "●" : ""}</td>
                        <td className="border-r">{row.digital?.deactivation && row.digital?.team1Side === "CT" ? "●" : ""}</td>
                        <td className="border-r font-black bg-primary/5">{digT1Win ? `+${row.digital?.pointsAwarded}` : ""}</td>
                        
                        {/* --- ЦИФРА КОМАНДА 2 --- */}
                        <td className={cn("border-r", getDigSideColor(row.digital?.team1Side === "T" ? "CT" : "T"))}>{row.digital ? getDigSideText(row.digital.team1Side === "T" ? "CT" : "T") : "-"}</td>
                        <td className="border-r">{row.digital?.activation && row.digital?.team1Side !== "T" ? "●" : ""}</td>
                        <td className="border-r">{row.digital?.explosion && row.digital?.team1Side !== "T" ? "●" : ""}</td>
                        <td className="border-r">{row.digital?.deactivation && row.digital?.team1Side !== "CT" ? "●" : ""}</td>
                        <td className="border-r font-black bg-primary/5">{digT2Win ? `+${row.digital?.pointsAwarded}` : ""}</td>

                        {/* --- ФИЗИКА КОМАНДА 1 --- */}
                        <td className={cn("border-r", getPhysSideColor(row.physical?.team1Side))}>{getPhysSideText(row.physical?.team1Side)}</td>
                        <td className="border-r">{row.physical?.activation && row.physical?.team1Side === "attack" ? "●" : ""}</td>
                        <td className="border-r">{row.physical?.explosion && row.physical?.team1Side === "attack" ? "●" : ""}</td>
                        <td className="border-r">{row.physical?.deactivation && row.physical?.team1Side === "defense" ? "●" : ""}</td>
                        <td className="border-r font-black bg-primary/5">{physT1Win ? `+${row.physical?.pointsAwarded}` : ""}</td>
                        
                        {/* --- ФИЗИКА КОМАНДА 2 --- */}
                        <td className={cn("border-r", getPhysSideColor(row.physical?.team1Side === "attack" ? "defense" : "attack"))}>{row.physical ? getPhysSideText(row.physical.team1Side === "attack" ? "defense" : "attack") : "-"}</td>
                        <td className="border-r">{row.physical?.activation && row.physical?.team1Side !== "attack" ? "●" : ""}</td>
                        <td className="border-r">{row.physical?.explosion && row.physical?.team1Side !== "attack" ? "●" : ""}</td>
                        <td className="border-r">{row.physical?.deactivation && row.physical?.team1Side !== "defense" ? "●" : ""}</td>
                        <td className="font-black bg-primary/5">{physT2Win ? `+${row.physical?.pointsAwarded}` : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* ФУТЕР (ИТОГО ПО ЭТАПАМ) */}
                <tfoot className="bg-muted/30 border-t border-border font-black text-lg">
                  <tr>
                    <td className="py-4 border-r text-sm uppercase tracking-widest text-muted-foreground">Итог</td>
                    <td colSpan={4} className="border-r text-right pr-4 text-sm text-muted-foreground uppercase">Очки</td>
                    <td className="border-r text-primary bg-primary/10">{t1DigPts}</td>
                    <td colSpan={4} className="border-r text-right pr-4 text-sm text-muted-foreground uppercase">Очки</td>
                    <td className="border-r text-primary bg-primary/10">{t2DigPts}</td>
                    
                    <td colSpan={4} className="border-r text-right pr-4 text-sm text-muted-foreground uppercase">Очки</td>
                    <td className="border-r text-primary bg-primary/10">{t1PhysPts}</td>
                    <td colSpan={4} className="border-r text-right pr-4 text-sm text-muted-foreground uppercase">Очки</td>
                    <td className="text-primary bg-primary/10">{t2PhysPts}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ВКЛАДКА: ТЕКУЩИЙ СЧЕТ (ДАШБОРД) */}
        {activeTab === "scoreboard" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-background via-background to-muted/20 p-8">
            <div className="w-full max-w-6xl space-y-12 animate-in slide-in-from-bottom-8">
              
              <div className="text-center space-y-4">
                <Badge variant="outline" className="px-4 py-1.5 text-sm uppercase tracking-widest border-primary/20 text-primary bg-primary/5">Live Счёт</Badge>
                <h2 className="text-2xl font-bold text-muted-foreground uppercase tracking-widest">{leaderText}</h2>
              </div>

              <div className="flex items-center justify-between gap-12">
                {/* КОМАНДА 1 */}
                <div className="flex-1 flex flex-col items-end text-right">
                  <h3 className="text-5xl lg:text-7xl font-black uppercase tracking-tight mb-6 truncate max-w-[400px]">{team1Name}</h3>
                  <div className="space-y-3 w-full max-w-[300px]">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border shadow-sm">
                      <span className="text-muted-foreground font-bold flex items-center gap-2"><Monitor className="w-4 h-4"/> Цифра</span>
                      <span className="text-2xl font-black">{t1DigPts}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border shadow-sm">
                      <span className="text-muted-foreground font-bold flex items-center gap-2"><Swords className="w-4 h-4"/> Физика</span>
                      <span className="text-2xl font-black">{t1PhysPts}</span>
                    </div>
                  </div>
                </div>

                {/* ГЛАВНЫЙ СЧЕТ */}
                <div className="flex items-center gap-8 shrink-0">
                  <div className="text-[8rem] lg:text-[12rem] font-black leading-none text-foreground tabular-nums tracking-tighter">
                    {t1Total}
                  </div>
                  <div className="text-6xl font-light text-muted-foreground/30 mb-8">:</div>
                  <div className="text-[8rem] lg:text-[12rem] font-black leading-none text-foreground tabular-nums tracking-tighter">
                    {t2Total}
                  </div>
                </div>

                {/* КОМАНДА 2 */}
                <div className="flex-1 flex flex-col items-start text-left">
                  <h3 className="text-5xl lg:text-7xl font-black uppercase tracking-tight mb-6 truncate max-w-[400px]">{team2Name}</h3>
                  <div className="space-y-3 w-full max-w-[300px]">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border shadow-sm">
                      <span className="text-2xl font-black">{t2DigPts}</span>
                      <span className="text-muted-foreground font-bold flex items-center gap-2">Цифра <Monitor className="w-4 h-4"/></span>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border shadow-sm">
                      <span className="text-2xl font-black">{t2PhysPts}</span>
                      <span className="text-muted-foreground font-bold flex items-center gap-2">Физика <Swords className="w-4 h-4"/></span>
                    </div>
                  </div>
                </div>
              </div>

              {isMathWin && (
                <div className="mt-16 text-center animate-in zoom-in">
                  <div className="inline-flex items-center gap-4 bg-primary text-primary-foreground px-8 py-4 rounded-full font-black text-2xl uppercase tracking-widest shadow-[0_0_40px_rgba(var(--primary),0.4)]">
                    <Trophy className="w-8 h-8" />
                    Матч-пойнт / Возможная победа
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Возвращаем Контент либо внутри AppShell (если мы не в фулскрине), либо "голым" на весь экран
  return isFullscreen ? Content : <AppShell>{Content}</AppShell>;
}