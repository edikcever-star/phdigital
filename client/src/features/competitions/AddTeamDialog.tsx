/**
 * ДИАЛОГ ДОБАВЛЕНИЯ КОМАНДЫ В СОРЕВНОВАНИЕ
 *
 * Загружает список глобальных команд и позволяет:
 * - выбрать существующую команду из базы (с поиском)
 * - добавить команду вручную (без привязки к глобальной)
 *
 * Улучшения: защита от двойной отправки, корректный сброс стейта, улучшенный поиск.
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { fetchGlobalTeams, addTeamToCompetition } from "./competitions.api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Search,
  Plus,
  ChevronRight,
  Loader2,
  PenLine,
} from "lucide-react";
import type { GlobalTeam } from "@shared/schema";

// -------------------------------------------------------
// Вспомогательные типы
// -------------------------------------------------------

type AddMode = "list" | "manual";

interface AddTeamDialogProps {
  competitionId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// -------------------------------------------------------
// Компонент
// -------------------------------------------------------

export function AddTeamDialog({
  competitionId,
  open,
  onOpenChange,
}: AddTeamDialogProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<AddMode>("list");
  const [search, setSearch] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualRegion, setManualRegion] = useState("");

  // Загрузка глобальных команд
  const { data: globalTeams, isLoading: teamsLoading } = useQuery({
    queryKey: ["/api/v1/teams"],
    queryFn: fetchGlobalTeams,
    enabled: open,
  });

  // Мутация добавления команды
  const addMutation = useMutation({
    mutationFn: (data: { name: string; globalTeamId?: number; region?: string }) =>
      addTeamToCompetition(competitionId, {
        name: data.name,
        globalTeamId: data.globalTeamId,
        region: data.region,
        copyFromGlobal: !!data.globalTeamId,
      }),
    onSuccess: (_, vars) => {
      // Инвалидируем кеш команд соревнования
      queryClient.invalidateQueries({
        queryKey: [`/api/v1/competitions/${competitionId}/teams`],
      });
      // Также обновляем список соревнований (обновится счётчик команд)
      queryClient.invalidateQueries({ queryKey: ["/api/v1/competitions"] });
      toast({
        title: "Команда добавлена",
        description: `«${vars.name}» успешно добавлена в соревнование`,
      });
      handleClose();
    },
    onError: (err: Error) => {
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось добавить команду",
        variant: "destructive",
      });
    },
  });

  // Сброс стейта и закрытие диалога
  const handleClose = () => {
    // Не закрываем, если идет отправка
    if (addMutation.isPending) return;
    
    setSearch("");
    setManualName("");
    setManualRegion("");
    setMode("list");
    onOpenChange(false);
  };

  // Выбор команды из глобального списка
  const handleSelectGlobal = (team: GlobalTeam) => {
    if (addMutation.isPending) return;
    
    addMutation.mutate({
      name: team.name,
      globalTeamId: team.id,
      region: team.region ?? undefined,
    });
  };

  // Добавление вручную
  const handleAddManual = () => {
    if (addMutation.isPending) return;
    
    const trimmedName = manualName.trim();
    if (!trimmedName) {
        toast({
            title: "Внимание",
            description: "Введите название команды",
            variant: "destructive",
        });
        return;
    }
    
    addMutation.mutate({
      name: trimmedName,
      region: manualRegion.trim() || undefined,
    });
  };

  // Оптимизированная фильтрация команд (не пересчитывается при каждом рендере, если search и globalTeams не менялись)
  const filteredTeams = useMemo(() => {
    if (!globalTeams) return [];
    const lowerSearch = search.trim().toLowerCase();
    if (!lowerSearch) return globalTeams;
    
    return globalTeams.filter((t) =>
      t.name.toLowerCase().includes(lowerSearch) ||
      (t.region ?? "").toLowerCase().includes(lowerSearch)
    );
  }, [globalTeams, search]);

  // Запрет закрытия по клику вне окна во время отправки запроса
  const handleInteractOutside = (e: Event) => {
    if (addMutation.isPending) {
      e.preventDefault();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent
        data-testid="add-team-dialog"
        className="sm:max-w-md"
        onInteractOutside={handleInteractOutside}
      >
        <DialogHeader>
          <DialogTitle>Добавить команду</DialogTitle>
        </DialogHeader>

        {/* Переключатель режима */}
        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border">
          <button
            data-testid="tab-team-from-list"
            onClick={() => setMode("list")}
            disabled={addMutation.isPending}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 ${
              mode === "list"
                ? "bg-background text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Из базы команд
          </button>
          <button
            data-testid="tab-team-manual"
            onClick={() => setMode("manual")}
            disabled={addMutation.isPending}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 ${
              mode === "manual"
                ? "bg-background text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            Ввести вручную
          </button>
        </div>

        {/* Режим: выбор из базы */}
        {mode === "list" && (
          <div className="space-y-3">
            {/* Поле поиска */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                data-testid="input-team-search"
                placeholder="Поиск по названию или региону..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={addMutation.isPending}
                className="pl-8"
              />
            </div>

            {/* Список глобальных команд */}
            <div className="max-h-72 overflow-y-auto space-y-1 rounded-lg border border-border bg-card p-1.5">
              {teamsLoading && (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              )}

              {!teamsLoading && filteredTeams.length === 0 && (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  {search.trim()
                    ? "По вашему запросу команды не найдены"
                    : "Глобальных команд нет. Используйте ручной ввод."}
                </div>
              )}

              {filteredTeams.map((team) => (
                <button
                  key={team.id}
                  data-testid={`global-team-item-${team.id}`}
                  disabled={addMutation.isPending}
                  onClick={() => handleSelectGlobal(team)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
                    hover:bg-accent transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-primary">
                      {team.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {team.name}
                    </div>
                    {team.region && (
                      <div className="text-xs text-muted-foreground truncate">
                        {team.region}
                      </div>
                    )}
                  </div>
                  {addMutation.isPending && addMutation.variables?.globalTeamId === team.id ? (
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>

            <Separator />

            {/* Кнопка перехода к ручному вводу */}
            <button
              onClick={() => setMode("manual")}
              disabled={addMutation.isPending}
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-border
                hover:border-primary/50 hover:bg-primary/5 transition-all text-xs text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Нет нужной команды? Добавить вручную
            </button>
          </div>
        )}

        {/* Режим: ручной ввод */}
        {mode === "manual" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground block">
                Название команды <span className="text-destructive">*</span>
              </label>
              <Input
                data-testid="input-manual-team-name"
                placeholder="Например: Cyber Bears"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                disabled={addMutation.isPending}
                onKeyDown={(e) =>
                  e.key === "Enter" && manualName.trim() && handleAddManual()
                }
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground block">
                Регион <span className="text-muted-foreground font-normal">(необязательно)</span>
              </label>
              <Input
                data-testid="input-manual-team-region"
                placeholder="Москва, Санкт-Петербург..."
                value={manualRegion}
                disabled={addMutation.isPending}
                onChange={(e) => setManualRegion(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && manualName.trim() && handleAddManual()
                }
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                data-testid="btn-cancel-add-team"
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={addMutation.isPending}
              >
                Отмена
              </Button>
              <Button
                data-testid="btn-submit-add-team"
                type="button"
                className="flex-1"
                onClick={handleAddManual}
                disabled={!manualName.trim() || addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Добавить команду
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}