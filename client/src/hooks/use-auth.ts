/**
 * ХУК АУТЕНТИФИКАЦИИ
 *
 * Управляет состоянием авторизации пользователя.
 * Данные сессии запрашиваются с сервера при каждой загрузке — не из localStorage.
 * После обновления страницы пользователь остаётся залогиненным.
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { AuthUser, LoginRequest } from "@shared/contracts/api";

interface MeResponse {
  success: boolean;
  data: AuthUser;
}

interface LoginResponse {
  success: boolean;
  data: { user: AuthUser; message: string };
}

interface UsersListResponse {
  success: boolean;
  data: Array<{
    id: number;
    displayName: string;
    role: AuthUser["role"];
    requiresPin: boolean;
  }>;
}

/**
 * Основной хук аутентификации.
 * Возвращает текущего пользователя и методы входа/выхода.
 *
 * ВАЖНО: queryFn никогда не бросает ошибку для 401 — возвращает null.
 * Это предотвращает бесконечный цикл рефетча при незалогиненном пользователе:
 * query всегда резолвится успешно (с data=null), isLoading сразу становится false.
 */
export function useAuth() {
  // Проверяем сессию при загрузке
  const {
    data: meData,
    isLoading,
    isError,
  } = useQuery<MeResponse | null>({
    queryKey: ["/api/v1/auth/me"],
    queryFn: async () => {
      try {
        return await apiRequest<MeResponse>("GET", "/api/v1/auth/me");
      } catch {
        // 401 = не авторизован, это нормально — не ошибка
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 минут кеш
    gcTime: 5 * 60 * 1000,    // не удалять из кеша
  });

  const user = meData?.success ? meData.data : null;
  const isAuthenticated = !!user;

  // Мутация входа
  const loginMutation = useMutation({
    mutationFn: (data: LoginRequest) =>
      apiRequest<LoginResponse>("POST", "/api/v1/auth/login", data),
    onSuccess: () => {
      // Инвалидируем кеш /me — перечитаем пользователя
      queryClient.invalidateQueries({ queryKey: ["/api/v1/auth/me"] });
    },
  });

  // Мутация выхода
  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/v1/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
    },
  });

  return {
    user,
    isAuthenticated,
    isLoading,
    isError,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    loginError: loginMutation.error?.message,
  };
}

/**
 * Хук для получения списка пользователей (экран выбора при входе).
 */
export function useUsersList() {
  return useQuery<UsersListResponse>({
    queryKey: ["/api/v1/auth/users"],
    queryFn: () => apiRequest<UsersListResponse>("GET", "/api/v1/auth/users"),
    staleTime: 60_000,
  });
}
