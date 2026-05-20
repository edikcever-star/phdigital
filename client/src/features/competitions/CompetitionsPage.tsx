/**
 * СТРАНИЦА СПИСКА СОРЕВНОВАНИЙ
 *
 * Отображает все соревнования в виде карточек.
 * Администраторы могут создавать новые соревнования.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { fetchCompetitions } from "./competitions.api";
import type { CompetitionWithStats } from "./competitions.api";
import { CreateCompetitionDialog } from "./CreateCompetitionDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trophy,
  Plus,
  Calendar,
  Users,
  Gamepad2,
  MapPin,
  ChevronRight,
} from "lucide-react";
import type { CompetitionStatus } from "@shared/schema";

// -------------------------------------------------------
// Вспомогательные компоненты
// -------------------------------------------------------

/** Конфигурация отображения статуса соревнования */
const STATUS_CONFIG: Record<
  CompetitionStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Активно",
    className:
      "bg-green-500/15 text-green-400 border-green-500/30",
  },
  finished: {
    label: "Завершено",
    className:
      "bg-muted/50 text-muted-foreground border-border",
  },
  archived: {
    label: "В архиве",
    className:
      "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
};

/** Метка формата соревнования */
const FORMAT_LABELS: Record<string, string> = {
  olympic: "Олимпийская",
  round_robin: "Круговая",
  group_playoff: "Группы + плей-офф",
};

/** Карточка одного соревнования */
function CompetitionCard({
  competition,
  onClick,
}: {
  competition: CompetitionWithStats;
  onClick: () => void;
}) {
  const statusCfg = STATUS_CONFIG[competition.status] ?? STATUS_CONFIG.active;

  return (
    <button
      data-testid={`competition-card-${competition.id}`}
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl border border-border bg-card
        hover:border-primary/40 hover:bg-card/80
        transition-all duration-150 active:scale-[0.99] group"
    >
      {/* Заголовок и статус */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
            {competition.name}
          </h3>
          {competition.venue && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {competition.venue}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge
            variant="outline"
            className={`text-xs font-medium ${statusCfg.className}`}
          >
            {statusCfg.label}
          </Badge>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>

      {/* Метаданные */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {/* Даты */}
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            {competition.startDate
              ? new Date(competition.startDate).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "short",
                })
              : "—"}
            {" — "}
            {competition.endDate
              ? new Date(competition.endDate).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—"}
          </span>
        </div>

        {/* Формат */}
        {competition.format && (
          <div className="flex items-center gap-1">
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>{FORMAT_LABELS[competition.format] ?? competition.format}</span>
          </div>
        )}

        {/* Команды */}
        <div className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          <span>{competition.teamsCount}</span>
        </div>
      </div>
    </button>
  );
}

/** Скелетон-заглушка карточки при загрузке */
function CompetitionCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-8" />
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Основной компонент страницы
// -------------------------------------------------------

export default function CompetitionsPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Текущий пользователь — администратор или секретарь
  const isAdmin =
    user?.role === "chief_judge" || user?.role === "chief_secretary";

  // Загрузка списка соревнований
  const {
    data: competitions,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["/api/v1/competitions"],
    queryFn: fetchCompetitions,
  });

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Шапка страницы */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <h1 className="text-base font-semibold text-foreground">
              Соревнования
            </h1>
            {competitions && (
              <Badge variant="secondary" className="text-xs">
                {competitions.length}
              </Badge>
            )}
          </div>

          {/* Кнопка создания — только для admin/secretary */}
          {isAdmin && (
            <Button
              data-testid="btn-create-competition"
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Создать соревнование
            </Button>
          )}
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Состояние загрузки */}
          {isLoading && (
            <div
              data-testid="competitions-loading"
              className="grid grid-cols-1 gap-3 max-w-3xl"
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <CompetitionCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Состояние ошибки */}
          {isError && (
            <div
              data-testid="competitions-error"
              className="flex items-center justify-center py-16"
            >
              <div className="text-center space-y-2">
                <p className="text-sm text-destructive font-medium">
                  Ошибка загрузки
                </p>
                <p className="text-xs text-muted-foreground">
                  {error instanceof Error
                    ? error.message
                    : "Не удалось загрузить список соревнований"}
                </p>
              </div>
            </div>
          )}

          {/* Пустое состояние */}
          {!isLoading && !isError && competitions?.length === 0 && (
            <div
              data-testid="competitions-empty"
              className="flex items-center justify-center py-20"
            >
              <div className="text-center space-y-3 max-w-sm">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/50 border border-border">
                  <Trophy className="w-7 h-7 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">
                    Нет соревнований
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAdmin
                      ? "Создайте первое соревнование, нажав кнопку выше"
                      : "Соревнования ещё не созданы. Обратитесь к администратору."}
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    data-testid="btn-create-competition-empty"
                    size="sm"
                    onClick={() => setCreateDialogOpen(true)}
                    className="gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Создать соревнование
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Список соревнований */}
          {!isLoading && !isError && competitions && competitions.length > 0 && (
            <div
              data-testid="competitions-list"
              className="grid grid-cols-1 gap-3 max-w-3xl"
            >
              {competitions.map((competition) => (
                <CompetitionCard
                  key={competition.id}
                  competition={competition}
                  onClick={() => navigate(`/competitions/${competition.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Диалог создания */}
      <CreateCompetitionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </AppShell>
  );
}
