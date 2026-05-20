/**
 * ЦЕНТРАЛИЗОВАННАЯ ОБРАБОТКА ОШИБОК
 *
 * Express error middleware — последний в цепочке.
 * Перехватывает все необработанные ошибки и форматирует ответ.
 */

import type { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Непредвиденная ошибка
  console.error("[ERROR]", err);
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера.",
    },
  });
}

// Вспомогательные фабрики ошибок
export const Errors = {
  notFound: (entity: string) =>
    new AppError(404, "NOT_FOUND", `${entity} не найден(а).`),

  forbidden: (message = "Доступ запрещён.") =>
    new AppError(403, "FORBIDDEN", message),

  badRequest: (message: string, details?: unknown) =>
    new AppError(400, "BAD_REQUEST", message, details),

  conflict: (message: string) =>
    new AppError(409, "CONFLICT", message),

  matchReadOnly: () =>
    new AppError(
      409,
      "MATCH_READ_ONLY",
      "Матч завершён или заблокирован. Изменения невозможны."
    ),

  invalidTransition: (from: string, to: string) =>
    new AppError(
      409,
      "INVALID_STATUS_TRANSITION",
      `Переход из статуса "${from}" в "${to}" недопустим.`
    ),
};
