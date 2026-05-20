/**
 * WEBSOCKET СЕРВЕР
 *
 * Принцип: нативный ws без socket.io.
 * Протокол: JSON-сообщения { event, data, timestamp }
 *
 * Клиент подключается к ws://host:5000/ws?userId=X
 * После подключения должен отправить join:match или join:competition.
 *
 * Аутентификация упрощённая: userId передаётся в query-параметре URL.
 * Сервер находит пользователя в БД по этому ID.
 * Если userId не найден — соединение закрывается с ошибкой.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import { URL } from "url";
import db from "../db/connection";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { UserRole } from "@shared/schema";
import type { LiveProtocolDTO, PresenceUserDTO } from "@shared/contracts/api";
import {
  addClient,
  removeClient,
  subscribeToMatch,
  subscribeToCompetition,
  updatePresence,
  ping as presencePing,
  getMatchPresence,
  broadcastToMatch,
  broadcastToCompetition,
  getAllClients,
} from "./presence-manager";
// Импорты для формирования LiveProtocolDTO
import { getDigitalRounds } from "../services/round.service";
import { getPhysicalRounds } from "../services/round.service";
import { getMatchViolations, getMatchSubstitutions } from "../services/violation.service";
import db_main from "../db/connection";
import {
  matches,
  matchTeams,
  competitionTeams,
  type Match,
} from "@shared/schema";

// -----------------------------------------------------------
// Интервал heartbeat (проверки живых соединений)
// -----------------------------------------------------------
const HEARTBEAT_INTERVAL_MS = 30_000;

// -----------------------------------------------------------
// Глобальная ссылка на WS сервер (нужна для экспортируемых функций)
// -----------------------------------------------------------
let wss: WebSocketServer | null = null;

// -----------------------------------------------------------
// Вспомогательные функции
// -----------------------------------------------------------

/**
 * Отправить JSON-сообщение в формате { event, data, timestamp } конкретному клиенту.
 */
function sendMsg(ws: WebSocket, event: string, data: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify({ event, data, timestamp: Date.now() }));
  } catch (err) {
    console.error(`[WS] Ошибка отправки:`, err);
  }
}

/**
 * Сформировать LiveProtocolDTO для матча.
 * Включает текущий счёт, раунды, нарушения, замены и список присутствующих.
 */
function buildLiveProtocol(matchId: number): LiveProtocolDTO | null {
  try {
    // Получаем базовые данные матча
    const match = db_main
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .get();

    if (!match) return null;

    // Получаем команды матча
    const matchTeamRows = db_main
      .select()
      .from(matchTeams)
      .where(eq(matchTeams.matchId, matchId))
      .all();

    const team1Row = matchTeamRows.find((t) => t.teamSlot === 1);
    const team2Row = matchTeamRows.find((t) => t.teamSlot === 2);

    // Формируем сводку команд
    let team1Info: { id: number; name: string } | null = null;
    let team2Info: { id: number; name: string } | null = null;

    if (team1Row) {
      const ct = db_main
        .select()
        .from(competitionTeams)
        .where(eq(competitionTeams.id, team1Row.compTeamId))
        .get();
      if (ct) team1Info = { id: ct.id, name: ct.name };
    }

    if (team2Row) {
      const ct = db_main
        .select()
        .from(competitionTeams)
        .where(eq(competitionTeams.id, team2Row.compTeamId))
        .get();
      if (ct) team2Info = { id: ct.id, name: ct.name };
    }

    // Формируем MatchSummaryDTO
    const matchSummary = {
      id: match.id,
      competitionId: match.competitionId,
      matchNumber: match.matchNumber,
      stage: match.stage,
      scheduledAt: match.scheduledAt,
      status: match.status,
      team1: team1Info,
      team2: team2Info,
      scoreTotalTeam1: match.scoreTotalTeam1,
      scoreTotalTeam2: match.scoreTotalTeam2,
      winnerTeamId: match.winnerTeamId,
    };

    // Текущий счёт
    const currentScore = {
      digitalTeam1: match.scoreDigitalTeam1 ?? 0,
      digitalTeam2: match.scoreDigitalTeam2 ?? 0,
      physicalTeam1: match.scorePhysicalTeam1 ?? 0,
      physicalTeam2: match.scorePhysicalTeam2 ?? 0,
      totalTeam1: match.scoreTotalTeam1 ?? 0,
      totalTeam2: match.scoreTotalTeam2 ?? 0,
      violationPenaltyTeam1: 0,
      violationPenaltyTeam2: 0,
      winnerTeamSlot: null as 1 | 2 | null,
      isMathematicalWin: false,
    };

    // Вычисляем winnerTeamSlot
    if (match.winnerTeamId !== null) {
      if (team1Row && match.winnerTeamId === team1Row.compTeamId) {
        currentScore.winnerTeamSlot = 1;
      } else if (team2Row && match.winnerTeamId === team2Row.compTeamId) {
        currentScore.winnerTeamSlot = 2;
      }
    }

    // Данные раундов и событий
    const digitalRoundsData = getDigitalRounds(matchId);
    const physicalRoundsData = getPhysicalRounds(matchId);
    const violationsData = getMatchViolations(matchId);
    const substitutionsData = getMatchSubstitutions(matchId);

    // Список присутствующих
    const presenceUsers: PresenceUserDTO[] = getMatchPresence(matchId);

    return {
      match: matchSummary,
      currentScore,
      digitalRounds: digitalRoundsData,
      physicalRounds: physicalRoundsData,
      violations: violationsData,
      substitutions: substitutionsData,
      presenceUsers,
    };
  } catch (err) {
    console.error(`[WS] Ошибка формирования LiveProtocol для матча ${matchId}:`, err);
    return null;
  }
}

