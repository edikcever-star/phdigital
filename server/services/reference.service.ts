/**
 * СЕРВИС СПРАВОЧНИКОВ
 *
 * Глобальные справочники: судьи, карты (CS2), типы нарушений.
 * Эти данные не привязаны к конкретному соревнованию.
 */

import db from "../db/connection";
import {
  judges,
  maps,
  violationTypes,
  type Judge,
  type MapRecord,
  type ViolationTypeRecord,
  type InsertJudge,
  type InsertMap,
  type InsertViolationType,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { Errors } from "../middleware/error.middleware";

// -------------------------------------------------------
// Судьи
// -------------------------------------------------------

export function getAllJudges(onlyActive = true): Judge[] {
  const all = db.select().from(judges).orderBy(judges.fullName).all();
  if (onlyActive) return all.filter((j) => j.isActive);
  return all;
}

export function getJudgeById(id: number): Judge {
  const judge = db.select().from(judges).where(eq(judges.id, id)).get();
  if (!judge) throw Errors.notFound("Судья");
  return judge;
}

export function createJudge(data: InsertJudge): Judge {
  return db.insert(judges).values(data as any).returning().get();
}

export function updateJudge(id: number, data: Partial<InsertJudge>): Judge {
  const existing = db.select().from(judges).where(eq(judges.id, id)).get();
  if (!existing) throw Errors.notFound("Судья");
  return db.update(judges).set(data as any).where(eq(judges.id, id)).returning().get();
}

export function deactivateJudge(id: number): Judge {
  const existing = db.select().from(judges).where(eq(judges.id, id)).get();
  if (!existing) throw Errors.notFound("Судья");
  return db
    .update(judges)
    .set({ isActive: false })
    .where(eq(judges.id, id))
    .returning()
    .get();
}

// -------------------------------------------------------
// Карты (CS2)
// -------------------------------------------------------

export function getAllMaps(onlyActive = true): MapRecord[] {
  const all = db.select().from(maps).all();
  if (onlyActive) return all.filter((m) => m.isActive);
  return all;
}

export function getMapById(id: number): MapRecord {
  const map = db.select().from(maps).where(eq(maps.id, id)).get();
  if (!map) throw Errors.notFound("Карта");
  return map;
}

export function createMap(data: InsertMap): MapRecord {
  return db.insert(maps).values(data as any).returning().get();
}

export function updateMap(id: number, data: Partial<InsertMap>): MapRecord {
  const existing = db.select().from(maps).where(eq(maps.id, id)).get();
  if (!existing) throw Errors.notFound("Карта");
  return db.update(maps).set(data as any).where(eq(maps.id, id)).returning().get();
}

// -------------------------------------------------------
// Типы нарушений
// -------------------------------------------------------

export function getAllViolationTypes(onlyActive = true): ViolationTypeRecord[] {
  const all = db.select().from(violationTypes).orderBy(violationTypes.article).all();
  if (onlyActive) return all.filter((v) => v.isActive);
  return all;
}

export function getViolationTypeById(id: number): ViolationTypeRecord {
  const vt = db.select().from(violationTypes).where(eq(violationTypes.id, id)).get();
  if (!vt) throw Errors.notFound("Тип нарушения");
  return vt;
}

export function createViolationType(data: InsertViolationType): ViolationTypeRecord {
  return db.insert(violationTypes).values(data as any).returning().get();
}

export function updateViolationType(
  id: number,
  data: Partial<InsertViolationType>
): ViolationTypeRecord {
  const existing = db
    .select()
    .from(violationTypes)
    .where(eq(violationTypes.id, id))
    .get();
  if (!existing) throw Errors.notFound("Тип нарушения");
  return db.update(violationTypes).set(data as any).where(eq(violationTypes.id, id)).returning().get();
}
