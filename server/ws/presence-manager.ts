/**
 * МЕНЕДЖЕР ПРИСУТСТВИЯ
 *
 * Отслеживает кто онлайн, на каком матче, что редактирует.
 * Хранит состояние в памяти — при перезапуске сервера состояние сбрасывается.
 *
 * Архитектура:
 * - presenceMap:             Map<clientId, ConnectedClient>
 * - matchSubscribers:        Map<matchId, Set<clientId>>
 * - competitionSubscribers:  Map<competitionId, Set<clientId>>
 */

import type WebSocket from "ws";
import type { PresenceUserDTO } from "@shared/contracts/api";
import type { UserRole } from "@shared/schema";

// -----------------------------------------------------------
// Внутренние типы
// -----------------------------------------------------------

/** Данные одного подключённого клиента */
interface ConnectedClient {
  ws: WebSocket;
  userId: number;
  displayName: string;
  role: UserRole;
  matchId: number | null;         // какой матч открыт
  competitionId: number | null;   // какое соревнование открыто
  currentView: string | null;     // текущий экран (например "match:digital_phase")
  isEditing: string | null;       // что редактирует ("digital_round:42" или null)
  connectedAt: number;            // timestamp подключения
  lastPingAt: number;             // timestamp последнего пинга
}

// -----------------------------------------------------------
// Хранилища состояния
// -----------------------------------------------------------

/** Все подключённые клиенты. Ключ — уникальный clientId (UUID) */
const presenceMap = new Map<string, ConnectedClient>();

/** Подписчики матчей. Ключ — matchId, значение — Set clientId */
const matchSubscribers = new Map<number, Set<string>>();

/** Подписчики соревнований. Ключ — competitionId, значение — Set clientId */
const competitionSubscribers = new Map<number, Set<string>>();

// -----------------------------------------------------------
// Вспомогательные функции
// -----------------------------------------------------------

/**
 * Отправить сообщение конкретному клиенту.
 * Если соединение не открыто — молча игнорируем.
 */
function sendToClient(ws: WebSocket, event: string, data: unknown): void {
  if (ws.readyState !== 1 /* WebSocket.OPEN */) return;
  try {
    ws.send(JSON.stringify({ event, data, timestamp: Date.now() }));
  } catch (err) {
    console.error(`[WS] Ошибка отправки сообщения клиенту:`, err);
  }
}

/**
 * Преобразовать внутреннее состояние клиента в публичный DTO.
 */
function toPresenceUserDTO(client: ConnectedClient): PresenceUserDTO {
  return {
    userId: client.userId,
    displayName: client.displayName,
    role: client.role,
    currentView: client.currentView,
    isEditing: client.isEditing,
    connectedAt: new Date(client.connectedAt).toISOString(),
  };
}

// -----------------------------------------------------------
// Публичные методы менеджера
// -----------------------------------------------------------

/**
 * Зарегистрировать новое соединение.
 * Вызывается при подключении клиента к WebSocket серверу.
 */
export function addClient(
  clientId: string,
  ws: WebSocket,
  userId: number,
  displayName: string,
  role: UserRole
): void {
  const now = Date.now();
  presenceMap.set(clientId, {
    ws,
    userId,
    displayName,
    role,
    matchId: null,
    competitionId: null,
    currentView: null,
    isEditing: null,
    connectedAt: now,
    lastPingAt: now,
  });
  console.error(`[WS] Клиент подключён: clientId=${clientId}, userId=${userId}, displayName=${displayName}`);
}

/**
 * Удалить клиента при разрыве соединения.
 * Уведомляет подписчиков матча о выходе пользователя.
 */
