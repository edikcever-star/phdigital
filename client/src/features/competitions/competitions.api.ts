/**
 * API МОДУЛЯ СОРЕВНОВАНИЙ
 *
 * Все HTTP запросы к серверу по маршрутам /api/v1/competitions/*.
 * Использует apiRequest из @/lib/queryClient для единообразной обработки ошибок.
 */

import { apiRequest } from "@/lib/queryClient";
import type {
  Competition,
  CompetitionSettings,
  CompetitionTeam,
  CompetitionStaff,
  Judge,
  Match,
  GlobalTeam,
} from "@shared/schema";

// -------------------------------------------------------
// Вспомогательные типы ответов
// -------------------------------------------------------

/** Соревнование со статистикой (возвращается сервером при GET /competitions) */
export interface CompetitionWithStats extends Competition {
  settings: CompetitionSettings | null;
  teamsCount: number;
  matchesCount: number;
}

/** Персонал соревнования с данными судьи */
export interface CompetitionStaffWithJudge extends CompetitionStaff {
  judge: Judge;
}

/** Команда соревнования с ростером */
export interface CompetitionTeamWithRoster extends CompetitionTeam {
  players: Array<{
    id: number;
    compTeamId: number;
    fullName: string;
    number: number | null;
    position: string | null;
    isReserve: boolean;
    globalPlayerId: number | null;
  }>;
  officials: Array<{
    id: number;
    compTeamId: number;
    fullName: string;
    role: string;
  }>;
}

/** Краткая информация о матче для списка */
export interface MatchSummary {
  id: number;
  competitionId: number;
  matchNumber: string | null;
  stage: string | null;
  scheduledAt: string | null;
  status: Match["status"];
  team1: { id: number; name: string } | null;
  team2: { id: number; name: string } | null;
  scoreTotalTeam1: number | null;
  scoreTotalTeam2: number | null;
  winnerTeamId: number | null;
}

/** Данные для создания соревнования */
export interface CreateCompetitionData {
  name: string;
  startDate: string;
  endDate: string;
  venue?: string;
  format?: Competition["format"];
  status?: Competition["status"];
  plannedParticipants?: number; // Добавлено поле для количества участников
}

/** Данные для обновления соревнования (все поля опциональны) */
export type UpdateCompetitionData = Partial<CreateCompetitionData>;

/** Данные для добавления команды */
export interface AddTeamData {
  name: string;
  globalTeamId?: number;
  region?: string;
  copyFromGlobal?: boolean;
}

/** Данные для добавления персонала */
export interface AddStaffData {
  judgeId: number;
  staffRole: string;
}

/** Глобальная команда для выбора в диалоге */
export type GlobalTeamOption = GlobalTeam;

// -------------------------------------------------------
// Обёртки для API-ответов
// -------------------------------------------------------

interface ApiSuccess<T> {
  success: true;
  data: T;
}




// -------------------------------------------------------
// Функции запросов
// -------------------------------------------------------

/**
 * Получить список всех соревнований.
 */
export async function fetchCompetitions(): Promise<CompetitionWithStats[]> {
  const resp = await apiRequest<ApiSuccess<CompetitionWithStats[]>>(
    "GET",
    "/api/v1/competitions"
  );
  return resp.data;
}

/**
 * Получить детали соревнования по ID.
 */
export async function fetchCompetition(
  id: number
): Promise<CompetitionWithStats> {
  const resp = await apiRequest<ApiSuccess<CompetitionWithStats>>(
    "GET",
    `/api/v1/competitions/${id}`
  );
  return resp.data;
}

/**
 * Создать новое соревнование.
 */
export async function createCompetition(
  data: CreateCompetitionData
): Promise<Competition> {
  const resp = await apiRequest<ApiSuccess<Competition>>(
    "POST",
    "/api/v1/competitions",
    data
  );
  return resp.data;
}

/**
 * Обновить данные соревнования.
 */
export async function updateCompetition(
  id: number,
  data: UpdateCompetitionData
): Promise<Competition> {
  const resp = await apiRequest<ApiSuccess<Competition>>(
    "PATCH",
    `/api/v1/competitions/${id}`,
    data
  );
  return resp.data;
}

/**
 * Получить настройки соревнования.
 */
export async function fetchCompetitionSettings(
  id: number
): Promise<CompetitionSettings | null> {
  const resp = await apiRequest<ApiSuccess<CompetitionSettings | null>>(
    "GET",
    `/api/v1/competitions/${id}/settings`
  );
  return resp.data;
}

/**
 * Обновить настройки соревнования.
 */
