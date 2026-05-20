/**
 * API МОДУЛЯ НАРУШЕНИЙ И ЗАМЕН
 *
 * Запросы к серверу по маршрутам:
 *   GET/POST/DELETE /api/v1/matches/:id/violations
 *   GET/POST        /api/v1/matches/:id/substitutions
 *   GET             /api/v1/references/violation-types
 */

import { apiRequest } from "@/lib/queryClient";
import type {
  MatchViolation,
  InsertMatchViolation,
  MatchSubstitution,
  InsertMatchSubstitution,
  ViolationTypeRecord,
} from "@shared/schema";
import type { ApiSuccess } from "@shared/contracts/api";

// -------------------------------------------------------
// Нарушения
// -------------------------------------------------------

/**
 * Загрузить список нарушений матча.
 * GET /api/v1/matches/:matchId/violations
 */
export async function fetchViolations(matchId: number): Promise<MatchViolation[]> {
  const resp = await apiRequest<ApiSuccess<MatchViolation[]>>(
    "GET",
    `/api/v1/matches/${matchId}/violations`
  );
  return resp.data;
}

/**
 * Зарегистрировать нарушение.
 * POST /api/v1/matches/:matchId/violations
 */
export async function registerViolation(
  matchId: number,
  data: Omit<InsertMatchViolation, "matchId">
): Promise<MatchViolation> {
  const resp = await apiRequest<ApiSuccess<MatchViolation>>(
    "POST",
    `/api/v1/matches/${matchId}/violations`,
    data
  );
  return resp.data;
}

/**
 * Удалить нарушение.
 * DELETE /api/v1/matches/:matchId/violations/:violationId
 */
export async function deleteViolation(
  matchId: number,
  violationId: number
): Promise<void> {
  await apiRequest<ApiSuccess<void>>(
    "DELETE",
    `/api/v1/matches/${matchId}/violations/${violationId}`
  );
}

// -------------------------------------------------------
// Замены
// -------------------------------------------------------

/**
 * Загрузить список замен матча.
 * GET /api/v1/matches/:matchId/substitutions
 */
export async function fetchSubstitutions(matchId: number): Promise<MatchSubstitution[]> {
  const resp = await apiRequest<ApiSuccess<MatchSubstitution[]>>(
    "GET",
    `/api/v1/matches/${matchId}/substitutions`
  );
  return resp.data;
}

/**
 * Зарегистрировать замену.
 * POST /api/v1/matches/:matchId/substitutions
 */
export async function registerSubstitution(
  matchId: number,
  data: Omit<InsertMatchSubstitution, "matchId">
): Promise<MatchSubstitution> {
  const resp = await apiRequest<ApiSuccess<MatchSubstitution>>(
    "POST",
    `/api/v1/matches/${matchId}/substitutions`,
    data
  );
  return resp.data;
}

// -------------------------------------------------------
// Справочник типов нарушений
// -------------------------------------------------------

/**
 * Загрузить справочник типов нарушений.
 * GET /api/v1/references/violation-types
 */
export async function fetchViolationTypes(): Promise<ViolationTypeRecord[]> {
  const resp = await apiRequest<ApiSuccess<ViolationTypeRecord[]>>(
    "GET",
    "/api/v1/references/violation-types"
  );
  return resp.data;
}