export function removeClient(clientId: string): void {
  const client = presenceMap.get(clientId);
  if (!client) return;

  const { matchId, competitionId, userId } = client;

  // Уведомляем подписчиков матча об отключении пользователя
  if (matchId !== null) {
    const subs = matchSubscribers.get(matchId);
    if (subs) {
      subs.delete(clientId);
      if (subs.size === 0) {
        matchSubscribers.delete(matchId);
      }
    }
    // Рассылаем событие presence:left всем оставшимся в матче
    broadcastToMatch(matchId, "presence:left", { matchId, userId });
  }

  // Удаляем из подписчиков соревнования
  if (competitionId !== null) {
    const subs = competitionSubscribers.get(competitionId);
    if (subs) {
      subs.delete(clientId);
      if (subs.size === 0) {
        competitionSubscribers.delete(competitionId);
      }
    }
  }

  presenceMap.delete(clientId);
  console.error(`[WS] Клиент отключён: clientId=${clientId}, userId=${userId}`);
}

/**
 * Подписать клиента на события матча.
 * Отправляет текущий список присутствующих всем в матче.
 */
export function subscribeToMatch(clientId: string, matchId: number): void {
  const client = presenceMap.get(clientId);
  if (!client) return;

  // Отписываемся от предыдущего матча, если он был
  if (client.matchId !== null && client.matchId !== matchId) {
    const prevSubs = matchSubscribers.get(client.matchId);
    if (prevSubs) {
      prevSubs.delete(clientId);
    }
    // Уведомляем предыдущий матч об уходе
    broadcastToMatch(client.matchId, "presence:left", {
      matchId: client.matchId,
      userId: client.userId,
    });
  }

  // Регистрируем подписку на новый матч
  client.matchId = matchId;
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId)!.add(clientId);

  // Сообщаем всем в матче о новом участнике
  broadcastToMatch(matchId, "presence:joined", {
    matchId,
    user: toPresenceUserDTO(client),
  });

  // Отправляем новому участнику полный список присутствующих
  const presenceList = getMatchPresence(matchId);
  sendToClient(client.ws, "presence:list", { matchId, users: presenceList });

  console.error(`[WS] Клиент ${clientId} подписался на матч ${matchId}`);
}

/**
 * Подписать клиента на события соревнования.
 */
export function subscribeToCompetition(clientId: string, competitionId: number): void {
  const client = presenceMap.get(clientId);
  if (!client) return;

  // Отписываемся от предыдущего соревнования
  if (client.competitionId !== null && client.competitionId !== competitionId) {
    const prevSubs = competitionSubscribers.get(client.competitionId);
    if (prevSubs) {
      prevSubs.delete(clientId);
    }
  }

  client.competitionId = competitionId;
  if (!competitionSubscribers.has(competitionId)) {
    competitionSubscribers.set(competitionId, new Set());
  }
  competitionSubscribers.get(competitionId)!.add(clientId);

  console.error(`[WS] Клиент ${clientId} подписался на соревнование ${competitionId}`);
}

/**
 * Обновить состояние присутствия клиента.
 * Рассылает presence:editing если сущность редактирования изменилась.
 * Отправляет conflict:warning если другой пользователь уже редактирует ту же сущность.
 */
export function updatePresence(
  clientId: string,
  view: string,
  editingEntity?: string | null,
  matchId?: number
): void {
  const client = presenceMap.get(clientId);
  if (!client) return;

  const prevEditing = client.isEditing;
  client.currentView = view;

  // Обновляем matchId если передан
  if (matchId !== undefined && matchId !== client.matchId) {
    subscribeToMatch(clientId, matchId);
  }

  // Проверяем изменение редактируемой сущности
  const newEditing = editingEntity !== undefined ? (editingEntity ?? null) : client.isEditing;

  if (newEditing !== prevEditing) {
    client.isEditing = newEditing;

    // Рассылаем всем в матче информацию об изменении редактирования
    if (client.matchId !== null) {
      broadcastToMatch(client.matchId, "presence:editing", {
        matchId: client.matchId,
        userId: client.userId,
        entity: newEditing,
      });

      // Проверяем конфликт: не редактирует ли кто-то ещё ту же сущность
      if (newEditing !== null) {
        const conflictClient = findEditorOfEntity(newEditing, clientId, client.matchId);
        if (conflictClient) {
          // Предупреждаем текущего клиента о конфликте
          sendToClient(client.ws, "conflict:warning", {
            matchId: client.matchId,
            entity: newEditing,
            editingUserId: conflictClient.userId,
            editingUserName: conflictClient.displayName,
          });
          console.error(
            `[WS] Конфликт редактирования: сущность ${newEditing} уже редактируется ` +
            `пользователем ${conflictClient.displayName} (userId=${conflictClient.userId})`
          );
        }
      }
    }
  }
}

