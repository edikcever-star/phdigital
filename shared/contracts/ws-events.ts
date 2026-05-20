/**
 * КОНТРАКТЫ WEBSOCKET СОБЫТИЙ
 *
 * Строгая типизация всех событий между клиентом и сервером.
 * Эти типы гарантируют, что клиент и сервер говорят на одном языке.
 *
 * Принцип работы:
 * 1. Клиент отправляет команду → сервер валидирует и выполняет
 * 2. Сервер пересчитывает состояние
 * 3. Сервер рассылает обновление всем подписчикам матча
 * 4. Клиенты обновляют UI без ручного refresh
 */

import type {
  MatchStatus,
  DigitalRound,
  PhysicalRound,
  MatchViolation,
  MatchSubstitution,
} from "../schema";
import type { ScoreDTO, PresenceUserDTO, LiveProtocolDTO } from "./api";

// -----------------------------------------------------------
// Клиент → Сервер (команды/действия)
// -----------------------------------------------------------

export interface ClientToServerEvents {
  /** Подписаться на события соревнования */
  "join:competition": { competitionId: number };

  /** Подписаться на конкретный матч */
  "join:match": { matchId: number };

  /** Отписаться от матча */
  "leave:match": { matchId: number };

  /** Обновить информацию о присутствии (какой экран открыт, что редактируется) */
  "presence:update": {
    view: string;
    editingEntity?: string | null; // формат: "digital_round:42"
    matchId?: number;
  };

  /** Ping для поддержания соединения */
  ping: { timestamp: number };
}

// -----------------------------------------------------------
// Сервер → Клиент (события обновлений)
// -----------------------------------------------------------

export interface ServerToClientEvents {
  /** Полное состояние матча (отправляется при join:match) */
  "match:state": LiveProtocolDTO;

  /** Обновление конкретного раунда цифрового этапа */
  "digital_round:updated": {
    matchId: number;
    round: DigitalRound;
  };

  /** Обновление конкретного раунда физического этапа */
  "phys_round:updated": {
    matchId: number;
    round: PhysicalRound;
  };

  /** Пересчитанный счёт матча (отправляется после любого изменения раунда) */
  "match:score": ScoreDTO;

  /** Смена статуса матча */
  "match:status": {
    matchId: number;
    status: MatchStatus;
    changedBy: string;
    changedAt: string;
  };

  /** Новое нарушение зарегистрировано */
  "violation:created": {
    matchId: number;
    violation: MatchViolation & { teamName: string; playerName?: string };
  };

  /** Нарушение обновлено */
  "violation:updated": {
    matchId: number;
    violation: MatchViolation;
  };

  /** Нарушение удалено */
  "violation:deleted": {
    matchId: number;
    violationId: number;
  };

  /** Замена зарегистрирована */
  "substitution:created": {
    matchId: number;
    substitution: MatchSubstitution & {
      playerOutName: string;
      playerInName: string;
    };
  };

  // --- Presence события ---

  /** Полный список онлайн-пользователей в матче */
  "presence:list": {
    matchId: number;
    users: PresenceUserDTO[];
  };

  /** Пользователь подключился */
  "presence:joined": {
    matchId: number;
    user: PresenceUserDTO;
  };

  /** Пользователь отключился */
  "presence:left": {
    matchId: number;
    userId: number;
  };

  /** Пользователь начал/закончил редактировать сущность */
  "presence:editing": {
    matchId: number;
    userId: number;
    entity: string | null; // null = закончил редактирование
  };

  /** Предупреждение о параллельном редактировании */
  "conflict:warning": {
    matchId: number;
    entity: string;
    editingUserId: number;
    editingUserName: string;
  };

  /** Импорт завершён — нужно обновить данные */
  "import:completed": {
    importId: number;
    matchId: number;
    importType: string;
  };

  /** Системная ошибка */
  error: {
    code: string;
    message: string;
  };

  /** Pong ответ на ping */
  pong: { timestamp: number };
}

// -----------------------------------------------------------
// Типы событий как строковые константы
// (для switch/case и addEventListener)
// -----------------------------------------------------------

export const WS_EVENTS = {
  // Клиент → Сервер
  JOIN_COMPETITION: "join:competition",
  JOIN_MATCH: "join:match",
  LEAVE_MATCH: "leave:match",
  PRESENCE_UPDATE: "presence:update",
  PING: "ping",

  // Сервер → Клиент
  MATCH_STATE: "match:state",
  DIGITAL_ROUND_UPDATED: "digital_round:updated",
  PHYS_ROUND_UPDATED: "phys_round:updated",
  MATCH_SCORE: "match:score",
  MATCH_STATUS: "match:status",
  VIOLATION_CREATED: "violation:created",
  VIOLATION_UPDATED: "violation:updated",
  VIOLATION_DELETED: "violation:deleted",
  SUBSTITUTION_CREATED: "substitution:created",
  PRESENCE_LIST: "presence:list",
  PRESENCE_JOINED: "presence:joined",
  PRESENCE_LEFT: "presence:left",
  PRESENCE_EDITING: "presence:editing",
  CONFLICT_WARNING: "conflict:warning",
  IMPORT_COMPLETED: "import:completed",
  ERROR: "error",
  PONG: "pong",
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

// -----------------------------------------------------------
// Обёртка для типизированной отправки/получения WS сообщений
// -----------------------------------------------------------

export interface WsMessage<T = unknown> {
  event: WsEventName;
  data: T;
  timestamp: number;
}
