/**
 * СЕРВИС АУТЕНТИФИКАЦИИ
 *
 * Управляет входом/выходом пользователей.
 * Сессии хранятся на сервере в SQLite (connect-better-sqlite3).
 * После обновления страницы пользователь остаётся залогиненным.
 *
 * PIN-проверка использует простое sha256 хеширование
 * (bcrypt не нужен на локальном сервере без интернета).
 */

import { createHash } from "crypto";
import db from "../db/connection";
import { users } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import type { AuthUser } from "../../shared/contracts/api";
import type { UserRole } from "../../shared/schema";

/**
 * Хеширует PIN-код для хранения в БД.
 * Используем sha256 — достаточно для локальной системы.
 */
export function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

/**
 * Находит или создаёт пользователя по имени и роли.
 * Проверяет PIN если он задан.
 *
 * Логика входа:
 * 1. Ищем пользователя по displayName + role
 * 2. Если пользователь не найден — создаём (первый вход)
 * 3. Если есть PIN — проверяем
 * 4. Возвращаем AuthUser для записи в сессию
 */
export async function loginUser(params: {
  displayName: string;
  role: UserRole;
  pin?: string;
}): Promise<AuthUser | null> {
  const { displayName, role, pin } = params;

  // Ищем существующего пользователя
  let user = db
    .select()
    .from(users)
    .where(
      and(
        eq(users.displayName, displayName),
        eq(users.role, role),
        eq(users.isActive, true)
      )
    )
    .get();

  if (!user) {
    // Новый пользователь — создаём запись
    user = db
      .insert(users)
      .values({
        displayName,
        role,
        pinHash: pin ? hashPin(pin) : null,
        isActive: true,
      })
      .returning()
      .get();
  }

  if (!user) return null;

  // Проверяем PIN если он задан у пользователя
  if (user.pinHash && pin) {
    const inputHash = hashPin(pin);
    if (inputHash !== user.pinHash) {
      return null; // Неверный PIN
    }
  } else if (user.pinHash && !pin) {
    // PIN требуется, но не введён
    return null;
  }

  return {
    id: user.id,
    displayName: user.displayName,
    role: user.role as UserRole,
  };
}

/**
 * Получает список всех активных пользователей для экрана выбора.
 */
export function getAllUsers() {
  return db
    .select({
      id: users.id,
      displayName: users.displayName,
      role: users.role,
      hasPin: users.pinHash,
    })
    .from(users)
    .where(eq(users.isActive, true))
    .all()
    .map((u) => ({
      id: u.id,
      displayName: u.displayName,
      role: u.role as UserRole,
      requiresPin: !!u.hasPin,
    }));
}

/**
 * Создаёт нового пользователя.
 * Доступно только для admin-ролей.
 */
export function createUser(params: {
  displayName: string;
  role: UserRole;
  pin?: string;
}) {
  const { displayName, role, pin } = params;
  return db
    .insert(users)
    .values({
      displayName,
      role,
      pinHash: pin ? hashPin(pin) : null,
      isActive: true,
    })
    .returning()
    .get();
}

/**
 * Обновляет пользователя.
 */
export function updateUser(
  id: number,
  params: Partial<{
    displayName: string;
    role: UserRole;
    pin: string | null;
    isActive: boolean;
  }>
) {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (params.displayName !== undefined) updateData.displayName = params.displayName;
  if (params.role !== undefined) updateData.role = params.role;
  if (params.isActive !== undefined) updateData.isActive = params.isActive;
  if (params.pin !== undefined) {
    updateData.pinHash = params.pin ? hashPin(params.pin) : null;
  }

  return db
    .update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning()
    .get();
}