/**
 * Найти клиента, который редактирует указанную сущность в том же матче.
 * Исключает самого себя из поиска.
 */
function findEditorOfEntity(
  entity: string,
  excludeClientId: string,
  matchId: number
): ConnectedClient | null {
  const subs = matchSubscribers.get(matchId);
  if (!subs) return null;

  // Используем Array.from для совместимости с настройками TS компилятора
  for (const cid of Array.from(subs)) {
    if (cid === excludeClientId) continue;
    const c = presenceMap.get(cid);
    if (c && c.isEditing === entity) {
      return c;
    }
  }
  return null;
}

/**
 * Получить список присутствующих в матче как DTO.
 */
export function getMatchPresence(matchId: number): PresenceUserDTO[] {
  const subs = matchSubscribers.get(matchId);
  if (!subs) return [];

  const result: PresenceUserDTO[] = [];
  // Используем Array.from для совместимости с настройками TS компилятора
  for (const clientId of Array.from(subs)) {
    const client = presenceMap.get(clientId);
    if (client) {
      result.push(toPresenceUserDTO(client));
    }
  }
  return result;
}

/**
 * Разослать сообщение всем подписчикам матча.
 */
export function broadcastToMatch(matchId: number, event: string, data: unknown): void {
  const subs = matchSubscribers.get(matchId);
  if (!subs || subs.size === 0) return;

  const message = JSON.stringify({ event, data, timestamp: Date.now() });

  // Используем Array.from для совместимости с настройками TS компилятора
  for (const clientId of Array.from(subs)) {
    const client = presenceMap.get(clientId);
    if (client && client.ws.readyState === 1 /* WebSocket.OPEN */) {
      try {
        client.ws.send(message);
      } catch (err) {
        console.error(`[WS] Ошибка рассылки в матч ${matchId}, clientId=${clientId}:`, err);
      }
    }
  }
}

/**
 * Разослать сообщение всем подписчикам соревнования.
 */
export function broadcastToCompetition(competitionId: number, event: string, data: unknown): void {
  const subs = competitionSubscribers.get(competitionId);
  if (!subs || subs.size === 0) return;

  const message = JSON.stringify({ event, data, timestamp: Date.now() });

  // Используем Array.from для совместимости с настройками TS компилятора
  for (const clientId of Array.from(subs)) {
    const client = presenceMap.get(clientId);
    if (client && client.ws.readyState === 1 /* WebSocket.OPEN */) {
      try {
        client.ws.send(message);
      } catch (err) {
        console.error(`[WS] Ошибка рассылки в соревнование ${competitionId}, clientId=${clientId}:`, err);
      }
    }
  }
}

/**
 * Обновить метку времени последнего пинга клиента.
 */
export function ping(clientId: string): void {
  const client = presenceMap.get(clientId);
  if (client) {
    client.lastPingAt = Date.now();
  }
}

/**
 * Получить все подключённые клиентские записи.
 * Используется сервером для heartbeat-проверки.
 */
export function getAllClients(): Map<string, ConnectedClient> {
  return presenceMap;
}

/**
 * Экспортируем тип ConnectedClient для использования в ws-server.ts
 */
export type { ConnectedClient };
