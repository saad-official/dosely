/**
 * Server-side view of a mirrored dose (the device runs the full state machine
 * from @dosely/shared; the server only needs enough for the caregiver view
 * and the missed-dose sweep).
 *
 * upcoming (before due) -> due (inside the window, or snoozed) -> late (window
 * closed) -> missed (still unmarked ESCALATE_AFTER_MINUTES after the window).
 * Taken / skipped win whatever the clock says. A snooze that runs past the
 * window moves the window's end to the snooze time.
 */
export const ESCALATE_AFTER_MINUTES = 30;

export type DoseState = "upcoming" | "due" | "late" | "missed" | "taken" | "skipped";

export type DoseTimes = {
  dueAt: Date;
  takenAt: Date | null;
  skippedAt: Date | null;
  snoozedUntil: Date | null;
};

const MINUTE = 60_000;

export function windowEnd(dose: DoseTimes, windowMinutes: number): Date {
  const end = dose.dueAt.getTime() + windowMinutes * MINUTE;
  return new Date(Math.max(end, dose.snoozedUntil?.getTime() ?? end));
}

/** When an unmarked dose becomes "missed" and caregivers are alerted. */
export function escalationDueAt(dose: DoseTimes, windowMinutes: number): Date {
  return new Date(windowEnd(dose, windowMinutes).getTime() + ESCALATE_AFTER_MINUTES * MINUTE);
}

export function doseState(dose: DoseTimes, windowMinutes: number, now: Date): DoseState {
  if (dose.takenAt) return "taken";
  if (dose.skippedAt) return "skipped";
  const t = now.getTime();
  if (t < dose.dueAt.getTime()) return "upcoming";
  if (t < windowEnd(dose, windowMinutes).getTime()) return "due";
  if (t < escalationDueAt(dose, windowMinutes).getTime()) return "late";
  return "missed";
}
