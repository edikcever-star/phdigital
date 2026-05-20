import { QueryClient } from "@tanstack/react-query";

// Определяем базовый URL для API
// В development: относительный путь (Vite проксирует на Express)
// В production: используем __PORT_5000__ для S3 деплоя
declare const __PORT_5000__: string | undefined;
const API_BASE =
  typeof __PORT_5000__ !== "undefined"
    ? __PORT_5000__
    : "";

export { API_BASE };

/**
 * Выполняет запрос к API с обработкой ошибок.
 * Все HTTP запросы должны идти через эту функцию.
 */
export async function apiRequest<T = unknown>(
  method: string,
  url: string,
  data?: unknown
): Promise<T> {
  const fullUrl = `${API_BASE}${url}`;

  const response = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Включаем куки для сессий
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: { message: "Ошибка сети" },
    }));
    throw new Error(
      error?.error?.message || `HTTP ${response.status}: ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Не перезапрашивать при фокусе окна (судейский инструмент)
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      // Не перезапрашивать при ошибке — 401 не должен вызывать retry
      retry: false,
      staleTime: 30_000, // 30 секунд
    },
    mutations: {
      retry: 0,
    },
  },
});
