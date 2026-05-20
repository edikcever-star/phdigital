/**
 * СТРАНИЦА ДЕТАЛЬНОГО ПРОСМОТРА СОРЕВНОВАНИЯ
 *
 * Пять табов:
 *   1. Обзор        — основные данные
 *   2. Настройки    — правила этапов (цифровой/физический)
 *   3. Команды      — список команд с управлением
 *   4. Персонал     — судейская бригада
 *   5. Матчи        — список матчей соревнования
 */
import { BracketTab } from "./BracketTab";
import { AddStaffDialog } from "./AddStaffDialog";
import { ManageRosterDialog } from "./ManageRosterDialog";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ChevronDown, User , Crown  } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import {
  fetchCompetition,
  fetchCompetitionTeams,
  fetchCompetitionStaff,
  fetchCompetitionMatches,
  removeTeamFromCompetition,
  removeStaffFromCompetition,
  // ВАЖНО: Тебе нужно будет добавить эти 2 функции в competitions.api.ts
  fetchCompetitionSettings, 
  updateCompetitionSettings
} from "./competitions.api";
import { AddTeamDialog } from "./AddTeamDialog";
import { CreateMatchDialog } from "../matches/CreateMatchDialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Trophy,
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Shield,
  Gamepad2,
  Plus,
  Trash2,
  Loader2,
  ClipboardList,
  CheckCircle2,
  Clock,
  Settings2,
  Save
} from "lucide-react";
import type { CompetitionStatus, MatchStatus } from "@shared/schema";

// -------------------------------------------------------
// Вспомогательные конфигурации
// -------------------------------------------------------

const COMPETITION_STATUS_CONFIG: Record<
  CompetitionStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Активно",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  finished: {
    label: "Завершено",
    className: "bg-muted/50 text-muted-foreground border-border",
  },
  archived: {
    label: "В архиве",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
};

const FORMAT_LABELS: Record<string, string> = {
  olympic: "Олимпийская система",
  round_robin: "Круговая система",
  group_playoff: "Группы + плей-офф",
};

const MATCH_STATUS_CONFIG: Record<
  MatchStatus,
  { label: string; className: string }
> = {
  draft: { label: "Черновик", className: "bg-muted/50 text-muted-foreground" },
  setup: { label: "Настройка", className: "bg-blue-500/15 text-blue-400" },
  digital_phase: {
    label: "Цифровой",
    className: "bg-cyan-500/15 text-cyan-400",
  },
  physical_phase: {
    label: "Физический",
    className: "bg-orange-500/15 text-orange-400",
  },
  finished: {
    label: "Завершён",
    className: "bg-muted/50 text-muted-foreground",
  },
  approved: {
    label: "Утверждён",
    className: "bg-green-500/15 text-green-400",
  },
  locked: { label: "Заблокирован", className: "bg-purple-500/15 text-purple-400" },
};

function DetailSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-6 w-2/3" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-2/5" />
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Вкладка: Обзор (Дашборд турнира)
// -------------------------------------------------------


interface OverviewTabProps {
  competitionId: number;
  isAdmin: boolean;
}