/**
 * Распарсить userId из query-параметров URL запроса на подключение.
 */
function parseUserIdFromRequest(req: IncomingMessage): number | null {
  try {
    // req.url может быть "/ws?userId=1"
    const rawUrl = req.url ?? "";
    const parsedUrl = new URL(rawUrl, "http://localhost");
    const userIdStr = parsedUrl.searchParams.get("userId");
    if (!userIdStr) return null;
    const userId = parseInt(userIdStr, 10);
    return isNaN(userId) || userId <= 0 ? null : userId;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------
// Основная функция инициализации WS сервера
// -----------------------------------------------------------

/**
 * Инициализировать WebSocket сервер на том же HTTP порту, что и Express.
 * Принимает соединения по пути /ws.
 */
export function initWsServer(httpServer: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    // --- 1. Получаем userId из query параметров ---
    const userId = parseUserIdFromRequest(req);

    if (userId === null) {
      console.error(`[WS] Подключение без userId — закрываем соединение`);
      sendMsg(ws, "error", { code: "AUTH_REQUIRED", message: "Требуется userId в query параметрах (?userId=X)" });
      ws.close(1008, "AUTH_REQUIRED");
      return;
    }

    // --- 2. Ищем пользователя в БД ---
    let userRecord: { id: number; displayName: string; role: UserRole } | undefined;
    try {
      userRecord = db.select().from(users).where(eq(users.id, userId)).get() as
        | { id: number; displayName: string; role: UserRole }
        | undefined;
    } catch (err) {
      console.error(`[WS] Ошибка запроса пользователя userId=${userId}:`, err);
      sendMsg(ws, "error", { code: "DB_ERROR", message: "Ошибка базы данных" });
      ws.close(1011, "DB_ERROR");
      return;
    }

    if (!userRecord) {
      console.error(`[WS] Пользователь userId=${userId} не найден`);
      sendMsg(ws, "error", { code: "USER_NOT_FOUND", message: `Пользователь с ID ${userId} не найден` });
      ws.close(1008, "USER_NOT_FOUND");
      return;
    }

    // --- 3. Генерируем clientId и регистрируем в presenceManager ---
    const clientId = crypto.randomUUID();
    addClient(clientId, ws, userRecord.id, userRecord.displayName, userRecord.role);

    // Подтверждаем подключение клиенту
    sendMsg(ws, "pong", { timestamp: Date.now() });
    console.error(
      `[WS] Новое соединение: clientId=${clientId}, userId=${userRecord.id}, ` +
      `displayName=${userRecord.displayName}, role=${userRecord.role}`
    );

    // --- 4. Обработчик входящих сообщений ---
    ws.on("message", (rawData) => {
      let parsed: { event: string; data?: unknown; timestamp?: number };

      // Парсим JSON
      try {
        parsed = JSON.parse(rawData.toString()) as { event: string; data?: unknown; timestamp?: number };
      } catch {
        console.error(`[WS] Некорректный JSON от clientId=${clientId}`);
        sendMsg(ws, "error", { code: "INVALID_JSON", message: "Некорректный формат сообщения" });
        return;
      }

      const { event, data } = parsed;

      // --- Роутинг событий ---
      switch (event) {
        // Подписаться на соревнование
        case "join:competition": {
          const d = data as { competitionId?: unknown };
          const competitionId = typeof d?.competitionId === "number" ? d.competitionId : null;
          if (!competitionId) {
            sendMsg(ws, "error", { code: "INVALID_DATA", message: "Требуется competitionId" });
            return;
          }
          subscribeToCompetition(clientId, competitionId);
          break;
        }

        // Подписаться на матч и получить текущее состояние
        case "join:match": {
          const d = data as { matchId?: unknown };
          const matchId = typeof d?.matchId === "number" ? d.matchId : null;
          if (!matchId) {
            sendMsg(ws, "error", { code: "INVALID_DATA", message: "Требуется matchId" });
            return;
          }
          subscribeToMatch(clientId, matchId);

          // Отправляем полное состояние матча новому подписчику
          const liveProtocol = buildLiveProtocol(matchId);
          if (liveProtocol) {
            sendMsg(ws, "match:state", liveProtocol);
          } else {
            sendMsg(ws, "error", { code: "MATCH_NOT_FOUND", message: `Матч ${matchId} не найден` });
          }
          break;
        }

        // Отписаться от матча
        case "leave:match": {
          const d = data as { matchId?: unknown };
          const matchId = typeof d?.matchId === "number" ? d.matchId : null;
          if (!matchId) {
            sendMsg(ws, "error", { code: "INVALID_DATA", message: "Требуется matchId" });
            return;
          }
          // Удаляем клиента из подписчиков матча через removeClient + addClient
          // Проще: вызвать removeClient и сразу re-add без matchId
          // Для этого используем updatePresence с обнулением редактирования
          updatePresence(clientId, "idle", null);
          break;
        }

        // Обновить информацию о присутствии (экран, редактируемая сущность)
        case "presence:update": {
          const d = data as { view?: unknown; editingEntity?: unknown; matchId?: unknown };
          const view = typeof d?.view === "string" ? d.view : "unknown";
          const editingEntity =
            typeof d?.editingEntity === "string" ? d.editingEntity : (d?.editingEntity === null ? null : undefined);
          const matchId =
            typeof d?.matchId === "number" ? d.matchId : undefined;

          updatePresence(clientId, view, editingEntity, matchId);
          break;
        }

        // Ping → pong
        case "ping": {
          const d = data as { timestamp?: unknown };
          const ts = typeof d?.timestamp === "number" ? d.timestamp : Date.now();
          presencePing(clientId);
          sendMsg(ws, "pong", { timestamp: ts });
          break;
        }

        default:
          console.error(`[WS] Неизвестное событие "${event}" от clientId=${clientId}`);
          sendMsg(ws, "error", { code: "UNKNOWN_EVENT", message: `Неизвестное событие: ${event}` });
      }
    });

    // --- 5. Обработчик закрытия соединения ---
    ws.on("close", (code, reason) => {
      console.error(
        `[WS] Соединение закрыто: clientId=${clientId}, ` +
        `code=${code}, reason=${reason.toString()}`
      );
      removeClient(clientId);
    });

    // --- 6. Обработчик ошибок соединения ---
    ws.on("error", (err) => {
      console.error(`[WS] Ошибка соединения clientId=${clientId}:`, err);
      // Закрытие обработает ws.on("close")
    });
  });

  // --- 7. Heartbeat: проверяем все соединения каждые 30 секунд ---
  const heartbeatTimer = setInterval(() => {
    const allClients = getAllClients();
    const now = Date.now();

    wss?.clients.forEach((ws) => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.terminate();
      } else {
        // Проверяем, что соединение живое
        ws.ping();
      }
    });

    // Удаляем клиентов, от которых не было активности более 60 сек
    // Используем Array.from для совместимости с настройками TS компилятора
    for (const [cid, client] of Array.from(allClients)) {
      if (now - client.lastPingAt > 60_000 && client.ws.readyState !== WebSocket.OPEN) {
        console.error(`[WS] Удаляем неактивного клиента: clientId=${cid}`);
        removeClient(cid);
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Очищаем таймер при закрытии сервера
  wss.on("close", () => {
    clearInterval(heartbeatTimer);
    console.error(`[WS] WebSocket сервер остановлен`);
  });

  console.error(`[WS] WebSocket сервер запущен, путь: /ws`);
  return wss;
}

// -----------------------------------------------------------
// Публичные функции для рассылки из REST API handlers
// -----------------------------------------------------------

/**
 * Разослать обновление данных матча всем подписчикам.
 * Вызывается из route handlers при изменении данных матча.
 *
 * Примеры использования:
 *   broadcastMatchUpdate(matchId, "digital_round:updated", roundData)
 *   broadcastMatchUpdate(matchId, "match:status", statusData)
 */
export function broadcastMatchUpdate(matchId: number, event: string, data: unknown): void {
  broadcastToMatch(matchId, event, data);
}

/**
 * Разослать обновление данных соревнования всем подписчикам.
 * Вызывается из route handlers при изменении данных соревнования.
 */
export function broadcastCompetitionUpdate(competitionId: number, event: string, data: unknown): void {
  broadcastToCompetition(competitionId, event, data);
}
