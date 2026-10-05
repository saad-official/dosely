/** Seasonal themes: which dates each theme covers and how the auto-by-date resolver picks one. */
import type { ThemeId } from "./themes";
import { addDaysToKey, type DayKey, partsToKey, weekdayOfKey } from "./tz";

export const SEASON_IDS = [
  "new-year",
  "valentines",
  "st-patricks",
  "easter",
  "canada-day",
  "independence-day",
  "halloween",
  "thanksgiving-ca",
  "thanksgiving-us",
  "holidays",
] as const;
export type SeasonId = (typeof SEASON_IDS)[number];

export const REGIONS = ["US", "CA", "both"] as const;
export type Region = (typeof REGIONS)[number];

export interface SeasonWindow {
  id: SeasonId;
  /** Inclusive first day. */
  start: DayKey;
  /** Inclusive last day. */
  end: DayKey;
}

export interface Season {
  id: SeasonId;
  label: string;
  /** `null` = everywhere; otherwise only for that region (or `both`). */
  region: "US" | "CA" | null;
  window(year: number): { start: DayKey; end: DayKey };
}

const key = (y: number, m: number, d: number): DayKey => partsToKey({ year: y, month: m, day: d });
const around = (center: DayKey, days: number) => ({ start: addDaysToKey(center, -days), end: addDaysToKey(center, days) });

/** Easter Sunday (Gregorian) via the anonymous Meeus/Jones/Butcher algorithm. */
export function easterSunday(year: number): DayKey {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return key(year, month, day);
}

/**
 * The `n`th `weekday` (0 = Sunday) of `month` (1–12); `n = -1` is the last one.
 * Throws a RangeError when the month has no such day.
 */
export function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): DayKey {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (n === -1) {
    const last = key(year, month, daysInMonth);
    return addDaysToKey(last, -((weekdayOfKey(last) - weekday + 7) % 7));
  }
  const first = key(year, month, 1);
  const offset = (weekday - weekdayOfKey(first) + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  if (n < 1 || day > daysInMonth) throw new RangeError(`No weekday ${weekday} #${n} in ${year}-${month}`);
  return key(year, month, day);
}

export const SEASONS: readonly Season[] = [
  // Labelled by the year whose 1 January it contains, so it starts on 31 December of the year before.
  { id: "new-year", label: "New Year", region: null, window: (y) => ({ start: key(y - 1, 12, 31), end: key(y, 1, 2) }) },
  { id: "valentines", label: "Valentine's Day", region: null, window: (y) => ({ start: key(y, 2, 7), end: key(y, 2, 14) }) },
  { id: "st-patricks", label: "St. Patrick's Day", region: null, window: (y) => ({ start: key(y, 3, 14), end: key(y, 3, 17) }) },
  {
    id: "easter",
    label: "Easter",
    region: null,
    window: (y) => ({ start: addDaysToKey(easterSunday(y), -2), end: addDaysToKey(easterSunday(y), 1) }),
  },
  { id: "canada-day", label: "Canada Day", region: "CA", window: (y) => ({ start: key(y, 6, 28), end: key(y, 7, 1) }) },
  { id: "independence-day", label: "Independence Day", region: "US", window: (y) => ({ start: key(y, 7, 1), end: key(y, 7, 4) }) },
  { id: "halloween", label: "Halloween", region: null, window: (y) => ({ start: key(y, 10, 15), end: key(y, 10, 31) }) },
  { id: "thanksgiving-ca", label: "Thanksgiving (Canada)", region: "CA", window: (y) => around(nthWeekdayOfMonth(y, 10, 1, 2), 3) },
  { id: "thanksgiving-us", label: "Thanksgiving (US)", region: "US", window: (y) => around(nthWeekdayOfMonth(y, 11, 4, 4), 3) },
  { id: "holidays", label: "Holidays", region: null, window: (y) => ({ start: key(y, 12, 1), end: key(y, 12, 30) }) },
];

function appliesTo(season: Season, region: Region): boolean {
  return season.region === null || region === "both" || season.region === region;
}

/** The season windows of `year` available in `region`, sorted by start (ties keep table order). */
export function seasonWindows(year: number, region: Region): SeasonWindow[] {
  return SEASONS.filter((s) => appliesTo(s, region))
    .map((s) => ({ id: s.id, ...s.window(year) }))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

/** The active season on a local day, or null. Overlaps go to the window that started earliest. */
export function resolveSeason(dayKey: DayKey, region: Region): SeasonId | null {
  const year = Number(dayKey.slice(0, 4));
  const hits = [...seasonWindows(year, region), ...seasonWindows(year + 1, region)]
    .filter((w) => w.start <= dayKey && dayKey <= w.end)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return hits[0]?.id ?? null;
}

export interface ThemeSettings {
  theme: ThemeId;
  autoSeasonal: boolean;
  region: Region;
}

/** Theme to render: the date's season when auto is on (falling back to the pick), otherwise the pick. */
export function effectiveTheme(settings: ThemeSettings, dayKey: DayKey): ThemeId {
  if (!settings.autoSeasonal) return settings.theme;
  return resolveSeason(dayKey, settings.region) ?? settings.theme;
}
