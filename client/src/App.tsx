/**
 * ГЛАВНЫЙ КОМПОНЕНТ ПРИЛОЖЕНИЯ
 *
 * Роутинг и защита маршрутов.
 * Неавторизованные пользователи всегда редиректятся на /login.
 */

import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/use-auth";
import LoginPage from "@/features/auth/LoginPage";
import CompetitionsPage from "@/features/competitions/CompetitionsPage";
import CompetitionDetailPage from "@/features/competitions/CompetitionDetailPage";
import TeamsPage from "@/features/teams/TeamsPage";
import TeamDetailPage from "@/features/teams/TeamDetailPage";
import MatchSetupPage from "@/features/matches/MatchSetupPage";
import DigitalPhasePage from "@/features/matches/digital/DigitalPhasePage";
import PhysicalPhasePage from "@/features/matches/physical/PhysicalPhasePage";
import ReferencesPage from "@/features/references/ReferencesPage";
import MatchResultsPage from "@/features/matches/results/MatchResultsPage";
import LiveProtocolPage from "@/features/matches/live/LiveProtocolPage";
import ViolationsPage from "@/features/matches/violations/ViolationsPage";
import ImportPage from "@/features/matches/ImportPage";
import { Loader2 } from "lucide-react";

/**
 * Компонент-охранник маршрутов.
 * Если пользователь не авторизован — показываем LoginPage вместо контента.
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  // Пока идёт первичная проверка сессии — показываем спиннер
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Загрузка...</span>
        </div>
      </div>
    );
  }

  // Не авторизован — показываем логин прямо на месте (без redirect чтобы избежать loop)
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  // Показываем спиннер ТОЛЬКО пока идёт первый запрос /me (до resolve/reject)
  // После получения 401 — isLoading=false, isError=true → рендерим роуты с LoginPage
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Switch>
      {/* Публичные маршруты */}
      <Route path="/login" component={LoginPage} />

      {/* Защищённые маршруты */}
      <Route path="/competitions">
        <AuthGuard><CompetitionsPage /></AuthGuard>
      </Route>

      <Route path="/competitions/:id">
        <AuthGuard><CompetitionDetailPage /></AuthGuard>
      </Route>

      <Route path="/teams">
        <AuthGuard><TeamsPage /></AuthGuard>
      </Route>

      {/* Маршрут настройки матча */}
      <Route path="/matches/:matchId/setup">
        <AuthGuard><MatchSetupPage /></AuthGuard>
      </Route>

      {/* Цифровой этап матча */}
      <Route path="/matches/:matchId/digital">
        <AuthGuard><DigitalPhasePage /></AuthGuard>
      </Route>

      {/* Физический этап матча */}
      <Route path="/matches/:matchId/physical">
        <AuthGuard><PhysicalPhasePage /></AuthGuard>
      </Route>

      {/* Итоги матча и документы */}
      <Route path="/matches/:matchId/results">
        <AuthGuard><MatchResultsPage /></AuthGuard>
      </Route>

      {/* Live-протокол матча (read-only для зрителей) */}
      <Route path="/matches/:matchId/live">
        <AuthGuard><LiveProtocolPage /></AuthGuard>
      </Route>

      {/* Нарушения и замены матча */}
      <Route path="/matches/:matchId/violations">
        <AuthGuard><ViolationsPage /></AuthGuard>
      </Route>

      {/* Импорт статистики из Excel/CSV */}
      <Route path="/matches/:matchId/import">
        <AuthGuard><ImportPage /></AuthGuard>
      </Route>

      <Route path="/teams/:id">
        <AuthGuard><TeamDetailPage /></AuthGuard>
      </Route>

      {/* Справочники — только для chief_judge / chief_secretary */}
      <Route path="/references">
        <AuthGuard><ReferencesPage /></AuthGuard>
      </Route>

      {/* Корень — показываем соревнования или логин в зависимости от аутентификации */}
      <Route path="/">
        {isAuthenticated ? (
          <AuthGuard><CompetitionsPage /></AuthGuard>
        ) : (
          <LoginPage />
        )}
      </Route>

      {/* Catch-all: неизвестный роут */}
      <Route>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground mb-2">404</h2>
            <p className="text-muted-foreground text-sm">Страница не найдена</p>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <AppRoutes />
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}