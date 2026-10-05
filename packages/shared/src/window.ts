/** Dose window state machine: upcoming → due → late → missed, unless taken / skipped / snoozed. */
import type { Dose } from "./schemas";
import type { IsoString } from "./tz";

export type DoseState = "upcoming" | "due" | "late" | "missed" | "taken" | "skipped" | "snoozed";

export const DEFAULT_ESCALATION_MINUTES = 30;

const MINUTE = 60_000;
const ms = (s: IsoString) => Date.parse(s);
const iso = (n: number): IsoString => new Date(n).toISOString();

/** When an unmarked dose becomes missed (and caregivers are told): window end + `escalationMinutes`. */
export function escalationDueAt(dose: Dose, escalationMinutes = DEFAULT_ESCALATION_MINUTES): IsoString {
  return iso(ms(dose.windowEndsAt) + escalationMinutes * MINUTE);
}

/**
 * State of a dose at `now`. Marks win (taken, then skipped); an active snooze reads `snoozed`; otherwise
 * by clock: before `dueAt` upcoming, `[dueAt, windowEndsAt)` due, then late until window end +
 * `escalationMinutes`, then missed. Boundaries belong to the later state.
 */
export function doseState(dose: Dose, now: IsoString, escalationMinutes = DEFAULT_ESCALATION_MINUTES): DoseState {
  if (dose.takenAt) return "taken";
  if (dose.skippedAt) return "skipped";
  const t = ms(now);
  if (dose.snoozedUntil && t < ms(dose.snoozedUntil)) return "snoozed";
  if (t < ms(dose.dueAt)) return "upcoming";
  if (t < ms(dose.windowEndsAt)) return "due";
  if (t < ms(escalationDueAt(dose, escalationMinutes))) return "late";
  return "missed";
}

/** Mark taken (also allowed early, late or after a skip). Clears skip and snooze. No-op if already taken. */
export function markTaken(dose: Dose, now: IsoString): Dose {
  if (dose.takenAt) return dose;
  return { ...dose, takenAt: now, skippedAt: null, snoozedUntil: null, updatedAt: now };
}

/** Mark skipped. Clears taken and snooze. No-op if already skipped. */
export function markSkipped(dose: Dose, now: IsoString): Dose {
  if (dose.skippedAt) return dose;
  return { ...dose, skippedAt: now, takenAt: null, snoozedUntil: null, updatedAt: now };
}

/**
 * Snooze for `minutes` from `now`, capped at window end + `escalationMinutes` (a snooze can never hide a
 * dose past its escalation). No-op for taken, skipped or already-missed doses.
 */
export function snooze(dose: Dose, now: IsoString, minutes: number, escalationMinutes = DEFAULT_ESCALATION_MINUTES): Dose {
  if (!(minutes > 0)) throw new RangeError("Snooze minutes must be positive");
  if (dose.takenAt || dose.skippedAt) return dose;
  const cap = ms(escalationDueAt(dose, escalationMinutes));
  const t = ms(now);
  if (t >= cap) return dose;
  return { ...dose, snoozedUntil: iso(Math.min(t + minutes * MINUTE, cap)), updatedAt: now };
}

/** Clear every mark (taken, skipped, snooze). No-op for an unmarked dose. */
export function undo(dose: Dose, now: IsoString): Dose {
  if (!dose.takenAt && !dose.skippedAt && !dose.snoozedUntil) return dose;
  return { ...dose, takenAt: null, skippedAt: null, snoozedUntil: null, updatedAt: now };
}

export interface ActiveWindow {
  /** Open (unmarked, incl. snoozed) doses in the window, by due time. */
  doseIds: string[];
  earliestDueAt: IsoString;
  /** When the Live Activity should end if nothing is marked. */
  latestWindowEndsAt: IsoString;
  remaining: number;
  /** All scheduled doses whose window contains now, marked or not. */
  total: number;
}

/**
 * The dose window for the Live Activity / Live Update: scheduled, non-deleted doses whose
 * `[dueAt, windowEndsAt)` contains `now`. Null when there are none or all of them are marked.
 * Earliest due and latest end are taken over the open doses.
 */
export function activeWindow(doses: readonly Dose[], now: IsoString): ActiveWindow | null {
  const t = ms(now);
  const inWindow = doses
    .filter((d) => d.source === "scheduled" && !d.deletedAt && ms(d.dueAt) <= t && t < ms(d.windowEndsAt))
    .sort((a, b) => ms(a.dueAt) - ms(b.dueAt));
  const open = inWindow.filter((d) => !d.takenAt && !d.skippedAt);
  const first = open[0];
  if (!first) return null;
  const latest = Math.max(...open.map((d) => ms(d.windowEndsAt)));
  return {
    doseIds: open.map((d) => d.id),
    earliestDueAt: iso(ms(first.dueAt)),
    latestWindowEndsAt: iso(latest),
    remaining: open.length,
    total: inWindow.length,
  };
}

/**
 * Time left in a dose window for the Live Activity / Live Update and the "due now" card: whole
 * minutes rounded up, "35 min left", "1 h 05 min left", "2 h left"; "ends now" at or after the end.
 */
export function timeLeftLabel(endsAt: IsoString, now: IsoString | number = Date.now()): string {
  const t = typeof now === "number" ? now : ms(now);
  const minutes = Math.ceil((ms(endsAt) - t) / MINUTE);
  if (minutes <= 0) return "ends now";
  if (minutes < 60) return `${minutes} min left`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")} min left` : `${h} h left`;
}
