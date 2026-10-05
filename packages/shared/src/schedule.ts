/** Schedule expansion: medication schedules → concrete dose rows, DST-safe and idempotent. */
import { idFromKey } from "./ids";
import type { Dose, Medication } from "./schemas";
import { addDaysToKey, type DayKey, dayKeyOf, type IsoString, weekdayOfKey, zonedInstant, zonedMidnight } from "./tz";

const MINUTE = 60_000;
const HOUR = 3_600_000;
const iso = (ms: number): IsoString => new Date(ms).toISOString();

/** Deterministic dose id: UUIDv7 with `dueAt` as its timestamp, rest hashed from medication id + `dueAt`. */
export function doseIdFor(medicationId: string, dueAt: IsoString | number): string {
  const ms = typeof dueAt === "number" ? dueAt : Date.parse(dueAt);
  return idFromKey(ms, medicationId);
}

function isActive(med: Medication): boolean {
  return !med.archivedAt && !med.deletedAt;
}

/** Due instants (ms) of a schedule over `days` local days from `fromDayKey` (unsorted, may repeat). */
function dueInstants(med: Medication, fromDayKey: DayKey, days: number, tz: string): number[] {
  const s = med.schedule;
  if (s.kind === "as-needed" || days <= 0) return [];
  if (s.kind === "times") {
    const out: number[] = [];
    for (let i = 0; i < days; i++) {
      const key = addDaysToKey(fromDayKey, i);
      if (s.days && !s.days.includes(weekdayOfKey(key))) continue;
      for (const t of s.times) out.push(zonedInstant(key, t, tz));
    }
    return out;
  }
  const start = zonedMidnight(fromDayKey, tz);
  const end = zonedMidnight(addDaysToKey(fromDayKey, days), tz);
  const anchor = Date.parse(s.anchor);
  const step = s.everyHours * HOUR;
  const out: number[] = [];
  for (let k = Math.max(0, Math.ceil((start - anchor) / step)); anchor + k * step < end; k++) out.push(anchor + k * step);
  return out;
}

/**
 * Concrete doses for `days` local days starting at `fromDayKey` in `tz`.
 * - `times`: wall-clock times stay fixed across DST; a time in a spring-forward gap moves forward by
 *   the gap (02:30 → 03:30); a repeated fall-back time uses its first occurrence. Instants that collide
 *   after the shift collapse into one dose.
 * - `interval`: `anchor + k * everyHours` of elapsed time (so local times drift by an hour across DST).
 * - `as-needed`, archived and deleted medications expand to nothing.
 * Doses whose window had already closed when the medication was created are dropped.
 * Ids come from `doseIdFor`, so re-expanding is idempotent; `createdAt`/`updatedAt` are `now`
 * (default: the medication's `updatedAt`). Insert-or-ignore by id so existing marks survive.
 */
export function expandDoses(med: Medication, fromDayKey: DayKey, days: number, tz = "UTC", now?: IsoString): Dose[] {
  if (!isActive(med)) return [];
  const windowMs = med.windowMinutes * MINUTE;
  const createdMs = Date.parse(med.createdAt);
  const stamp = now ?? med.updatedAt;
  const instants = [...new Set(dueInstants(med, fromDayKey, days, tz))]
    .filter((ms) => ms + windowMs > createdMs)
    .sort((a, b) => a - b);
  return instants.map((ms) => ({
    id: doseIdFor(med.id, ms),
    medicationId: med.id,
    profileId: med.profileId,
    dueAt: iso(ms),
    windowEndsAt: iso(ms + windowMs),
    takenAt: null,
    skippedAt: null,
    snoozedUntil: null,
    source: "scheduled",
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  }));
}

/** The first scheduled due instant strictly after `afterIso`, or null (as-needed / archived / deleted). */
export function nextDueAfter(med: Medication, afterIso: IsoString, tz = "UTC"): IsoString | null {
  if (!isActive(med) || med.schedule.kind === "as-needed") return null;
  const after = Date.parse(afterIso);
  if (med.schedule.kind === "interval") {
    const anchor = Date.parse(med.schedule.anchor);
    const step = med.schedule.everyHours * HOUR;
    const k = after < anchor ? 0 : Math.floor((after - anchor) / step) + 1;
    return iso(anchor + k * step);
  }
  // A weekday subset repeats weekly, so the next dose is at most 8 local days away.
  const from = dayKeyOf(after, tz);
  const next = expandDoses(med, from, 9, tz).find((d) => Date.parse(d.dueAt) > after);
  return next?.dueAt ?? null;
}

/** A taken as-needed dose logged at `now` (due, window end and taken all equal `now`). */
export function logAsNeeded(med: Medication, now: IsoString): Dose {
  const ms = Date.parse(now);
  const at = iso(ms);
  return {
    id: idFromKey(ms, `${med.id}:as-needed`),
    medicationId: med.id,
    profileId: med.profileId,
    dueAt: at,
    windowEndsAt: at,
    takenAt: at,
    skippedAt: null,
    snoozedUntil: null,
    source: "as-needed",
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  };
}

/** As-needed doses still allowed on a local day under `maxPerDay`, or null when uncapped. */
export function asNeededRemaining(med: Medication, doses: readonly Dose[], dayKey: DayKey, tz = "UTC"): number | null {
  if (med.schedule.kind !== "as-needed" || med.schedule.maxPerDay === undefined) return null;
  const used = doses.filter(
    (d) => d.medicationId === med.id && d.source === "as-needed" && !d.deletedAt && d.takenAt && dayKeyOf(d.takenAt, tz) === dayKey,
  ).length;
  return Math.max(0, med.schedule.maxPerDay - used);
}
