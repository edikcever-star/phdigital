/**
 * API-ФУНКЦИИ ДЛЯ СПРАВОЧНИКОВ
 *
 * Судьи, карты CS2, типы нарушений.
 * Все запросы идут через apiRequest из queryClient.
 */

import { apiRequest } from "@/lib/queryClient";
import type { Judge, MapRecord, ViolationTypeRecord } from "@shared/schema";

// -------------------------------------------------------
// Обёртки ответа сервера
// -------------------------------------------------------

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ============================================================
// СУДЬИ
// ============================================================

/**
 * Получить список судей.
 * @param onlyActive — если true, возвращает только активных судей (по умолчанию — все)
 */
export async function fetchJudges(onlyActive = false): Promise<Judge[]> {
  const qs = onlyActive ? "" : "?all=true";
  const res = await apiRequest<ApiResponse<Judge[]>>(
    "GET",
    `/api/v1/references/judges${qs}`
  );
  return res.data;
}

/**
 * Создать нового судью.
 */
export async function createJudge(
  data: Omit<Judge, "id" | "createdAt">
): Promise<Judge> {
  const res = await apiRequest<ApiResponse<Judge>>(
    "POST",
    "/api/v1/references/judges",
    data
  );
  return res.data;
}

/**
 * Обновить данные судьи.
 */
export async function updateJudge(
  id: number,
  data: Partial<Omit<Judge, "id" | "createdAt">>
): Promise<Judge> {
  const res = await apiRequest<ApiResponse<Judge>>(
    "PATCH",
    `/api/v1/references/judges/${id}`,
    data
  );
  return res.data;
}

/**
 * Деактивировать судью (мягкое удаление).
 */
export async function deactivateJudge(id: number): Promise<void> {
  await apiRequest("DELETE", `/api/v1/references/judges/${id}`);
}

// ============================================================
// КАРТЫ CS2
// ============================================================

/**
 * Получить список карт.
 * @param onlyActive — если true, возвращает только активные карты
 */
export async function fetchMaps(onlyActive = false): Promise<MapRecord[]> {
  const qs = onlyActive ? "" : "?all=true";
  const res = await apiRequest<ApiResponse<MapRecord[]>>(
    "GET",
    `/api/v1/references/maps${qs}`
  );
  return res.data;
}

/**
 * Создать новую карту.
 */
export async function createMap(
  data: Omit<MapRecord, "id">
): Promise<MapRecord> {
  const res = await apiRequest<ApiResponse<MapRecord>>(
    "POST",
    "/api/v1/references/maps",
    data
  );
  return res.data;
}

/**
 * Обновить данные карты.
 */
export async function updateMap(
  id: number,
  data: Partial<Omit<MapRecord, "id">>
): Promise<MapRecord> {
  const res = await apiRequest<ApiResponse<MapRecord>>(
    "PATCH",
    `/api/v1/references/maps/${id}`,
    data
  );
  return res.data;
}

/**
 * Деактивировать карту (пометить как неактивную).
 */
export async function deactivateMap(id: number): Promise<void> {
  await apiRequest(
    "PATCH",
    `/api/v1/references/maps/${id}`,
    { isActive: false }
  );
}

// ============================================================
// ТИПЫ НАРУШЕНИЙ
// ============================================================

/**
 * Получить список типов нарушений.
 * @param onlyActive — если true, возвращает только активные типы
 */
export async function fetchViolationTypes(
  onlyActive = false
): Promise<ViolationTypeRecord[]> {
  const qs = onlyActive ? "" : "?all=true";
  const res = await apiRequest<ApiResponse<ViolationTypeRecord[]>>(
    "GET",
    `/api/v1/references/violation-types${qs}`
  );
  return res.data;
}

/**
 * Создать новый тип нарушения.
 */
export async function createViolationType(
  data: Omit<ViolationTypeRecord, "id">
): Promise<ViolationTypeRecord> {
  const res = await apiRequest<ApiResponse<ViolationTypeRecord>>(
    "POST",
    "/api/v1/references/violation-types",
    data
  );
  return res.data;
}

/**
 * Обновить тип нарушения.
 */
export async function updateViolationType(
  id: number,
  data: Partial<Omit<ViolationTypeRecord, "id">>
): Promise<ViolationTypeRecord> {
  const res = await apiRequest<ApiResponse<ViolationTypeRecord>>(
    "PATCH",
    `/api/v1/references/violation-types/${id}`,
    data
  );
  return res.data;
}
