/**
 * ХУК WEBSOCKET ПОДКЛЮЧЕНИЯ К МАТЧУ
 *
 * Устанавливает нативное WS-соединение с сервером, подписывается на конкретный
 * матч и возвращает live-состояние. Поддерживает reconnect и heartbeat.
 *
 * Использование:
 *   const { liveData, connected, error } = useMatchSocket(matchId);
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { LiveProtocolDTO, ScoreDTO, PresenceUserDTO } from "@shared/contracts/api";
import type {
  DigitalRoundWithStats,
  PhysicalRoundWithStats,
} from "@shared/contracts/api";
import type { MatchStatus, MatchViolation, MatchSubstitution } from "@shared/schema";

// Максимальное число попыток переподключения
const MAX_RECONNECT_ATTEMPTS = 5;
// Задержка перед переподключением (мс)
const RECONNECT_DELAY_MS = 3000;
// Интервал heartbeat (мс)
const HEARTBEAT_INTERVAL_MS = 30_000;

/** Тип входящего WS-сообщения от сервера */
interface WsIncomingMessage {
  event: string;
  data: unknown;
  timestamp?: number;
}

/** Состояние хука */
interface UseMatchSocketState {
  liveData: LiveProtocolDTO | null;
  connected: boolean;
  error: string | null;
}

/**
 * Хук WebSocket подключения к матчу.
 *
 * Подключается к серверу, отправляет join:match и обрабатывает все события,
 * обновляя локальное состояние liveData без HTTP-запросов.
 *
 * @param matchId - ID матча для подписки
 */
