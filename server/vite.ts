import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

// Логгер Vite для красивого вывода ошибок в консоль
const viteLogger = createLogger();

/**
 * Подключение Vite к Express в middleware mode.
 *
 * ВАЖНО:
 * - здесь НЕ задаём hmr: { server, path: "/vite-hmr" }
 * - иначе браузер будет стучаться в ws://localhost:5000/vite-hmr
 *   и получать 400 / конфликт сокетов
 */
export async function setupVite(_server: Server, app: Express) {
  // Создаём встроенный Vite-сервер для Express
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,

    // Переопределяем logger, чтобы при критической ошибке
    // процесс завершался сразу и не висел в полурабочем состоянии
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },

    // Запуск Vite как middleware внутри Express
    server: {
      middlewareMode: true,
      allowedHosts: true,
    },

    // Мы сами отдаём HTML через Express
    appType: "custom",
  });

  // Подключаем Vite middlewares
  app.use(vite.middlewares);

  // Для всех не-API маршрутов возвращаем index.html
  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      // Путь к client/index.html
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // Каждый раз читаем index.html заново с диска,
      // чтобы изменения подхватывались без ручной пересборки
      let template = await fs.promises.readFile(clientTemplate, "utf-8");

      // Добавляем случайный query-параметр к main.tsx,
      // чтобы браузер не держал старую версию в кэше
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      // Даём Vite преобразовать HTML
      const page = await vite.transformIndexHtml(url, template);

      // Отдаём готовую страницу
      res
        .status(200)
        .set({ "Content-Type": "text/html" })
        .end(page);
    } catch (e) {
      // Чиним stacktrace, чтобы ошибки в консоли были читаемыми
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}