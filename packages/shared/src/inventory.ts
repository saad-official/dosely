/** Inventory maths: per-dose decrement, days of supply left and the refill date. */
import type { Medication, Schedule } from "./schemas";
import { addDaysToKey, type DayKey, type IsoString } from "./tz";

/** Average scheduled doses per day (weekday subsets averaged over the week; as-needed = 0). */
export function dosesPerDay(schedule: Schedule): number {
  if (schedule.kind === "times") return schedule.times.length * ((schedule.days?.length ?? 7) / 7);
  if (schedule.kind === "interval") return 24 / schedule.everyHours;
  return 0;
}

function adjust(med: Medication, now: IsoString, delta: number): Medication {
  if (med.inventoryCount === null || med.inventoryCount === undefined) return med;
  return { ...med, inventoryCount: Math.max(0, med.inventoryCount + delta), updatedAt: now };
}

/** Use `units` from inventory when a dose is taken (floors at 0). Untracked inventory is unchanged. */
export function decrement(med: Medication, now: IsoString, units = 1): Medication {
  return adjust(med, now, -units);
}

/** Put `units` back, e.g. when a take is undone. Untracked inventory is unchanged. */
export function increment(med: Medication, now: IsoString, units = 1): Medication {
  return adjust(med, now, units);
}

/** Whole days of supply left, or null when inventory is untracked or nothing is taken regularly. */
export function daysLeft(med: Medication, perDay: number): number | null {
  if (med.inventoryCount === null || med.inventoryCount === undefined || !(perDay > 0)) return null;
  return Math.floor(med.inventoryCount / perDay);
}

/** The local day the supply runs out (`fromDayKey` + days left), or null when unknown. */
export function refillDate(med: Medication, perDay: number, fromDayKey: DayKey): DayKey | null {
  const left = daysLeft(med, perDay);
  return left === null ? null : addDaysToKey(fromDayKey, left);
}

/** True when tracked inventory is at or below the refill threshold. */
export function needsRefill(med: Medication): boolean {
  const { inventoryCount: count, refillThreshold: threshold } = med;
  if (count === null || count === undefined || threshold === null || threshold === undefined) return false;
  return count <= threshold;
}
