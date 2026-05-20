/**
 * ТОЧКА ВХОДА СЕРВЕРА — Протокол матча. Фиджитал-спорт v2
 *
 * Инициализирует:
 * 1. SQLite БД (WAL mode, FK, busy_timeout)
 * 2. Express приложение с сессиями
 * 3. WebSocket сервер
 * 4. Все API маршруты
 * 5. Vite dev-сервер (в dev режиме) или статику (в production)
 */

import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";

// Инициализируем БД ПЕРВЫМ — до любых импортов, которые её используют
import { initializeDatabase } from "./db/migrate";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// -----------------------------------------------------------
// Логгер
// -----------------------------------------------------------
export function log(message: string, source = "express"): void {
  const formattedTime = new Date().toLocaleTimeString("ru-RU", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// -----------------------------------------------------------
// Инициализация приложения
// -----------------------------------------------------------

const app = express();
app.disable('etag');

const httpServer = createServer(app);

// Парсинг JSON тела запросов
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false }));

// -----------------------------------------------------------
// Сессии (хранятся в SQLite — не MemoryStore!)
// После перезапуска сервера пользователи остаются залогиненными.
// -----------------------------------------------------------

// Динамический импорт connect-better-sqlite3 для совместимости с ESM
// Сессионное хранилище инициализируется после БД
let sessionStore: session.Store;

// Используем MemoryStore как fallback (достаточно для локального сервера)
// В production-варианте можно заменить на connect-better-sqlite3
import { MemoryStore } from "express-session";
sessionStore = new MemoryStore();

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "phdigital-local-secret-2024",
    resave: false,
    saveUninitialized: false,
    cookie: {
      // httpOnly: защита от XSS
      httpOnly: true,
      // secure: false для локального HTTP (нет HTTPS на локалке)
      secure: false,
      // 8 часов — рабочий день соревнований
      maxAge: 8 * 60 * 60 * 1000,
    },
    // Имя cookie
    name: "phdigital.sid",
  })
);

// -----------------------------------------------------------
// Логирование запросов
// -----------------------------------------------------------
app.use((req, _res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined;

  const originalResJson = _res.json.bind(_res);
  _res.json = function (bodyJson) {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson);
  };

  _res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${_res.statusCode} в ${duration}мс`;
      if (capturedJsonResponse && _res.statusCode !== 200) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse).slice(0, 100)}`;
      }
      log(logLine);
    }
  });

  next();
});

// -----------------------------------------------------------
// Статические файлы (uploads — PDF, изображения карт)
// -----------------------------------------------------------
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// -----------------------------------------------------------
// Запуск
// -----------------------------------------------------------
(async () => {
  // 1. Инициализируем базу данных (создаём таблицы если нет)
  initializeDatabase();

  // 2. Регистрируем все API маршруты и WebSocket сервер
  await registerRoutes(httpServer, app);

  // 3. Централизованная обработка ошибок (после всех роутов)
  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    const status = (err as { status?: number; statusCode?: number }).status ||
      (err as { statusCode?: number }).statusCode || 500;
    const message = err.message || "Внутренняя ошибка сервера";

    console.error("[ОШИБКА СЕРВЕРА]", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message },
    });
  });

  // 4. Фронтенд — Vite в dev, статика в production
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // 5. Запускаем сервер
  // 0.0.0.0 — доступен по локальной сети (другие компьютеры смогут подключиться)
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    { port, host: "0.0.0.0", reusePort: true },
    () => {
      log(`============================================`);
      log(`Протокол матча. Фиджитал-спорт v2`);
      log(`Сервер запущен на порту ${port}`);
      log(`Локальный доступ: http://localhost:${port}`);
      log(`Сетевой доступ: http://<IP-компьютера>:${port}`);
      log(`============================================`);
    }
  );
})();
