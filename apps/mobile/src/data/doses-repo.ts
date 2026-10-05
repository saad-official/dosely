// Doses: concrete reminders expanded from schedules (deterministic ids) plus as-needed logs.
import type { Dose } from '@dosely/shared';
import { and, asc, eq, gt, gte, inArray, isNull, lt } from 'drizzle-orm';

import { db } from './db';
import { fromDose, toDose } from './mappers';
import { doses } from './schema';
import { notifyTables } from './store';

const CHUNK = 200;

function chunks<T>(xs: readonly T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

export function getDose(id: string): Dose | null {
  const row = db.select().from(doses).where(eq(doses.id, id)).get();
  return row ? toDose(row) : null;
}

export function getDoses(ids: readonly string[]): Dose[] {
  if (!ids.length) return [];
  return chunks(ids).flatMap((part) => db.select().from(doses).where(inArray(doses.id, part)).all().map(toDose));
}

/** Live doses with `dueAt` in `[startIso, endIso)`, by due time; optionally one profile's. */
export function listDosesBetween(startIso: string, endIso: string, profileId?: string): Dose[] {
  const where = [isNull(doses.deletedAt), gte(doses.dueAt, startIso), lt(doses.dueAt, endIso)];
  if (profileId) where.push(eq(doses.profileId, profileId));
  return db
    .select()
    .from(doses)
    .where(and(...where))
    .orderBy(asc(doses.dueAt))
    .all()
    .map(toDose);
}

/** Live doses of one medication in `[startIso, endIso)`. */
export function listDosesForMedication(medicationId: string, startIso: string, endIso: string): Dose[] {
  return db
    .select()
    .from(doses)
    .where(
      and(eq(doses.medicationId, medicationId), isNull(doses.deletedAt), gte(doses.dueAt, startIso), lt(doses.dueAt, endIso)),
    )
    .orderBy(asc(doses.dueAt))
    .all()
    .map(toDose);
}

/** Future (strictly after `afterIso`) live doses of one medication, marked or not. */
export function listFutureDosesForMedication(medicationId: string, afterIso: string): Dose[] {
  return db
    .select()
    .from(doses)
    .where(and(eq(doses.medicationId, medicationId), isNull(doses.deletedAt), gt(doses.dueAt, afterIso)))
    .all()
    .map(toDose);
}

/** Inserts doses, ignoring ids that already exist (keeps marks). Returns how many were new. */
export function insertDosesIgnoringExisting(rows: readonly Dose[]): number {
  if (!rows.length) return 0;
  let inserted = 0;
  db.transaction((tx) => {
    for (const part of chunks(rows)) {
      const res = tx.insert(doses).values(part.map(fromDose)).onConflictDoNothing({ target: doses.id }).run();
      inserted += res.changes;
    }
  });
  if (inserted) notifyTables('doses');
  return inserted;
}

/** Writes doses (insert or replace by id). */
export function saveDoses(rows: readonly Dose[]): void {
  if (!rows.length) return;
  db.transaction((tx) => {
    for (const d of rows) {
      const row = fromDose(d);
      tx.insert(doses).values(row).onConflictDoUpdate({ target: doses.id, set: row }).run();
    }
  });
  notifyTables('doses');
}

export function saveDose(dose: Dose): void {
  saveDoses([dose]);
}

/** Raw rows including tombstones (sync diffs them with shared `diffDirty`). */
export function allDoseRows(): Dose[] {
  return db.select().from(doses).all().map(toDose);
}
