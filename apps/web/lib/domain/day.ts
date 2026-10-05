/**
 * Calendar-day bounds in an IANA time zone with Intl only (no tz database
 * dependency). DST days come out 23 or 25 hours long.
 */

export function isTimeZone(value: string): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function wallClock(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Milliseconds the zone is ahead of UTC at `instant`. */
function offsetAt(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant of local midnight starting `y-m-d` in the zone. */
function localMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  let start = guess - offsetAt(new Date(guess), timeZone);
  const corrected = guess - offsetAt(new Date(start), timeZone);
  if (corrected !== start) start = corrected;
  return new Date(start);
}

/** `YYYY-MM-DD` of `instant` in the zone. */
export function localDate(instant: Date, timeZone: string): string {
  const w = wallClock(instant, timeZone);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/** [start, end) of the local calendar day `date` (`YYYY-MM-DD`). */
export function dayBounds(date: string, timeZone: string): { start: Date; end: Date } {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: localMidnight(year, month, day, timeZone),
    end: localMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timeZone),
  };
}
