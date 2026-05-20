/**
 * ХРАНИЛИЩЕ ДАННЫХ — базовый слой для шаблонной совместимости
 *
 * Этот файл существует для совместимости с шаблоном.
 * Основная бизнес-логика находится в server/services/*.ts
 * с использованием db из server/db/connection.ts.
 */

import type { User } from "@shared/schema";
import db from "./db/connection";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): User | undefined;
}

export class DatabaseStorage implements IStorage {
  getUser(id: number): User | undefined {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
}

export const storage = new DatabaseStorage();
