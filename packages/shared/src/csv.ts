import type { Dose, Medication, Profile } from "./schemas";
import { dayKeyOf, type IsoString, localTime } from "./tz";
import { doseState } from "./window";

export type CsvCell = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;
const NUMERIC = /^-?\d+(\.\d+)?$/;
const NEEDS_QUOTES = /[",\r\n]/;

/**
 * RFC 4180 cell escaping, plus formula-injection protection: text that a spreadsheet would run as a
 * formula (leading = + - @ tab CR) is prefixed with `'`. Plain negative numbers stay numeric.
 */
export function csvEscape(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (FORMULA_START.test(s) && !NUMERIC.test(s)) s = `'${s}`;
  return NEEDS_QUOTES.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows to CSV text with CRLF line endings (and a trailing CRLF). */
export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  return rows.map((r) => r.map(csvEscape).join(",") + "\r\n").join("");
}

export const CSV_HEADER = ["Date", "Due", "Medication", "Strength", "Profile", "Status", "Taken at", "Skipped at", "Source"];

export interface ExportOptions {
  /** With `now`, status is the full dose state (missed, late, …); without, taken / skipped / unmarked. */
  now?: IsoString;
  escalationMinutes?: number;
  /** Fills the Profile column; blank when omitted. */
  profiles?: readonly Pick<Profile, "id" | "name">[];
}

const localStamp = (instant: IsoString, tz: string) => `${dayKeyOf(instant, tz)} ${localTime(instant, tz)}`;

/** History export: a header row then one row per non-deleted dose, by due time, in local time of `tz`. */
export function exportRows(
  doses: readonly Dose[],
  meds: readonly Medication[],
  tz = "UTC",
  options: ExportOptions = {},
): CsvCell[][] {
  const medById = new Map(meds.map((m) => [m.id, m]));
  const profileById = new Map((options.profiles ?? []).map((p) => [p.id, p.name]));
  const rows = doses
    .filter((d) => !d.deletedAt)
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
    .map((d): CsvCell[] => {
      const med = medById.get(d.medicationId);
      const status = options.now
        ? doseState(d, options.now, options.escalationMinutes)
        : d.takenAt
          ? "taken"
          : d.skippedAt
            ? "skipped"
            : "unmarked";
      return [
        dayKeyOf(d.dueAt, tz),
        localTime(d.dueAt, tz),
        med?.name ?? "(deleted medication)",
        med?.strength ?? "",
        profileById.get(d.profileId) ?? "",
        status,
        d.takenAt ? localStamp(d.takenAt, tz) : "",
        d.skippedAt ? localStamp(d.skippedAt, tz) : "",
        d.source,
      ];
    });
  return [[...CSV_HEADER], ...rows];
}
