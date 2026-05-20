/**
 * API-ФУНКЦИИ ФИЗИЧЕСКОГО ЭТАПА
 *
 * Обёртки над REST-эндпоинтами для работы с раундами физического этапа.
 * Используют apiRequest из lib/queryClient — единая точка HTTP-запросов.
 */

import { apiRequest } from "@/lib/queryClient";
import type { UpsertPhysicalRoundRequest } from "@shared/contracts/api";
import type { PhysicalRound } from "@shared/schema";

/**
 * Обёртка ответа от GET /api/v1/matches/:id/physical-rounds
 * Сервер возвращает массив раундов, отсортированный по номеру
 */
interface PhysicalRoundsResponse {
  success: boolean;
  data: PhysicalRound[];
}

/**
 * Обёртка ответа от PATCH /api/v1/matches/:id/physical-rounds/:rid
 */
interface UpdatePhysicalRoundResponse {
  success: boolean;
  data: PhysicalRound;
}

/**
 * Загружает все раунды физического этапа для матча.
 *
 * @param matchId — ID матча
 * @returns Массив PhysicalRound, отсортированный по roundNumber
 */
export async function fetchPhysicalRounds(matchId: number): Promise<PhysicalRound[]> {
  const response = await apiRequest<PhysicalRoundsResponse>(
    "GET",
    `/api/v1/matches/${matchId}/physical-rounds`
  );
  return response.data;
}

/**
 * Обновляет данные одного раунда физического этапа.
 *
 * ВАЖНО: penaltyPoints — отдельное поле штрафов.
 * Никогда не смешивать с fragsTeam1/fragsTeam2.
 *
 * @param matchId  — ID матча
 * @param roundId  — ID раунда (PK в таблице physical_rounds)
 * @param data     — Данные для обновления (частичный объект)
 * @returns Обновлённый PhysicalRound
 */
export async function updatePhysicalRound(
  matchId: number,
  roundId: number,
  data: UpsertPhysicalRoundRequest
): Promise<PhysicalRound> {
  const response = await apiRequest<UpdatePhysicalRoundResponse>(
    "PATCH",
    `/api/v1/matches/${matchId}/physical-rounds/${roundId}`,
    data
  );
  return response.data;
}

export async function assignPhysicalSides(matchId: number, team1Side: "attack" | "defense") {
  // Добавляем "as any", чтобы TS не ругался на тип resp
  const resp = (await apiRequest("POST", `/api/v1/matches/${matchId}/physical-sides`, { team1Side })) as any;
  return resp.data;
}