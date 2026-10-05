// Locale-aware display formatting for the UI (no domain maths: that lives in @dosely/shared).
import type { DayKey, Schedule } from '@dosely/shared';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dayLongFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const dayShortFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const weekdayShortFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
const weekdayNarrowFormat = new Intl.DateTimeFormat(undefined, { weekday: 'narrow', timeZone: 'UTC' });

/** `08:30` → `8:30 AM` / `08:30` per device locale. */
export function formatHhmm(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(2000, 0, 1, h ?? 0, m ?? 0);
  return timeFormat.format(d);
}

/** Local wall-clock `HH:mm` of a Date. */
export function toHhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** `HH:mm` → a Date today at that local time (for time pickers). */
export function hhmmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 8, m ?? 0, 0, 0);
  return d;
}

function keyToUtcDate(key: DayKey): Date {
  return new Date(`${key}T12:00:00Z`);
}

/** `2026-10-05` → `Monday, October 5`. */
export function formatDayLong(key: DayKey): string {
  return dayLongFormat.format(keyToUtcDate(key));
}

/** `2026-10-05` → `Oct 5`. */
export function formatDayShort(key: DayKey): string {
  return dayShortFormat.format(keyToUtcDate(key));
}

// 2023-01-01 was a Sunday: index 0..6 = Sunday..Saturday, matching the schedule's weekday numbers.
const WEEK_BASE = Date.UTC(2023, 0, 1, 12);
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export function weekdayShort(day: number): string {
  return weekdayShortFormat.format(new Date(WEEK_BASE + day * 86_400_000));
}
export function weekdayNarrow(day: number): string {
  return weekdayNarrowFormat.format(new Date(WEEK_BASE + day * 86_400_000));
}

/** `0.923` → `92%`; null → `–`. */
export function formatPercent(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? '–' : `${Math.round(rate * 100)}%`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export { plural };

/** One line describing when a medication is due. */
export function scheduleSummary(schedule: Schedule): string {
  switch (schedule.kind) {
    case 'times': {
      const times = [...schedule.times].sort().map(formatHhmm).join(', ');
      if (!schedule.days || schedule.days.length === 7) return times;
      const days = [...schedule.days].sort().map(weekdayShort).join(', ');
      return `${days} · ${times}`;
    }
    case 'interval': {
      const first = new Date(Date.parse(schedule.anchor));
      return `Every ${plural(schedule.everyHours, 'hour')} from ${timeFormat.format(first)}`;
    }
    case 'as-needed':
      return schedule.maxPerDay ? `As needed · up to ${schedule.maxPerDay} a day` : 'As needed';
  }
}

/** Inventory pill text: `12 left · refill in 6 days`. */
export function inventorySummary(count: number | null | undefined, daysLeft: number | null): string | null {
  if (count === null || count === undefined) return null;
  const left = `${count % 1 === 0 ? count : count.toFixed(1)} left`;
  if (daysLeft === null) return left;
  if (daysLeft <= 0) return `${left} · refill today`;
  return `${left} · refill in ${plural(daysLeft, 'day')}`;
}

/** Minutes → `45 min` / `1 h 30 min`. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** First letter(s) for an avatar. */
export function initialOf(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}