export function useMatchSocket(matchId: number): UseMatchSocketState {
  const { user } = useAuth();

  const [liveData, setLiveData] = useState<LiveProtocolDTO | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Рефы для управления жизненным циклом
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  // Флаг чистого закрытия (чтобы не реконнектиться при размонтировании)
  const unmountedRef = useRef(false);

  /** Очищает таймеры heartbeat и reconnect */
  const clearTimers = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  /** Отправляет JSON-сообщение в WS (только если соединение открыто) */
  const sendMessage = useCallback((event: string, data: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, data, timestamp: Date.now() }));
    }
  }, []);

  /** Основная функция подключения */
  const connect = useCallback(() => {
    // Не подключаться если не авторизован или компонент уже размонтирован
    if (!user || unmountedRef.current) return;

    // Закрыть предыдущее соединение если есть
    if (wsRef.current) {
      wsRef.current.onclose = null; // отключаем обработчик чтобы не триггерить reconnect
      wsRef.current.close();
      wsRef.current = null;
    }

    // Формируем URL: ws(s)://host/ws?userId=X
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?userId=${user.id}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      setError("Не удалось создать WebSocket соединение");
      return;
    }
    wsRef.current = ws;

    // --- Соединение открыто ---
    ws.onopen = () => {
      if (unmountedRef.current) {
        ws.close();
        return;
      }
      setConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;

      // Подписываемся на матч
      sendMessage("join:match", { matchId });

      // Обновляем presence: текущий вид
      sendMessage("presence:update", {
        view: `live:${matchId}`,
        matchId,
      });

      // Запускаем heartbeat
      heartbeatTimerRef.current = setInterval(() => {
        sendMessage("ping", { timestamp: Date.now() });
      }, HEARTBEAT_INTERVAL_MS);
    };

    // --- Входящее сообщение ---
    ws.onmessage = (event) => {
      let msg: WsIncomingMessage;
      try {
        msg = JSON.parse(event.data as string) as WsIncomingMessage;
      } catch {
        // Игнорируем невалидные сообщения
        return;
      }

      handleServerEvent(msg);
    };

    // --- Ошибка ---
    ws.onerror = () => {
      if (!unmountedRef.current) {
        setError("Ошибка WebSocket соединения");
      }
    };

    // --- Соединение закрыто ---
    ws.onclose = () => {
      clearTimers();

      if (unmountedRef.current) return;

      setConnected(false);

      // Переподключение если не достигли лимита попыток
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current += 1;
        setError(
          `Соединение потеряно. Переподключение (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`
        );
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      } else {
        setError("Не удалось подключиться к серверу. Обновите страницу.");
      }
    };
  }, [user, matchId, sendMessage, clearTimers]);

  /**
   * Обработчик событий от сервера.
   * Обновляет соответствующие части liveData.
   */
  const handleServerEvent = useCallback((msg: WsIncomingMessage) => {
    switch (msg.event) {
      // Полный снимок состояния при подключении
      case "match:state": {
        setLiveData(msg.data as LiveProtocolDTO);
        break;
      }

      // Обновление раунда цифрового этапа
      case "digital_round:updated": {
        const payload = msg.data as { matchId: number; round: DigitalRoundWithStats };
        setLiveData((prev) => {
          if (!prev) return prev;
          const rounds = prev.digitalRounds.map((r) =>
            r.roundNumber === payload.round.roundNumber ? { ...r, ...payload.round } : r
          );
          return { ...prev, digitalRounds: rounds };
        });
        break;
      }

      // Обновление раунда физического этапа
      case "phys_round:updated": {
        const payload = msg.data as { matchId: number; round: PhysicalRoundWithStats };
        setLiveData((prev) => {
          if (!prev) return prev;
          const rounds = prev.physicalRounds.map((r) =>
            r.roundNumber === payload.round.roundNumber ? { ...r, ...payload.round } : r
          );
          return { ...prev, physicalRounds: rounds };
        });
        break;
      }

      // Обновление счёта
      case "match:score": {
        const score = msg.data as ScoreDTO;
        setLiveData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            currentScore: {
              digitalTeam1: score.digitalTeam1,
              digitalTeam2: score.digitalTeam2,
              physicalTeam1: score.physicalTeam1,
              physicalTeam2: score.physicalTeam2,
              totalTeam1: score.totalTeam1,
              totalTeam2: score.totalTeam2,
              violationPenaltyTeam1: score.violationPenaltyTeam1,
              violationPenaltyTeam2: score.violationPenaltyTeam2,
              winnerTeamSlot: prev.currentScore.winnerTeamSlot,
              isMathematicalWin: score.isMathematicalWin,
            },
          };
        });
        break;
      }

      // Смена статуса матча
      case "match:status": {
        const payload = msg.data as {
          matchId: number;
          status: MatchStatus;
          changedBy: string;
          changedAt: string;
        };
        setLiveData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            match: { ...prev.match, status: payload.status },
          };
        });
        break;
      }

      // Новое нарушение
      case "violation:created": {
        const payload = msg.data as { matchId: number; violation: MatchViolation };
        setLiveData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            violations: [...prev.violations, payload.violation],
          };
        });
        break;
      }

      // Новая замена
      case "substitution:created": {
        const payload = msg.data as { matchId: number; substitution: MatchSubstitution };
        setLiveData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            substitutions: [...prev.substitutions, payload.substitution],
          };
        });
        break;
      }

      // Полный список присутствующих (при подключении)
      case "presence:list": {
        const users = msg.data as PresenceUserDTO[];
        setLiveData((prev) => {
          if (!prev) return prev;
          return { ...prev, presenceUsers: users };
        });
        break;
      }

      // Новый пользователь присоединился
      case "presence:joined": {
        const newUser = msg.data as PresenceUserDTO;
        setLiveData((prev) => {
          if (!prev) return prev;
          // Не дублируем если уже есть
          const exists = prev.presenceUsers.some((u) => u.userId === newUser.userId);
          if (exists) return prev;
          return { ...prev, presenceUsers: [...prev.presenceUsers, newUser] };
        });
        break;
      }

      // Пользователь покинул
      case "presence:left": {
        const payload = msg.data as { userId: number };
        setLiveData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            presenceUsers: prev.presenceUsers.filter((u) => u.userId !== payload.userId),
          };
        });
        break;
      }

      // pong и прочие — игнорируем
      default:
        break;
    }
  }, []);

  // --- Основной эффект: управление жизненным циклом WS ---
  useEffect(() => {
    unmountedRef.current = false;

    // Не подключаться до авторизации
    if (!user) return;

    connect();

    return () => {
      // Размонтирование — чистое закрытие
      unmountedRef.current = true;
      clearTimers();

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        // Отписываемся от матча перед закрытием
        try {
          ws.send(JSON.stringify({ event: "leave:match", data: { matchId }, timestamp: Date.now() }));
        } catch {
          // Игнорируем ошибки при закрытии
        }
        ws.close();
      }
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, matchId]);

  return { liveData, connected, error };
}
