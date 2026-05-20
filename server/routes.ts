/**
 * ГЛАВНЫЙ РОУТЕР — регистрация всех API маршрутов и WebSocket сервера
 *
 * Все API маршруты монтируются под префиксом /api/v1/
 * Версионирование API позволит в будущем добавлять v2 без поломки v1.
 */

import type { Express } from "express";
import type { Server } from "http";
import authRouter from "./routes/auth.routes";
import competitionRouter from "./routes/competition.routes";
import matchRouter from "./routes/match.routes";
import teamRouter from "./routes/team.routes";
import referenceRouter from "./routes/reference.routes";
import importRouter from "./routes/import.routes";
import documentRouter from "./routes/document.routes";

// WebSocket сервер — менеджер присутствия и live-события
import { initWsServer } from "./ws/ws-server";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const API_PREFIX = "/api/v1";

  // --- Аутентификация ---
  app.use(`${API_PREFIX}/auth`, authRouter);

  // --- Соревнования ---
  app.use(`${API_PREFIX}/competitions`, competitionRouter);

  // --- Глобальные команды (монтируем ДО matchRouter на корневом пути, иначе /:id перехватывает /teams) ---
  app.use(`${API_PREFIX}/teams`, teamRouter);

  // --- Матчи (два монтирования: /matches и /competitions/:cid/matches) ---
  app.use(`${API_PREFIX}/matches`, matchRouter);
  app.use(`${API_PREFIX}`, matchRouter);

  // --- Справочники ---
  app.use(`${API_PREFIX}/references`, referenceRouter);

  // --- Здоровье сервера (публичный endpoint для проверки) ---
  app.get(`${API_PREFIX}/health`, (_req, res) => {
    res.json({
      success: true,
      data: {
        status: "ok",
        version: "2.0.0",
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      },
    });
  });

  // --- WebSocket сервер ---
  // Монтируется на тот же HTTP порт, путь /ws
  initWsServer(httpServer);

  // --- Импорт статистики (Excel/CSV) ---
  // Монтируется на корень, т.к. пути начинаются с /matches/:id/import/...
  app.use(`${API_PREFIX}`, importRouter);

  // --- Документы / PDF генерация ---
  // Монтируется на /matches, пути внутри: /:id/pdf/protocol и /:id/pdf/summary
  app.use(`${API_PREFIX}/matches`, documentRouter);

  return httpServer;
}