function OverviewTab({ competitionId, isAdmin }: OverviewTabProps) {
  const [, navigate] = useLocation();

  // Загружаем основную информацию
  const { data: competition, isLoading: isCompLoading } = useQuery({
    queryKey: [`/api/v1/competitions/${competitionId}`],
    queryFn: () => fetchCompetition(competitionId),
  });

  // Загружаем судейскую бригаду для вывода на главном экране
  const { data: staff, isLoading: isStaffLoading } = useQuery({
    queryKey: [`/api/v1/competitions/${competitionId}/staff`],
    queryFn: () => fetchCompetitionStaff(competitionId),
  });

  if (isCompLoading || isStaffLoading) return <DetailSkeleton />;

  if (!competition) {
    return <div className="p-6 text-sm text-muted-foreground">Данные не найдены</div>;
  }

  const statusCfg = COMPETITION_STATUS_CONFIG[competition.status] ?? COMPETITION_STATUS_CONFIG.active;

  // Находим главных лиц турнира для отображения
  const chiefJudge = staff?.find(s => s.staffRole === "chief_judge");
  const chiefSecretary = staff?.find(s => s.staffRole === "chief_secretary");

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      
      {/* БЛОК 1: ОСНОВНАЯ ИНФОРМАЦИЯ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Карточка: Детали */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4 col-span-1 md:col-span-2">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <Trophy className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-foreground">Информация о турнире</h3>
            <Badge variant="outline" className={`ml-auto text-[10px] uppercase ${statusCfg.className}`}>
              {statusCfg.label}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Формат</span>
              <p className="text-sm font-medium">{competition.format ? FORMAT_LABELS[competition.format] : "Не указан"}</p>
            </div>
            
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Даты проведения</span>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                {competition.startDate ? new Date(competition.startDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—"} 
                {" - "} 
                {competition.endDate ? new Date(competition.endDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—"}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Место проведения</span>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                {competition.venue || "Не указано"}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Участники (План / Факт)</span>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                {competition.teamsCount} / {competition.plannedParticipants || "—"} команд
              </p>
            </div>
          </div>
        </div>

        {/* Карточка: Главная судейская коллегия */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <Shield className="w-4 h-4 text-emerald-500" />
            <h3 className="font-bold text-foreground">Судейская коллегия</h3>
          </div>
          
          <div className="space-y-3">
            <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Главный судья</span>
              <p className="text-sm font-semibold">{chiefJudge ? chiefJudge.judge.fullName : "Не назначен"}</p>
            </div>
            <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Главный секретарь</span>
              <p className="text-sm font-semibold">{chiefSecretary ? chiefSecretary.judge.fullName : "Не назначен"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* БЛОК 2: СЕТКА СОРЕВНОВАНИЯ */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Мы просто вызываем готовый компонент сетки, чтобы не писать код дважды */}
        <BracketTab competitionId={competitionId} isAdmin={isAdmin} />
      </div>

      {/* БЛОК 3: СПИСОК МАТЧЕЙ (В ТАБЛИЧНОМ ВИДЕ) */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Мы просто вызываем готовый компонент матчей, который мы переделали в таблицу на прошлом шаге */}
        <MatchesTab competitionId={competitionId} isAdmin={isAdmin} />
      </div>

    </div>
  );
}
// -------------------------------------------------------
// Вкладка: Настройки этапов (ОБНОВЛЕННАЯ ПО ТЗ)
// -------------------------------------------------------

import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function SettingsTab({ competitionId, isAdmin }: OverviewTabProps) {
  const { toast } = useToast();
  
  const { data: settings, isLoading } = useQuery({
    queryKey: [`/api/v1/competitions/${competitionId}/settings`],
    queryFn: () => fetchCompetitionSettings(competitionId),
  });

  const updateMutation = useMutation({
    mutationFn: (newSettings: any) => updateCompetitionSettings(competitionId, newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/v1/competitions/${competitionId}/settings`] });
      toast({ title: "Настройки этапов успешно сохранены" });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const [formData, setFormData] = useState<any>(null);

  if (settings && !formData) setFormData(settings);
  if (isLoading) return <DetailSkeleton />;
  if (!formData) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: Number(e.target.value) });
  };

  const handleSelectChange = (name: string, value: string | boolean) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  return (
    <div className="p-6 space-y-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl border border-border">
        <div>
          <h3 className="text-lg font-bold text-foreground">Правила и регламент турнира</h3>
          <p className="text-sm text-muted-foreground">Здесь настраиваются все параметры цифрового и физического этапов.</p>
        </div>
        {isAdmin && (
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2 shadow-sm">
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить изменения
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* ЦИФРОВОЙ ЭТАП */}
        <div className="space-y-5 bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 pb-3 border-b border-border/50">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Gamepad2 className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <h4 className="font-bold text-cyan-600">Цифровой этап (CS2)</h4>
              <p className="text-xs text-muted-foreground">Настройки раундов и овертайма</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Раундов 1-я половина</Label>
                <Input type="number" name="digitalRoundsHalf1" value={formData.digitalRoundsHalf1} onChange={handleChange} disabled={!isAdmin} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Раундов 2-я половина</Label>
                <Input type="number" name="digitalRoundsHalf2" value={formData.digitalRoundsHalf2} onChange={handleChange} disabled={!isAdmin} className="font-mono" />
              </div>
            </div>

            <div className="space-y-1.5 bg-muted/20 p-3 rounded-lg border border-border/50">
              <Label className="text-xs font-semibold text-muted-foreground">Стоимость победы в раунде (в общий зачёт)</Label>
              <div className="flex items-center gap-3">
                <Input type="number" name="digitalRoundWinPts" value={formData.digitalRoundWinPts} onChange={handleChange} disabled={!isAdmin} className="font-mono w-24" />
                <span className="text-sm text-muted-foreground">очков</span>
              </div>
            </div>

            <Separator className="my-2" />
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Овертайм (Допы)</Label>
                <p className="text-xs text-muted-foreground">Включить дополнительные раунды</p>
              </div>
              <Switch 
                checked={formData.overtimeEnabled} 
                onCheckedChange={(checked) => handleSelectChange("overtimeEnabled", checked)}
                disabled={!isAdmin}
              />
            </div>

            {formData.overtimeEnabled && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                <Label className="text-xs font-semibold text-muted-foreground">Формат овертайма</Label>
                <Select disabled={!isAdmin} value={formData.overtimeType} onValueChange={(val) => handleSelectChange("overtimeType", val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите формат" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MR3">MR3 (по 3 раунда за сторону)</SelectItem>
                    <SelectItem value="MR5">MR5 (по 5 раундов за сторону)</SelectItem>
                    <SelectItem value="MR10">MR10 (по 10 раундов за сторону)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* ФИЗИЧЕСКИЙ ЭТАП */}
        <div className="space-y-5 bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 pb-3 border-b border-border/50">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Trophy className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h4 className="font-bold text-orange-600">Физический этап (Лазертаг)</h4>
              <p className="text-xs text-muted-foreground">Длительность и веса побед</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Всего раундов</Label>
                <Input type="number" name="physTotalRounds" value={formData.physTotalRounds} onChange={handleChange} disabled={!isAdmin} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Раунд смены сторон</Label>
                <Input type="number" name="physSideSwitchRound" value={formData.physSideSwitchRound} onChange={handleChange} disabled={!isAdmin} className="font-mono" />
              </div>
            </div>

            <div className="pt-2">
              <Label className="text-sm font-semibold block mb-3">Вес каждого типа победы (Баллы)</Label>
              <div className="space-y-3 bg-muted/20 p-3 rounded-lg border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Активация (Установка)</span>
                  <Input type="number" name="physActivationPts" value={formData.physActivationPts} onChange={handleChange} disabled={!isAdmin} className="w-20 font-mono text-center h-8" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Подрыв (Взрыв пламени)</span>
                  <Input type="number" name="physExplosionPts" value={formData.physExplosionPts} onChange={handleChange} disabled={!isAdmin} className="w-20 font-mono text-center h-8" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Деактивация (Разминирование)</span>
                  <Input type="number" name="physDeactivationPts" value={formData.physDeactivationPts} onChange={handleChange} disabled={!isAdmin} className="w-20 font-mono text-center h-8" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Победа по фрагам (Уничтожение)</span>
                  <Input type="number" name="physFragWinPts" value={formData.physFragWinPts} onChange={handleChange} disabled={!isAdmin} className="w-20 font-mono text-center h-8" />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 leading-tight">
                *Если общее количество раундов в физическом этапе отличается от цифрового, вручную укажите количество баллов для баланса итогового счёта.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Вкладка: Команды (С РАСКРЫВАЮЩИМСЯ СОСТАВОМ)
// -------------------------------------------------------

interface TeamsTabProps {
  competitionId: number;
  isAdmin: boolean;
}

const ROLE_TRANSLATIONS: Record<string, string> = {
  coach: "Тренер",
  manager: "Менеджер",
  assistant: "Помощник",
  representative: "Представитель",
};

export function TeamsTab({ competitionId, isAdmin }: TeamsTabProps) {
  const { toast } = useToast();
  
  // Состояния интерфейса
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null);
  const [rosterTeam, setRosterTeam] = useState<any | null>(null); // Стейт для модалки управления составом

  // Получение списка команд
  const { data: teams, isLoading } = useQuery({
    queryKey: [`/api/v1/competitions/${competitionId}/teams`],
    queryFn: () => fetchCompetitionTeams(competitionId),
  });

  // Удаление команды
  const removeMutation = useMutation({
    mutationFn: (teamId: number) => removeTeamFromCompetition(competitionId, teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/v1/competitions/${competitionId}/teams`] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/competitions"] });
      toast({ title: "Команда удалена из соревнования" });
    },
    onError: (err: Error) => { 
      toast({ title: "Ошибка", description: err.message, variant: "destructive" }); 
    },
  });

  if (isLoading) return <DetailSkeleton />;

 return (
  <div className="p-6 space-y-6 max-w-3xl mx-auto">
    {/* Заголовок и кнопка добавления */}
    <div className="flex items-center justify-between pb-2 border-b border-border/40">
      <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        Команды
        {teams && (
          <Badge variant="secondary" className="ml-1 text-xs font-medium px-2 py-0.5 bg-primary/10 text-primary">
            {teams.length}
          </Badge>
        )}
      </h3>
      {isAdmin && (
        <Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-2 shadow-sm hover:shadow-md transition-shadow">
          <Plus className="w-4 h-4" /> Добавить команду
        </Button>
      )}
    </div>

    {/* Пустое состояние */}
    {(!teams || teams.length === 0) && (
      <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-border bg-gradient-to-b from-muted/10 to-transparent">
        <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-muted-foreground/60" />
        </div>
        <p className="text-base font-medium text-foreground">Команды ещё не добавлены</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-[250px] text-center">
          {isAdmin ? "Нажмите кнопку выше, чтобы создать первую команду на турнире." : "Ожидайте, пока администратор добавит участников."}
        </p>
      </div>
    )}

    {/* Список команд */}
    <div className="space-y-4">
      {teams?.map((team) => {
        const isExpanded = expandedTeamId === team.id;
        // Ищем капитана для отображения аватарки/статуса в шапке (опционально)
        const captain = team.players?.find((p: any) => p.isCaptain);

        return (
          <div 
            key={team.id} 
            className={`rounded-xl border transition-all duration-300 shadow-sm overflow-hidden ${
              isExpanded ? "border-primary/40 shadow-md ring-1 ring-primary/5" : "border-border bg-card hover:border-border/80"
            }`}
          >
            {/* Шапка команды (Кликабельная) */}
            <div 
              className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${
                isExpanded ? "bg-gradient-to-r from-primary/5 via-transparent to-transparent" : "bg-card hover:bg-muted/30"
              }`}
              onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-sm font-black text-primary drop-shadow-sm">{team.name.charAt(0).toUpperCase()}</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-foreground truncate flex items-center gap-2">
                  {team.name}
                  {captain && !isExpanded && (
                    <Crown className="w-3.5 h-3.5 text-amber-500/70" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 font-medium">
                  {team.region && <span className="bg-muted px-1.5 py-0.5 rounded-sm">{team.region}</span>}
                  {team.region && (team.players?.length > 0) && <span className="text-border text-xs">•</span>}
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" /> {team.players?.length || 0}
                  </span>
                  {(team.officials?.length > 0) && (
                    <>
                      <span className="text-border text-xs">•</span>
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3" /> {team.officials?.length}
                      </span>
                    </>
                  )}
                </div>
              </div>
              
              {/* Кнопка удаления команды */}
              {isAdmin && !team.snapshotLocked && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (confirm(`Вы уверены, что хотите удалить команду "${team.name}"?`)) {
                      removeMutation.mutate(team.id); 
                    }
                  }} 
                  disabled={removeMutation.isPending} 
                  className="h-8 w-8 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors z-10"
                  title="Удалить команду"
                >
                  {removeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </Button>
              )}
              
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isExpanded ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"}`}>
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {/* Раскрывающийся состав (Аккордеон) */}
            <div 
              className={`grid transition-all duration-300 ease-in-out ${
                isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="p-5 bg-gradient-to-b from-muted/5 to-background border-t border-border/50">
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* Секция Игроков */}
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-primary/10">
                          <User className="w-3.5 h-3.5 text-primary" />
                        </div>
                        Состав
                      </h4>
                      
                      {team.players && team.players.length > 0 ? (
                        <ul className="space-y-2.5">
                          {team.players.map((p: any) => (
                            <li
                              key={p.id}
                              className={`group flex items-center justify-between px-3.5 py-2.5 rounded-lg border transition-all duration-200 ${
                                p.isCaptain
                                  ? "bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/30 ring-1 ring-amber-500/10 shadow-sm"
                                  : "bg-card border-border hover:bg-muted/40 shadow-sm hover:shadow-md"
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {/* Имя и значки статуса */}
                                <div className="flex items-center flex-wrap gap-2">
                                  <span className={`font-semibold text-sm truncate ${p.isCaptain ? "text-foreground" : "text-foreground/90"}`}>
                                    {p.fullName}
                                  </span>

                                  {/* Бейдж Капитана */}
                                  {p.isCaptain && (
                                    <Badge 
                                      variant="outline" 
                                      className="h-[20px] px-1.5 py-0 text-[10px] uppercase font-bold tracking-wider bg-amber-500/10 text-amber-600 border-amber-500/40 gap-1 animate-in fade-in zoom-in-95"
                                    >
                                      <Crown className="w-3 h-3 fill-amber-500/20 text-amber-500" />
                                      Капитан
                                    </Badge>
                                  )}

                                  {/* Бейдж Резерва */}
                                  {p.isReserve && (
                                    <Badge 
                                      variant="outline" 
                                      className="h-[20px] px-1.5 py-0 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground bg-muted/40 border-dashed border-muted-foreground/40"
                                    >
                                      Резерв
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Позиция и Номер */}
                              <div className="flex items-center gap-3 shrink-0 ml-4">
                                {p.position && (
                                  <span className="text-[10px] font-bold text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-sm tracking-wider uppercase border border-border/50">
                                    {p.position}
                                  </span>
                                )}
                                
                                {p.number && (
                                  <div className="flex items-center justify-center min-w-[28px] h-[24px] bg-secondary text-secondary-foreground text-xs font-black rounded-md shadow-sm border border-border/50">
                                    #{p.number}
                                  </div>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-xs text-muted-foreground bg-muted/20 border border-dashed border-border/60 rounded-lg p-4 text-center flex flex-col items-center gap-2">
                          <User className="w-5 h-5 text-muted-foreground/40" />
                          В команде пока нет игроков
                        </div>
                      )}
                    </div>

                    {/* Секция Персонала */}
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-emerald-500/10">
                          <Shield className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        Персонал
                      </h4>
                      
                      {team.officials && team.officials.length > 0 ? (
                        <ul className="space-y-2.5">
                          {team.officials.map((o: any) => (
                            <li key={o.id} className="text-sm bg-card px-4 py-3 rounded-lg border border-border shadow-sm flex items-center justify-between group hover:border-emerald-500/30 hover:shadow-md transition-all">
                              <span className="text-foreground font-semibold">{o.fullName}</span>
                              <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider bg-muted text-muted-foreground">
                                {ROLE_TRANSLATIONS[o.role] || o.role || "Стафф"}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-xs text-muted-foreground bg-muted/20 border border-dashed border-border/60 rounded-lg p-4 text-center flex flex-col items-center gap-2">
                          <Shield className="w-5 h-5 text-muted-foreground/40" />
                          Персонал не назначен
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Кнопка "Управление составом" */}
                  {isAdmin && (
                    <div className="mt-6 pt-5 border-t border-border/50 flex justify-end">
                      <Button 
                        variant="secondary" 
                        className="gap-2 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary font-semibold transition-colors"
                        onClick={() => setRosterTeam(team)}
                      >
                        <Users className="w-4 h-4" />
                        Управление составом
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>

    {/* Диалоговые окна */}
    <AddTeamDialog 
      competitionId={competitionId} 
      open={addDialogOpen} 
      onOpenChange={setAddDialogOpen} 
    />

   {/* Диалоговое окно управления составом конкретной команды */}
<ManageRosterDialog 
  competitionId={competitionId}
  // ВОТ ГЛАВНЫЙ СЕКРЕТ: Мы всегда берем самую свежую версию команды из массива teams!
  // Если rosterTeam задан (мы открыли окно), мы ищем его свежую копию в teams.
  team={rosterTeam ? teams?.find(t => t.id === rosterTeam.id) || rosterTeam : null}
  open={!!rosterTeam}
  onOpenChange={(open) => !open && setRosterTeam(null)}
/>
  </div>
);
}

/// -------------------------------------------------------
// Вкладка: Персонал
// -------------------------------------------------------
interface StaffTabProps {
  competitionId: number;
  isAdmin: boolean;
}

const JUDGE_ROLE_TRANSLATIONS: Record<string, string> = {
  chief_judge: "Главный судья",
  chief_secretary: "Главный секретарь",
  deputy_chief_judge: "Заместитель главного судьи",
  technical_secretary: "Технический секретарь",
};

function StaffTab({ competitionId, isAdmin }: StaffTabProps) {
  const { toast } = useToast();
  const [addStaffOpen, setAddStaffOpen] = useState(false); // Стейт для диалога

  const { data: staff, isLoading } = useQuery({
    queryKey: [`/api/v1/competitions/${competitionId}/staff`],
    queryFn: () => fetchCompetitionStaff(competitionId),
  });

  const removeMutation = useMutation({
    mutationFn: (staffId: number) => removeStaffFromCompetition(competitionId, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/v1/competitions/${competitionId}/staff`] });
      toast({ title: "Судья удалён из бригады" });
    },
    onError: (err: Error) => { 
      toast({ title: "Ошибка", description: err.message, variant: "destructive" }); 
    },
  });

  if (isLoading) return <DetailSkeleton />;

  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Судейская бригада
          {staff && <Badge variant="secondary" className="ml-2 text-xs">{staff.length}</Badge>}
        </h3>
        
        {/* Кнопка назначения судьи */}
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setAddStaffOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Назначить судью
          </Button>
        )}
      </div>

      {staff?.length === 0 && (
        <div className="flex items-center justify-center py-12 rounded-xl border border-dashed border-border bg-muted/10">
          <div className="text-center space-y-2">
            <Shield className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Судейская бригада не назначена</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {staff?.map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card shadow-sm transition-all hover:shadow-md">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-emerald-600">{entry.judge.fullName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">{entry.judge.fullName}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wider bg-muted text-muted-foreground">
                  {JUDGE_ROLE_TRANSLATIONS[entry.staffRole] || entry.staffRole}
                </Badge>
                {entry.judge.category && (
                  <span className="text-xs text-muted-foreground">
                    · {entry.judge.category}
                  </span>
                )}
              </div>
            </div>
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  if (confirm(`Удалить судью ${entry.judge.fullName} из бригады?`)) {
                    removeMutation.mutate(entry.id);
                  }
                }} 
                disabled={removeMutation.isPending} 
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Удалить судью"
              >
                {removeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Диалог добавления судьи */}
      <AddStaffDialog 
        competitionId={competitionId} 
        open={addStaffOpen} 
        onOpenChange={setAddStaffOpen} 
      />
    </div>
  );
}

// -------------------------------------------------------
// Вкладка: Матчи
// -------------------------------------------------------
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MatchesTabProps {
  competitionId: number;
  isAdmin: boolean;
}

function MatchesTab({ competitionId, isAdmin }: MatchesTabProps) {
  const [, navigate] = useLocation();
  const [createMatchDialogOpen, setCreateMatchDialogOpen] = useState(false);
  
  const { data: matchesList, isLoading } = useQuery({
    queryKey: [`/api/v1/competitions/${competitionId}/matches`],
    queryFn: () => fetchCompetitionMatches(competitionId),
  });

  if (isLoading) return <DetailSkeleton />;

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between pb-4 border-b border-border/40">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
            <Gamepad2 className="w-5 h-5 text-primary" />
            Список матчей
            {matchesList && (
              <Badge variant="secondary" className="ml-1 text-xs px-2 py-0.5 bg-primary/10 text-primary">
                {matchesList.length}
              </Badge>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Все запланированные и прошедшие игры турнира</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreateMatchDialogOpen(true)} className="gap-2 shadow-sm">
            <Plus className="w-4 h-4" /> Создать новый матч
          </Button>
        )}
      </div>

      {(!matchesList || matchesList.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-border bg-muted/5">
          <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <Gamepad2 className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-base font-medium text-foreground">Матчи ещё не созданы</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-[250px] text-center">
            {isAdmin ? "Сгенерируйте сетку турнира или добавьте матч вручную." : "Ожидайте публикации расписания."}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden shadow-sm bg-card">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[100px] text-xs font-semibold uppercase tracking-wider">№ Матча</TableHead>
                <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider">Стадия</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Команды</TableHead>
                <TableHead className="w-[120px] text-center text-xs font-semibold uppercase tracking-wider">Счёт</TableHead>
                <TableHead className="w-[140px] text-right text-xs font-semibold uppercase tracking-wider">Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matchesList.map((match) => {
                const statusCfg = MATCH_STATUS_CONFIG[match.status] ?? MATCH_STATUS_CONFIG.draft;
                const isFinished = match.status === "finished" || match.status === "approved" || match.status === "locked";
                
                return (
                  <TableRow 
                    key={match.id} 
                    className="cursor-pointer transition-colors hover:bg-muted/50 group"
                    onClick={() => navigate(`/matches/${match.id}/setup`)}
                  >
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {match.matchNumber || `ID:${match.id}`}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-foreground">
                      {match.stage || "Группа"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-foreground truncate max-w-[150px]">
                          {match.team1?.name ?? "TBD (Ожидается)"}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium px-2">vs</span>
                        <span className="text-sm font-bold text-foreground truncate max-w-[150px]">
                          {match.team2?.name ?? "TBD (Ожидается)"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {(match.scoreTotalTeam1 !== null || match.scoreTotalTeam2 !== null) ? (
                        <div className="inline-flex items-center justify-center bg-muted/60 px-3 py-1 rounded-md border border-border/50">
                          <span className={`text-sm font-bold font-mono ${match.scoreTotalTeam1! > match.scoreTotalTeam2! ? 'text-primary' : 'text-foreground'}`}>
                            {match.scoreTotalTeam1 ?? 0}
                          </span>
                          <span className="text-muted-foreground mx-1.5">:</span>
                          <span className={`text-sm font-bold font-mono ${match.scoreTotalTeam2! > match.scoreTotalTeam1! ? 'text-primary' : 'text-foreground'}`}>
                            {match.scoreTotalTeam2 ?? 0}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isFinished ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${statusCfg.className}`}>
                          {statusCfg.label}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      
      <CreateMatchDialog 
        open={createMatchDialogOpen} 
        onOpenChange={setCreateMatchDialogOpen} 
        competitionId={competitionId} 
      />
    </div>
  );
}


// -------------------------------------------------------
// Главный компонент страницы
// -------------------------------------------------------

export default function CompetitionDetailPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const competitionId = parseInt(params.id ?? "0");

  const isAdmin = user?.role === "chief_judge" || user?.role === "chief_secretary";

  const { data: competition, isLoading, isError } = useQuery({
    queryKey: [`/api/v1/competitions/${competitionId}`],
    queryFn: () => fetchCompetition(competitionId),
    enabled: !isNaN(competitionId) && competitionId > 0,
  });

  if (isNaN(competitionId) || competitionId <= 0) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Некорректный ID соревнования</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/competitions")}>К списку</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const statusCfg = competition ? COMPETITION_STATUS_CONFIG[competition.status] : null;

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Шапка страницы */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => navigate("/competitions")} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Trophy className="w-5 h-5 text-primary flex-shrink-0" />
            {isLoading ? <Skeleton className="h-5 w-48" /> : isError ? <span className="text-sm text-muted-foreground">Соревнование не найдено</span> : <h1 className="text-base font-semibold text-foreground truncate">{competition?.name}</h1>}
          </div>
          {statusCfg && <Badge variant="outline" className={`text-xs flex-shrink-0 ${statusCfg.className}`}>{statusCfg.label}</Badge>}
        </div>

        {isError && (
          <div className="flex-1 flex items-center justify-center">
             <p className="text-sm text-destructive">Ошибка загрузки</p>
          </div>
        )}

        {!isError && (
          <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full justify-start px-6 pt-4 pb-0 border-b border-border rounded-none h-auto bg-transparent gap-1">
              <TabsTrigger value="overview" className="text-xs px-3 py-1.5 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none">Обзор</TabsTrigger>
              <TabsTrigger value="settings" className="text-xs px-3 py-1.5 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none">Настройки</TabsTrigger>
              <TabsTrigger value="teams" className="text-xs px-3 py-1.5 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none">Команды</TabsTrigger>
              <TabsTrigger value="staff" className="text-xs px-3 py-1.5 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none">Персонал</TabsTrigger>
              <TabsTrigger value="matches" className="text-xs px-3 py-1.5 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none">Матчи</TabsTrigger>
              <TabsTrigger value="bracket" className="text-xs px-3 py-1.5 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none">Сетка</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              <TabsContent value="overview" className="mt-0"><OverviewTab competitionId={competitionId} isAdmin={isAdmin} /></TabsContent>
              <TabsContent value="settings" className="mt-0"><SettingsTab competitionId={competitionId} isAdmin={isAdmin} /></TabsContent>
              <TabsContent value="teams" className="mt-0"><TeamsTab competitionId={competitionId} isAdmin={isAdmin} /></TabsContent>
              <TabsContent value="staff" className="mt-0"><StaffTab competitionId={competitionId} isAdmin={isAdmin} /></TabsContent>
              <TabsContent value="matches" className="mt-0"><MatchesTab competitionId={competitionId} isAdmin={isAdmin} /></TabsContent>
              <TabsContent value="bracket" className="mt-0">  <BracketTab competitionId={competitionId} isAdmin={isAdmin} /></TabsContent>
            </div>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}
