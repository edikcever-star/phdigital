/**
 * КОМПОНЕНТ ПОЛОСКИ ПРИСУТСТВИЯ
 *
 * Отображает список пользователей, которые сейчас онлайн на матче.
 * Каждый пользователь — аватарка с инициалами и роль.
 * Горизонтальная полоска, расположена внизу страницы Live-протокола.
 */

import { cn } from "@/lib/utils";
import type { PresenceUserDTO } from "@shared/contracts/api";
import type { UserRole } from "@shared/schema";

// -------------------------------------------------------
// Вспомогательные функции и конфиги
// -------------------------------------------------------

/** Короткие метки ролей на русском */
const ROLE_SHORT: Record<UserRole, string> = {
  chief_judge: "ГС",
  chief_secretary: "ГСек",
  deputy_judge: "ЗС",
  tech_secretary: "Техсек",
};

/** Цвета аватарок по роли */
const ROLE_COLOR: Record<UserRole, string> = {
  chief_judge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  chief_secretary: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  deputy_judge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  tech_secretary: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
};

/** Порядок сортировки по роли */
const ROLE_ORDER: Record<UserRole, number> = {
  chief_judge: 0,
  chief_secretary: 1,
  deputy_judge: 2,
  tech_secretary: 3,
};

/**
 * Извлекает инициалы из имени пользователя.
 * Например: "Иванов Иван" → "ИИ"
 */
function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

// -------------------------------------------------------
// Аватарка одного пользователя
// -------------------------------------------------------

function UserAvatar({ user }: { user: PresenceUserDTO }) {
  const initials = getInitials(user.displayName);
  const colorClass = ROLE_COLOR[user.role] ?? "bg-zinc-500/20 text-zinc-300 border-zinc-500/30";
  const roleShort = ROLE_SHORT[user.role] ?? user.role;

  return (
    <div
      className="flex items-center gap-1.5 group cursor-default"
      title={`${user.displayName} (${roleShort})`}
    >
      {/* Аватарка с инициалами */}
      <div
        className={cn(
          "w-7 h-7 rounded-full border flex items-center justify-center",
          "text-[10px] font-bold leading-none flex-shrink-0",
          colorClass
        )}
      >
        {initials}
      </div>

      {/* Имя — показывается при наведении */}
      <span className="hidden sm:block text-[11px] text-foreground/80 font-medium">
        {user.displayName}
      </span>
    </div>
  );
}

// -------------------------------------------------------
// Основной компонент
// -------------------------------------------------------

interface PresenceBarProps {
  users: PresenceUserDTO[];
  className?: string;
}

/**
 * Горизонтальная полоска присутствия.
 * Показывает аватарки всех пользователей онлайн + счётчик судей.
 */
export function PresenceBar({ users, className }: PresenceBarProps) {
  // Считаем судей (chief_judge + deputy_judge)
  const judgeCount = users.filter(
    (u) => u.role === "chief_judge" || u.role === "deputy_judge"
  ).length;

  // Сортируем по роли для предсказуемого порядка отображения
  const sorted = [...users].sort(
    (a, b) =>
      (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99)
  );

  return (
    <div
      data-testid="presence-bar"
      className={cn(
        "flex items-center gap-3 px-4 py-2",
        "border-t border-border bg-card/50",
        "text-xs text-muted-foreground",
        className
      )}
    >
      {/* Индикатор числа участников */}
      <span className="flex-shrink-0 font-medium text-muted-foreground">
        Онлайн ({users.length}):
        {judgeCount > 0 && (
          <span className="ml-1 text-blue-400">
            {judgeCount} {judgeCount === 1 ? "судья" : judgeCount < 5 ? "судьи" : "судей"}
          </span>
        )}
      </span>

      {/* Разделитель */}
      <div className="w-px h-4 bg-border flex-shrink-0" />

      {/* Аватарки пользователей */}
      <div className="flex items-center gap-2 flex-1 overflow-x-auto">
        {sorted.map((u) => (
          <UserAvatar key={u.userId} user={u} />
        ))}

        {/* Пустое состояние */}
        {users.length === 0 && (
          <span className="text-muted-foreground/60 italic text-[11px]">
            Нет пользователей онлайн
          </span>
        )}
      </div>
    </div>
  );
}
