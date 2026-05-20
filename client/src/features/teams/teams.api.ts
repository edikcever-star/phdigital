/**
 * API МОДУЛЯ ГЛОБАЛЬНЫХ КОМАНД
 *
 * Все HTTP запросы к серверу по маршрутам /api/v1/teams/*.
 * Использует apiRequest из @/lib/queryClient для единообразной обработки ошибок.
 */

import { apiRequest } from "@/lib/queryClient";
import type {
  GlobalTeam,
  GlobalTeamPlayer,
  GlobalTeamOfficial,
} from "@shared/schema";
import type { GlobalTeamWithRoster } from "@shared/contracts/api";

// -------------------------------------------------------
// Вспомогательные обёртки ответов
// -------------------------------------------------------

interface ApiSuccess<T> {
  success: true;
  data: T;
}

// -------------------------------------------------------
// Данные для создания / обновления команды
// -------------------------------------------------------

/** Данные для создания новой команды */
export interface CreateTeamData {
  name: string;
  region?: string;
  notes?: string;
}

/** Данные для обновления команды (все поля опциональны) */
export type UpdateTeamData = Partial<CreateTeamData>;

// -------------------------------------------------------
// Данные для игроков команды
// -------------------------------------------------------

/** Данные для добавления/обновления игрока */
export interface PlayerData {
  fullName: string;
  number?: number;
  position?: string;
  isReserve?: boolean;
  notes?: string;
}

/** Данные для обновления игрока (все поля опциональны) */
export type UpdatePlayerData = Partial<PlayerData>;

// -------------------------------------------------------
// Данные для официальных лиц
// -------------------------------------------------------

/** Данные для добавления/обновления официального лица */
export interface OfficialData {
  fullName: string;
  role: string;
}

/** Данные для обновления официального лица (все поля опциональны) */
export type UpdateOfficialData = Partial<OfficialData>;

// -------------------------------------------------------
// Функции запросов — Команды
// -------------------------------------------------------

/**
 * Получить список всех (не архивных) глобальных команд.
 */
export async function fetchTeams(): Promise<GlobalTeam[]> {
  const resp = await apiRequest<ApiSuccess<GlobalTeam[]>>(
    "GET",
    "/api/v1/teams"
  );
  return resp.data;
}

/**
 * Получить детали команды вместе с игроками и официальными лицами.
 */
export async function fetchTeam(id: number): Promise<GlobalTeamWithRoster> {
  const resp = await apiRequest<ApiSuccess<GlobalTeamWithRoster>>(
    "GET",
    `/api/v1/teams/${id}`
  );
  return resp.data;
}

/**
 * Создать новую глобальную команду.
 */
export async function createTeam(data: CreateTeamData): Promise<GlobalTeam> {
  const resp = await apiRequest<ApiSuccess<GlobalTeam>>(
    "POST",
    "/api/v1/teams",
    data
  );
  return resp.data;
}

/**
 * Обновить данные команды по ID.
 */
export async function updateTeam(
  id: number,
  data: UpdateTeamData
): Promise<GlobalTeam> {
  const resp = await apiRequest<ApiSuccess<GlobalTeam>>(
    "PATCH",
    `/api/v1/teams/${id}`,
    data
  );
  return resp.data;
}

/**
 * Удалить (архивировать) команду по ID.
 */
export async function deleteTeam(id: number): Promise<GlobalTeam> {
  const resp = await apiRequest<ApiSuccess<GlobalTeam>>(
    "DELETE",
    `/api/v1/teams/${id}`
  );
  return resp.data;
}

// -------------------------------------------------------
// Функции запросов — Игроки
// -------------------------------------------------------

/**
 * Получить список игроков команды.
 */
export async function fetchTeamPlayers(
  teamId: number
): Promise<GlobalTeamPlayer[]> {
  const team = await fetchTeam(teamId);
  return team.players;
}

/**
 * Добавить игрока в команду.
 */
export async function addPlayer(
  teamId: number,
  data: PlayerData
): Promise<GlobalTeamPlayer> {
  const resp = await apiRequest<ApiSuccess<GlobalTeamPlayer>>(
    "POST",
    `/api/v1/teams/${teamId}/players`,
    data
  );
  return resp.data;
}

/**
 * Обновить данные игрока.
 */
export async function updatePlayer(
  teamId: number,
  playerId: number,
  data: UpdatePlayerData
): Promise<GlobalTeamPlayer> {
  const resp = await apiRequest<ApiSuccess<GlobalTeamPlayer>>(
    "PATCH",
    `/api/v1/teams/${teamId}/players/${playerId}`,
    data
  );
  return resp.data;
}

/**
 * Удалить игрока из команды.
 */
export async function deletePlayer(
  teamId: number,
  playerId: number
): Promise<void> {
  await apiRequest(
    "DELETE",
    `/api/v1/teams/${teamId}/players/${playerId}`
  );
}

// -------------------------------------------------------
// Функции запросов — Официальные лица
// -------------------------------------------------------

/**
 * Получить список официальных лиц команды.
 */
export async function fetchTeamOfficials(
  teamId: number
): Promise<GlobalTeamOfficial[]> {
  const team = await fetchTeam(teamId);
  return team.officials;
}

/**
 * Добавить официальное лицо в команду.
 */
export async function addOfficial(
  teamId: number,
  data: OfficialData
): Promise<GlobalTeamOfficial> {
  const resp = await apiRequest<ApiSuccess<GlobalTeamOfficial>>(
    "POST",
    `/api/v1/teams/${teamId}/officials`,
    data
  );
  return resp.data;
}

/**
 * Обновить данные официального лица.
 */
export async function updateOfficial(
  teamId: number,
  officialId: number,
  data: UpdateOfficialData
): Promise<GlobalTeamOfficial> {
  const resp = await apiRequest<ApiSuccess<GlobalTeamOfficial>>(
    "PATCH",
    `/api/v1/teams/${teamId}/officials/${officialId}`,
    data
  );
  return resp.data;
}

/**
 * Удалить официальное лицо из команды.
 */
export async function deleteOfficial(
  teamId: number,
  officialId: number
): Promise<void> {
  await apiRequest(
    "DELETE",
    `/api/v1/teams/${teamId}/officials/${officialId}`
  );
}
