/**
 * API МОДУЛЯ МАТЧЕЙ
 *
 * Все HTTP запросы к серверу по маршрутам /api/v1/matches/* и /api/v1/competitions/:id/matches.
 * Использует apiRequest из @/lib/queryClient для единообразной обработки ошибок.
 */

import { apiRequest } from "@/lib/queryClient";
import type {
  Match,
  MatchStatusLogEntry,
  MatchTeam,
  CompetitionTeam,
  MatchStatus,
  DigitalSide,
  PhysicalSide,
} from "@shared/schema";
import type { MatchSummaryDTO, MatchSetupDTO, ApiSuccess } from "@shared/contracts/api";

// -------------------------------------------------------
// Вспомогательные типы
// -------------------------------------------------------

/** Данные для создания матча */
export interface CreateMatchData {
  matchNumber?: string;
  stage?: string;
  scheduledAt?: string;
  expectedViewers?: number;
  matchJudges?: number[];
  [key: string]: any; // Позволяем передавать любые дополнительные поля (защита от ошибок TypeScript)
}

/** Данные для обновления матча (все поля опциональны) */
export type UpdateMatchData = Partial<CreateMatchData>;

/** Настройка одной команды при вызове setup-teams */
export interface MatchTeamSetupSlot {
  compTeamId: number;
  digitalStartSide?: DigitalSide;
  physicalStartSide?: PhysicalSide;
}

/** Тело запроса setup-teams */
export interface SetupMatchTeamsData {
  team1: MatchTeamSetupSlot;
  team2: MatchTeamSetupSlot;
  mapId?: number;
  vetoLog?: any[];
  [key: string]: any;
}

/** Запись журнала статусов с именем пользователя */
export interface MatchStatusLogEntryWithUser extends MatchStatusLogEntry {
  changedByName?: string | null;
}

/** Детальная информация о матче — агрегат для страницы настройки */
export interface MatchDetailDTO {
  match: Match;
  teams: Array<MatchTeam & { team: CompetitionTeam }>;
}

// -------------------------------------------------------
// Функции запросов
// -------------------------------------------------------

/**
 * Получить список матчей соревнования.
 * GET /api/v1/competitions/:id/matches
 */
export async function fetchCompetitionMatchesList(
  competitionId: number
): Promise<MatchSummaryDTO[]> {
  const resp = await apiRequest<ApiSuccess<MatchSummaryDTO[]>>(
    "GET",
    `/api/v1/competitions/${competitionId}/matches`
  );
  return resp.data;
}

/**
 * Создать новый матч в соревновании.
 * POST /api/v1/competitions/:id/matches
 */
export async function createMatch(
  competitionId: number,
  data: CreateMatchData
): Promise<Match> {
  const resp = await apiRequest<ApiSuccess<Match>>(
    "POST",
    `/api/v1/competitions/${competitionId}/matches`,
    data
  );
  return resp.data;
}

/**
 * Получить детальную информацию о матче (с командами, раундами, счётом).
 * GET /api/v1/matches/:id
 */
export async function fetchMatch(matchId: number): Promise<MatchSetupDTO> {
  const resp = await apiRequest<ApiSuccess<MatchSetupDTO>>(
    "GET",
    `/api/v1/matches/${matchId}`
  );
  return resp.data;
}

/**
 * Обновить данные матча.
 * PATCH /api/v1/matches/:id
 */
export async function updateMatch(
  matchId: number,
  data: UpdateMatchData
): Promise<Match> {
  const resp = await apiRequest<ApiSuccess<Match>>(
    "PATCH",
    `/api/v1/matches/${matchId}`,
    data
  );
  return resp.data;
}

/**
 * Настроить команды матча (slot 1 и slot 2).
 * POST /api/v1/matches/:id/setup-teams
 * Тело: { team1: { compTeamId, digitalStartSide, physicalStartSide }, team2: {...} }
 */
export async function setupMatchTeams(
  matchId: number,
  data: SetupMatchTeamsData
): Promise<MatchSetupDTO> {
  const resp = await apiRequest<ApiSuccess<MatchSetupDTO>>(
    "POST",
    `/api/v1/matches/${matchId}/setup-teams`,
    data
  );
  return resp.data;
}

/**
 * Сменить статус матча.
 * POST /api/v1/matches/:id/transition
 * Тело: { targetStatus }
 */
export async function transitionMatchStatus(
  matchId: number,
  targetStatus: MatchStatus
): Promise<Match> {
  // Мы явно указываем тип возвращаемого значения: ApiSuccess<Match>
  const resp = await apiRequest<ApiSuccess<Match>>(
    "POST",
    `/api/v1/matches/${matchId}/transition`,
    { targetStatus }
  );
  return resp.data;
}

/**
 * Получить журнал смены статусов матча.
 * GET /api/v1/matches/:id/status-log
 */
export async function fetchMatchStatusLog(
  matchId: number
): Promise<MatchStatusLogEntryWithUser[]> {
  const resp = await apiRequest<ApiSuccess<MatchStatusLogEntryWithUser[]>>(
    "GET",
    `/api/v1/matches/${matchId}/status-log`
  );
  return resp.data;
}
