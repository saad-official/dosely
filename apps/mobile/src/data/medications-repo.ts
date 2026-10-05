// Medications. The schedule is stored as JSON text and validated with shared `ScheduleSchema`.
import { type Medication, MedicationSchema, type Schedule } from '@dosely/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { db } from './db';
import { fromMedication, newId, toMedication } from './mappers';
import { medications } from './schema';
import { notifyTables } from './store';
import { nowIso } from './time';

export type MedicationInput = {
  profileId: string;
  name: string;
  strength?: string | null;
  form?: Medication['form'];
  instructions?: string | null;
  color?: Medication['color'];
  icon?: Medication['icon'];
  schedule: Schedule;
  windowMinutes?: number;
  inventoryCount?: number | null;
  refillThreshold?: number | null;
};

export type MedicationPatch = Partial<Omit<MedicationInput, 'profileId'>> & { profileId?: string };

/** Live (not deleted) medications, optionally of one profile; archived ones only when asked. */
export function listMedications(profileId?: string, opts: { includeArchived?: boolean } = {}): Medication[] {
  const where = [isNull(medications.deletedAt)];
  if (profileId) where.push(eq(medications.profileId, profileId));
  if (!opts.includeArchived) where.push(isNull(medications.archivedAt));
  return db
    .select()
    .from(medications)
    .where(and(...where))
    .orderBy(asc(medications.createdAt))
    .all()
    .map(toMedication);
}

export function getMedication(id: string): Medication | null {
  const row = db.select().from(medications).where(eq(medications.id, id)).get();
  return row ? toMedication(row) : null;
}

/** Validates and inserts. Callers usually go through `actions.addMedication` (expands doses, reschedules). */
export function insertMedication(input: MedicationInput): Medication {
  const at = nowIso();
  const med = MedicationSchema.parse({
    id: newId(),
    profileId: input.profileId,
    name: input.name,
    strength: input.strength ?? null,
    form: input.form ?? 'tablet',
    instructions: input.instructions ?? null,
    color: input.color ?? 'teal',
    icon: input.icon ?? 'pill',
    schedule: input.schedule,
    windowMinutes: input.windowMinutes ?? 60,
    inventoryCount: input.inventoryCount ?? null,
    refillThreshold: input.refillThreshold ?? null,
    archivedAt: null,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  });
  db.insert(medications).values(fromMedication(med)).run();
  notifyTables('medications');
  return med;
}

/** Validates and writes a full medication (after shared `decrement` / `increment` or a patch). */
export function saveMedication(med: Medication): Medication {
  const valid = MedicationSchema.parse(med);
  const row = fromMedication(valid);
  db.insert(medications).values(row).onConflictDoUpdate({ target: medications.id, set: row }).run();
  notifyTables('medications');
  return valid;
}

export function patchMedication(id: string, patch: MedicationPatch): Medication {
  const current = getMedication(id);
  if (!current) throw new Error(`Medication ${id} not found`);
  return saveMedication({ ...current, ...patch, updatedAt: nowIso() } as Medication);
}

export function setMedicationArchived(id: string, archived: boolean): Medication {
  const current = getMedication(id);
  if (!current) throw new Error(`Medication ${id} not found`);
  const at = nowIso();
  return saveMedication({ ...current, archivedAt: archived ? at : null, updatedAt: at });
}

export function markMedicationDeleted(id: string): void {
  const at = nowIso();
  db.update(medications).set({ deletedAt: at, updatedAt: at }).where(eq(medications.id, id)).run();
  notifyTables('medications');
}

/** Raw rows including tombstones (sync). */
export function allMedicationRows(): Medication[] {
  return db.select().from(medications).all().map(toMedication);
}

/** Writes pulled rows as-is (sync). */
export function putMedications(rows: readonly Medication[]): void {
  if (!rows.length) return;
  db.transaction((tx) => {
    for (const m of rows) {
      const row = fromMedication(m);
      tx.insert(medications).values(row).onConflictDoUpdate({ target: medications.id, set: row }).run();
    }
  });
  notifyTables('medications');
}
