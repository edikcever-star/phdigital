/**
 * ОБОЛОЧКА ПРИЛОЖЕНИЯ
 */

import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS } from "@shared/constants/roles";
import {
  Trophy,
  Users,
  Gamepad2,
  BookOpen,
  Settings,
  LogOut,
  MonitorPlay,
  Upload,
  Shield,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Версия берётся из package.json автоматически через Vite
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "2.1.0";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Trophy;
  badge?: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/competitions", label: "Соревнования", icon: Trophy },
  { href: "/teams", label: "Команды", icon: Users },
  { href: "/references", label: "Справочники", icon: BookOpen, adminOnly: true },
];

function getMatchNavItems(matchId: string | number): NavItem[] {
  return [
    { href: `/matches/${matchId}/setup`, label: "Настройка матча", icon: Settings },
    { href: `/matches/${matchId}/digital`, label: "Цифровой этап", icon: Gamepad2 },
    { href: `/matches/${matchId}/physical`, label: "Физический этап", icon: Shield },
    { href: `/matches/${matchId}/violations`, label: "Нарушения и замены", icon: BookOpen },
    { href: `/matches/${matchId}/live`, label: "Live-протокол", icon: MonitorPlay },
    { href: `/matches/${matchId}/results`, label: "Итоги матча", icon: Trophy },
    { href: `/matches/${matchId}/import`, label: "Импорт данных", icon: Upload },
  ];
}

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      data-testid={`nav-${item.href.replace(/\//g, "-").slice(1)}`}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
          {item.badge}
        </Badge>
      )}
    </Link>
  );
}

interface AppShellProps {
  children: React.ReactNode;
  activeMatchId?: number;
  activeMatchStatus?: string;
}

export default function AppShell({ children, activeMatchId, activeMatchStatus }: AppShellProps) {
  const [location] = useLocation();
  const { user, logout, isLoggingOut } = useAuth();

  const isAdmin = user?.role === "chief_judge" || user?.role === "chief_secretary";

  const urlMatchId = location.match(/\/matches\/(\d+)/)?.[1];
  const effectiveMatchId = activeMatchId ?? (urlMatchId ? parseInt(urlMatchId, 10) : null);
  const inMatch = location.startsWith("/matches/") && !!urlMatchId;

  const matchNavItems = effectiveMatchId ? getMatchNavItems(effectiveMatchId) : [];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Боковая навигация */}
      <aside className="w-56 flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">

        {/* Логотип */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/25 flex items-center justify-center flex-shrink-0 shadow-sm">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary" fill="none">
              <rect x="3" y="3" width="2.5" height="10" fill="currentColor" rx="0.5" opacity="0.9"/>
              <rect x="3" y="3" width="8" height="2.5" fill="currentColor" rx="0.5" opacity="0.9"/>
              <rect x="3" y="7.5" width="5" height="2" fill="currentColor" rx="0.5" opacity="0.7"/>
              <rect x="13" y="11" width="2.5" height="10" fill="currentColor" rx="0.5" opacity="0.5"/>
              <rect x="13" y="11" width="8" height="2.5" fill="currentColor" rx="0.5" opacity="0.5"/>
              <rect x="13" y="15.5" width="5" height="2" fill="currentColor" rx="0.5" opacity="0.4"/>
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-sidebar-foreground leading-none truncate">
              Протокол матча
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] text-muted-foreground">Фиджитал-спорт</span>
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/20 leading-none">
                <Zap className="w-2.5 h-2.5" />
                v{APP_VERSION}
              </span>
            </div>
          </div>
        </div>

        {/* Основная навигация */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV_ITEMS
            .filter(item => !item.adminOnly || isAdmin)
            .map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={location.startsWith(item.href)}
              />
            ))
          }

          {/* Навигация по матчу */}
          {(effectiveMatchId || inMatch) && matchNavItems.length > 0 && (
            <>
              <div className="pt-3 pb-1 px-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Матч #{effectiveMatchId}
                  </span>
                  {activeMatchStatus && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium border border-primary/15">
                      {activeMatchStatus}
                    </span>
                  )}
                </div>
              </div>

              {matchNavItems.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  isActive={location === item.href || location.startsWith(item.href + "/")}
                />
              ))}
            </>
          )}
        </nav>

        <Separator className="bg-sidebar-border" />

        {/* Пользователь */}
        <div className="p-3 space-y-2">
          {user && (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-sidebar-accent/50 border border-sidebar-border/50">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-sidebar-foreground truncate">
                  {user.displayName}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {ROLE_LABELS[user.role]}
                </div>
              </div>
            </div>
          )}

          <Button
            data-testid="btn-logout"
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            disabled={isLoggingOut}
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 text-xs transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Выйти
          </Button>
        </div>
      </aside>

      {/* Контент */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}