/** Adherence stats over scheduled doses (as-needed and deleted doses never count). */
import type { Dose } from "./schemas";
import { addDaysToKey, type DayKey, dayKeyOf, type IsoString } from "./tz";
import { DEFAULT_ESCALATION_MINUTES, doseState } from "./window";

export interface Tally {
  taken: number;
  skipped: number;
  missed: number;
  /** Unmarked and not yet missed (upcoming, due, late or snoozed). */
  pending: number;
  total: number;
  /** taken / (taken + skipped + missed); null when nothing is settled yet. */
  rate: number | null;
}

export interface DaySummary extends Tally {
  dayKey: DayKey;
}

export interface MedSummary extends Tally {
  medicationId: string;
}

export interface WeeklySummary extends Tally {
  weekStart: DayKey;
  days: DaySummary[];
  perMed: MedSummary[];
  bestDay: DayKey | null;
  worstDay: DayKey | null;
}

const MINUTE = 60_000;

function counted(doses: readonly Dose[]): Dose[] {
  return doses.filter((d) => d.source === "scheduled" && !d.deletedAt);
}

function tally(doses: readonly Dose[], now: IsoString, escalationMinutes: number): Tally {
  const t = { taken: 0, skipped: 0, missed: 0, pending: 0, total: doses.length };
  for (const d of doses) {
    const s = doseState(d, now, escalationMinutes);
    if (s === "taken") t.taken++;
    else if (s === "skipped") t.skipped++;
    else if (s === "missed") t.missed++;
    else t.pending++;
  }
  const settled = t.taken + t.skipped + t.missed;
  return { ...t, rate: settled ? t.taken / settled : null };
}

/** Today's-progress style rate: taken / scheduled doses due on local day `dayKey`; null if none. */
export function dailyRate(doses: readonly Dose[], dayKey: DayKey, tz = "UTC"): number | null {
  const day = counted(doses).filter((d) => dayKeyOf(d.dueAt, tz) === dayKey);
  if (!day.length) return null;
  return day.filter((d) => d.takenAt).length / day.length;
}

/**
 * Seven local days from `weekStartKey`: per-day and per-medication tallies (medications in order of first
 * due dose), the week total, and best/worst day by settled rate (ties go to the earlier day).
 */
export function weeklySummary(
  doses: readonly Dose[],
  weekStartKey: DayKey,
  tz: string,
  now: IsoString,
  escalationMinutes = DEFAULT_ESCALATION_MINUTES,
): WeeklySummary {
  const keys = Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStartKey, i));
  const inWeek = counted(doses)
    .map((d) => ({ d, key: dayKeyOf(d.dueAt, tz) }))
    .filter((x) => keys.includes(x.key))
    .sort((a, b) => Date.parse(a.d.dueAt) - Date.parse(b.d.dueAt));

  const days = keys.map((dayKey) => ({
    dayKey,
    ...tally(inWeek.filter((x) => x.key === dayKey).map((x) => x.d), now, escalationMinutes),
  }));
  const medIds = [...new Set(inWeek.map((x) => x.d.medicationId))];
  const perMed = medIds.map((medicationId) => ({
    medicationId,
    ...tally(inWeek.filter((x) => x.d.medicationId === medicationId).map((x) => x.d), now, escalationMinutes),
  }));

  let best: DaySummary | null = null;
  let worst: DaySummary | null = null;
  for (const day of days) {
    if (day.rate === null) continue;
    if (!best || day.rate > (best.rate ?? 0)) best = day;
    if (!worst || day.rate < (worst.rate ?? 1)) worst = day;
  }

  return {
    weekStart: weekStartKey,
    ...tally(inWeek.map((x) => x.d), now, escalationMinutes),
    days,
    perMed,
    bestDay: best?.dayKey ?? null,
    worstDay: worst?.dayKey ?? null,
  };
}

/**
 * Consecutive local days, ending at `upToDayKey`, on which every scheduled dose of `medId` was taken.
 * Days with nothing scheduled are neutral (weekday subsets keep their streak). Without `now` any
 * unmarked dose breaks the streak; with `now`, a day whose only outstanding doses are not yet missed
 * (e.g. today's evening dose) is neutral instead.
 */
export function streak(
  doses: readonly Dose[],
  medId: string,
  upToDayKey: DayKey,
  tz = "UTC",
  now?: IsoString,
  escalationMinutes = DEFAULT_ESCALATION_MINUTES,
): number {
  const byDay = new Map<DayKey, Dose[]>();
  for (const d of counted(doses)) {
    if (d.medicationId !== medId) continue;
    const key = dayKeyOf(d.dueAt, tz);
    if (key > upToDayKey) continue;
    byDay.set(key, [...(byDay.get(key) ?? []), d]);
  }
  if (!byDay.size) return 0;
  const earliest = [...byDay.keys()].sort()[0] ?? upToDayKey;
  let count = 0;
  for (let key = upToDayKey; key >= earliest; key = addDaysToKey(key, -1)) {
    const day = byDay.get(key);
    if (!day) continue;
    if (day.every((d) => d.takenAt)) {
      count++;
      continue;
    }
    const outstandingOnlyPending =
      now !== undefined &&
      day.every((d) => {
        const s = doseState(d, now, escalationMinutes);
        return s === "taken" || s === "upcoming" || s === "due" || s === "late" || s === "snoozed";
      });
    if (!outstandingOnlyPending) break;
  }
  return count;
}

/**
 * Share of taken scheduled doses that were taken inside `[dueAt − earlyGraceMinutes, windowEndsAt]`;
 * null when nothing was taken.
 */
export function onTimeRate(doses: readonly Dose[], earlyGraceMinutes = 0): number | null {
  const taken = counted(doses).filter((d) => d.takenAt);
  if (!taken.length) return null;
  const onTime = taken.filter((d) => {
    const t = Date.parse(d.takenAt as string);
    return t >= Date.parse(d.dueAt) - earlyGraceMinutes * MINUTE && t <= Date.parse(d.windowEndsAt);
  });
  return onTime.length / taken.length;
}
