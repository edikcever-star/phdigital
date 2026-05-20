/**
 * СТРАНИЦА СПИСКА ГЛОБАЛЬНЫХ КОМАНД
 *
 * Отображает все команды в виде карточек.
 * Администраторы могут создавать новые команды.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { fetchTeams } from "./teams.api";
import { CreateTeamDialog } from "./CreateTeamDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, MapPin, ChevronRight } from "lucide-react";
import type { GlobalTeam } from "@shared/schema";

// -------------------------------------------------------
// Вспомогательные компоненты
// -------------------------------------------------------

/** Карточка одной команды */
function TeamCard({
  team,
  onClick,
}: {
  team: GlobalTeam;
  onClick: () => void;
}) {
  return (
    <button
      data-testid={`team-card-${team.id}`}
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl border border-border bg-card
        hover:border-primary/40 hover:bg-card/80
        transition-all duration-150 active:scale-[0.99] group"
    >
      {/* Заголовок */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
            {team.name}
          </h3>
          {/* Регион — если задан */}
          {team.region && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {team.region}
              </span>
            </div>
          )}
          {/* Заметки — краткий превью */}
          {team.notes && !team.region && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {team.notes}
            </p>
          )}
        </div>

        {/* Иконка перехода */}
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
      </div>
    </button>
  );
}

/** Скелетон-заглушка карточки при загрузке */
function TeamCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-4 w-4 rounded" />
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Основной компонент страницы
// -------------------------------------------------------

export default function TeamsPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Текущий пользователь — администратор или главный секретарь
  const isAdmin =
    user?.role === "chief_judge" || user?.role === "chief_secretary";

  // Загрузка списка команд
  const {
    data: teams,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["/api/v1/teams"],
    queryFn: fetchTeams,
  });

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Шапка страницы */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h1 className="text-base font-semibold text-foreground">Команды</h1>
            {teams && (
              <Badge variant="secondary" className="text-xs">
                {teams.length}
              </Badge>
            )}
          </div>

          {/* Кнопка создания — только для admin */}
          {isAdmin && (
            <Button
              data-testid="btn-create-team"
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Добавить команду
            </Button>
          )}
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Состояние загрузки */}
          {isLoading && (
            <div
              data-testid="teams-loading"
              className="grid grid-cols-1 gap-3 max-w-3xl"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <TeamCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Состояние ошибки */}
          {isError && (
            <div
              data-testid="teams-error"
              className="flex items-center justify-center py-16"
            >
              <div className="text-center space-y-2">
                <p className="text-sm text-destructive font-medium">
                  Ошибка загрузки
                </p>
                <p className="text-xs text-muted-foreground">
                  {error instanceof Error
                    ? error.message
                    : "Не удалось загрузить список команд"}
                </p>
              </div>
            </div>
          )}

          {/* Пустое состояние */}
          {!isLoading && !isError && teams?.length === 0 && (
            <div
              data-testid="teams-empty"
              className="flex items-center justify-center py-20"
            >
              <div className="text-center space-y-3 max-w-sm">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/50 border border-border">
                  <Users className="w-7 h-7 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">
                    Нет команд
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAdmin
                      ? "Создайте первую команду, нажав кнопку выше"
                      : "Команды ещё не созданы. Обратитесь к администратору."}
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    data-testid="btn-create-team-empty"
                    size="sm"
                    onClick={() => setCreateDialogOpen(true)}
                    className="gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить команду
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Список команд */}
          {!isLoading && !isError && teams && teams.length > 0 && (
            <div
              data-testid="teams-list"
              className="grid grid-cols-1 gap-3 max-w-3xl"
            >
              {teams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  onClick={() => navigate(`/teams/${team.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Диалог создания */}
      <CreateTeamDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </AppShell>
  );
}
