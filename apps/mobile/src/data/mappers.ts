// Row ↔ domain mapping. Domain types and validation come from @dosely/shared.
import {
  type Dose,
  type MedColor,
  type MedForm,
  type MedIcon,
  type Medication,
  newIdFrom,
  type Profile,
  type Schedule,
  ScheduleSchema,
} from '@dosely/shared';
import * as Crypto from 'expo-crypto';

import type { DoseRow, MedicationRow, ProfileRow } from './schema';

/** New random UUIDv7 (profiles, medications; scheduled dose ids are deterministic instead). */
export function newId(at: number = Date.now()): string {
  return newIdFrom(at, Crypto.getRandomBytes(10));
}

export function toProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    name: r.name,
    color: r.color as MedColor,
    initial: r.initial,
    isSelf: r.isSelf,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  };
}

export function fromProfile(p: Profile): ProfileRow {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    initial: p.initial,
    isSelf: p.isSelf,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    deletedAt: p.deletedAt ?? null,
  };
}

/** Parses stored schedule JSON; a corrupt value degrades to as-needed (no reminders) instead of crashing. */
export function parseSchedule(json: string): Schedule {
  try {
    const parsed = ScheduleSchema.safeParse(JSON.parse(json));
    if (parsed.success) return parsed.data;
  } catch {
    // fall through
  }
  console.warn('[data] invalid schedule JSON; treating as as-needed');
  return { kind: 'as-needed' };
}

/** Validates and serialises a schedule (throws a zod error on invalid input). */
export function serializeSchedule(schedule: Schedule): string {
  return JSON.stringify(ScheduleSchema.parse(schedule));
}

export function toMedication(r: MedicationRow): Medication {
  return {
    id: r.id,
    profileId: r.profileId,
    name: r.name,
    strength: r.strength,
    form: r.form as MedForm,
    instructions: r.instructions,
    color: r.color as MedColor,
    icon: r.icon as MedIcon,
    schedule: parseSchedule(r.scheduleJson),
    windowMinutes: r.windowMinutes,
    inventoryCount: r.inventoryCount,
    refillThreshold: r.refillThreshold,
    archivedAt: r.archivedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  };
}

export function fromMedication(m: Medication): MedicationRow {
  return {
    id: m.id,
    profileId: m.profileId,
    name: m.name,
    strength: m.strength ?? null,
    form: m.form,
    instructions: m.instructions ?? null,
    color: m.color,
    icon: m.icon,
    scheduleJson: serializeSchedule(m.schedule),
    windowMinutes: m.windowMinutes,
    inventoryCount: m.inventoryCount ?? null,
    refillThreshold: m.refillThreshold ?? null,
    archivedAt: m.archivedAt ?? null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    deletedAt: m.deletedAt ?? null,
  };
}

export function toDose(r: DoseRow): Dose {
  return {
    id: r.id,
    medicationId: r.medicationId,
    profileId: r.profileId,
    dueAt: r.dueAt,
    windowEndsAt: r.windowEndsAt,
    takenAt: r.takenAt,
    skippedAt: r.skippedAt,
    snoozedUntil: r.snoozedUntil,
    source: r.source,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  };
}

export function fromDose(d: Dose): DoseRow {
  return {
    id: d.id,
    medicationId: d.medicationId,
    profileId: d.profileId,
    dueAt: d.dueAt,
    windowEndsAt: d.windowEndsAt,
    takenAt: d.takenAt ?? null,
    skippedAt: d.skippedAt ?? null,
    snoozedUntil: d.snoozedUntil ?? null,
    source: d.source,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    deletedAt: d.deletedAt ?? null,
  };
}