export async function updateCompetitionSettings(
  id: number,
  data: Partial<Omit<CompetitionSettings, "id" | "competitionId">>
): Promise<CompetitionSettings> {
  const resp = await apiRequest<ApiSuccess<CompetitionSettings>>(
    "PATCH",
    `/api/v1/competitions/${id}/settings`,
    data
  );
  return resp.data;
}

/**
 * Получить команды соревнования с ростерами.
 */
export async function fetchCompetitionTeams(
  id: number
): Promise<CompetitionTeamWithRoster[]> {
  const resp = await apiRequest<ApiSuccess<CompetitionTeamWithRoster[]>>(
    "GET",
    `/api/v1/competitions/${id}/teams`
  );
  return resp.data;
}

/**
 * Добавить команду в соревнование.
 */
export async function addTeamToCompetition(
  id: number,
  data: AddTeamData
): Promise<CompetitionTeam> {
  const resp = await apiRequest<ApiSuccess<CompetitionTeam>>(
    "POST",
    `/api/v1/competitions/${id}/teams`,
    data
  );
  return resp.data;
}

/**
 * Удалить команду из соревнования.
 */
export async function removeTeamFromCompetition(
  competitionId: number,
  teamId: number
): Promise<void> {
  await apiRequest(
    "DELETE",
    `/api/v1/competitions/${competitionId}/teams/${teamId}`
  );
}

/**
 * Получить персонал (судейскую бригаду) соревнования.
 */
export async function fetchCompetitionStaff(
  id: number
): Promise<CompetitionStaffWithJudge[]> {
  const resp = await apiRequest<ApiSuccess<CompetitionStaffWithJudge[]>>(
    "GET",
    `/api/v1/competitions/${id}/staff`
  );
  return resp.data;
}

/**
 * Добавить судью в бригаду соревнования.
 */
export async function addStaffToCompetition(
  id: number,
  data: AddStaffData
): Promise<CompetitionStaff> {
  const resp = await apiRequest<ApiSuccess<CompetitionStaff>>(
    "POST",
    `/api/v1/competitions/${id}/staff`,
    data
  );
  return resp.data;
}

/**
 * Удалить персонал из соревнования.
 */
export async function removeStaffFromCompetition(
  competitionId: number,
  staffId: number
): Promise<void> {
  await apiRequest(
    "DELETE",
    `/api/v1/competitions/${competitionId}/staff/${staffId}`
  );
}

/**
 * Получить матчи соревнования.
 */
export async function fetchCompetitionMatches(
  id: number
): Promise<MatchSummary[]> {
  const resp = await apiRequest<ApiSuccess<MatchSummary[]>>(
    "GET",
    `/api/v1/competitions/${id}/matches`
  );
  return resp.data;
}

/**
 * Получить список глобальных команд (для диалога добавления).
 */
export async function fetchGlobalTeams(): Promise<GlobalTeam[]> {
  const resp = await apiRequest<ApiSuccess<GlobalTeam[]>>(
    "GET",
    "/api/v1/teams"
  );
  return resp.data;
}

export async function addTeamPlayer(competitionId: number, teamId: number, data: { fullName: string; number?: number; position?: string; isReserve?: boolean }) {
  const res = await apiRequest<{ success: boolean; data: any }>("POST", `/api/v1/competitions/${competitionId}/teams/${teamId}/players`, data);
  return res.data;
}

export async function removeTeamPlayer(competitionId: number, teamId: number, playerId: number) {
  await apiRequest("DELETE", `/api/v1/competitions/${competitionId}/teams/${teamId}/players/${playerId}`);
}

export async function addTeamOfficial(competitionId: number, teamId: number, data: { fullName: string; role: string }) {
  const res = await apiRequest<{ success: boolean; data: any }>("POST", `/api/v1/competitions/${competitionId}/teams/${teamId}/officials`, data);
  return res.data;
}

export async function removeTeamOfficial(competitionId: number, teamId: number, officialId: number) {
  await apiRequest("DELETE", `/api/v1/competitions/${competitionId}/teams/${teamId}/officials/${officialId}`);
}

export async function setPlayerCaptain(competitionId: number, teamId: number, playerId: number, isCaptain: boolean) {
  await apiRequest("PATCH", `/api/v1/competitions/${competitionId}/teams/${teamId}/players/${playerId}/captain`, { isCaptain });
}

/**
/**
 * Сгенерировать турнирную сетку (автоматическое создание матчей).
 */
export async function generateCompetitionBracket(id: number) {
  const response = await apiRequest<{ success: boolean; data: any[] }>(
    "POST", 
    `/api/v1/competitions/${id}/generate-bracket`
  );
  return response.data;
}