// Adherence read model over an inclusive range of local days, composed from the shared stats
// (`weeklySummary` per 7-day chunk, `streak`, `onTimeRate`). Only scheduled doses count.
import {
  addDaysToKey,
  type DayKey,
  type DaySummary,
  dayKeyOf,
  type MedSummary,
  onTimeRate,
  streak,
  type Tally,
  weeklySummary,
} from '@dosely/shared';

import { listDosesBetween } from './doses-repo';
import { getSettings } from './settings-repo';
import { dayBounds, deviceTimeZone, nowIso, todayKey } from './time';

/** Inclusive local-day range, `YYYY-MM-DD`. */
export type AdherenceRange = { from: DayKey; to: DayKey };

export type MedAdherence = MedSummary & {
  /** Consecutive fully-taken days within the range, ending at `range.to` (today's pending doses are neutral). */
  streak: number;
};

export type AdherenceReport = Tally & {
  range: AdherenceRange;
  days: DaySummary[];
  perMed: MedAdherence[];
  /** Share of taken doses taken inside their window; null when nothing was taken. */
  onTimeRate: number | null;
  bestDay: DayKey | null;
  worstDay: DayKey | null;
};

/** The last `n` local days ending today (`lastDays(7)` = this week so far). */
export function lastDays(n: number, endKey: DayKey = todayKey()): AdherenceRange {
  return { from: addDaysToKey(endKey, -(Math.max(1, Math.floor(n)) - 1)), to: endKey };
}

const MAX_DAYS = 400;

function sumTallies(items: readonly Tally[]): Tally {
  const t = { taken: 0, skipped: 0, missed: 0, pending: 0, total: 0 };
  for (const x of items) {
    t.taken += x.taken;
    t.skipped += x.skipped;
    t.missed += x.missed;
    t.pending += x.pending;
    t.total += x.total;
  }
  const settled = t.taken + t.skipped + t.missed;
  return { ...t, rate: settled ? t.taken / settled : null };
}

export function adherenceFor(range: AdherenceRange, profileId?: string): AdherenceReport {
  const tz = deviceTimeZone();
  const now = nowIso();
  const { escalationMinutes } = getSettings();
  const from = range.from <= range.to ? range.from : range.to;
  let to = range.from <= range.to ? range.to : range.from;
  if (addDaysToKey(from, MAX_DAYS) < to) to = addDaysToKey(from, MAX_DAYS - 1);

  const start = dayBounds(from, tz).start;
  const end = dayBounds(to, tz).end;
  const doses = listDosesBetween(start, end, profileId).filter((d) => {
    const key = dayKeyOf(d.dueAt, tz);
    return key >= from && key <= to;
  });

  const days: DaySummary[] = [];
  const medParts = new Map<string, MedSummary[]>();
  for (let weekStart = from; weekStart <= to; weekStart = addDaysToKey(weekStart, 7)) {
    const week = weeklySummary(doses, weekStart, tz, now, escalationMinutes);
    days.push(...week.days.filter((d) => d.dayKey <= to));
    for (const m of week.perMed) medParts.set(m.medicationId, [...(medParts.get(m.medicationId) ?? []), m]);
  }

  const perMed: MedAdherence[] = [...medParts.entries()].map(([medicationId, parts]) => ({
    medicationId,
    ...sumTallies(parts),
    streak: streak(doses, medicationId, to, tz, now, escalationMinutes),
  }));

  let best: DaySummary | null = null;
  let worst: DaySummary | null = null;
  for (const day of days) {
    if (day.rate === null) continue;
    if (!best || day.rate > (best.rate ?? 0)) best = day;
    if (!worst || day.rate < (worst.rate ?? 1)) worst = day;
  }

  return {
    range: { from, to },
    ...sumTallies(days),
    days,
    perMed,
    onTimeRate: onTimeRate(doses),
    bestDay: best?.dayKey ?? null,
    worstDay: worst?.dayKey ?? null,
  };
}
