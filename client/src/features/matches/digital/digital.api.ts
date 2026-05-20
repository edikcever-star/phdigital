/**
 * API-ФУНКЦИИ ЦИФРОВОГО ЭТАПА
 *
 * Обёртки над REST-эндпоинтами для работы с раундами цифрового этапа.
 * Используют apiRequest из lib/queryClient — единая точка HTTP-запросов.
 */

import { apiRequest } from "@/lib/queryClient";
import type {
  ApiSuccess,
  DigitalPhaseDTO,
  UpsertDigitalRoundRequest,
} from "@shared/contracts/api";
import type { DigitalRound } from "@shared/schema";

/**
 * Загружает все раунды цифрового этапа для матча.
 *
 * @param matchId — ID матча
 * @returns DigitalPhaseDTO с раундами, статистикой команд и состоянием тайма
 */
export async function fetchDigitalRounds(
  matchId: number
): Promise<DigitalPhaseDTO> {
  const response = await apiRequest<ApiSuccess<DigitalPhaseDTO>>(
    "GET",
    `/api/v1/matches/${matchId}/digital-rounds`
  );
  return response.data;
}

/**
 * Обновляет данные одного раунда.
 *
 * @param matchId — ID матча
 * @param roundId — ID раунда
 * @param data — Данные для обновления
 * @returns Обновлённый DigitalRound
 */
export async function updateDigitalRound(
  matchId: number,
  roundId: number,
  data: UpsertDigitalRoundRequest
): Promise<DigitalRound> {
  const response = await apiRequest<ApiSuccess<DigitalRound>>(
    "PATCH",
    `/api/v1/matches/${matchId}/digital-rounds/${roundId}`,
    data
  );
  return response.data;
}

export async function assignDigitalSides(matchId: number, team1Side: "T" | "CT") {
  const res = await fetch(`/api/v1/matches/${matchId}/digital-rounds/init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ team1Side }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Не удалось назначить стороны: ${errorText}`);
  }

  const json = await res.json();
  // В зависимости от того, как отвечает твой бекенд, 
  // тут может быть return json; или return json.data;
  return json; 
}