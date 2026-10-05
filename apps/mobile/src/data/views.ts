// Read models for the UI: doses with their medication, profile and current state; medications with
// refill maths. Pure functions over repositories (hooks wrap them in live queries).
import {
  activeWindow,
  type ActiveWindow,
  asNeededCount,
  asNeededRemaining,
  daysLeft,
  type DayKey,
  type Dose,
  doseState,
  type DoseState,
  dosesPerDay,
  type Medication,
  needsRefill,
  type Profile,
  refillDate,
} from '@dosely/shared';

import { getDose, listDosesBetween } from './doses-repo';
import { getMedication, listMedications } from './medications-repo';
import { listProfiles } from './profiles-repo';
import { getSettings } from './settings-repo';
import { dayBounds, deviceTimeZone, nowIso, todayKey } from './time';

export type DoseView = Dose & {
  state: DoseState;
  medication: Medication | null;
  profile: Profile | null;
};

export type MedicationView = Medication & {
  /** Average scheduled doses per day (0 for as-needed). */
  perDay: number;
  /** Whole days of supply left, or null when untracked / not regular. */
  daysLeft: number | null;
  /** Local day the supply runs out, or null. */
  refillDate: DayKey | null;
  needsRefill: boolean;
  /** As-needed doses logged today (0 for scheduled medications). */
  asNeededToday: number;
  /** As-needed doses still allowed today under `maxPerDay` (shared `asNeededRemaining`); null when uncapped or scheduled. */
  asNeededRemaining: number | null;
};

export type ActiveDoseWindow = ActiveWindow & { doses: DoseView[] };

function viewer() {
  const meds = new Map(listMedications(undefined, { includeArchived: true }).map((m) => [m.id, m]));
  const profiles = new Map(listProfiles().map((p) => [p.id, p]));
  const { escalationMinutes } = getSettings();
  const now = nowIso();
  return (d: Dose): DoseView => ({
    ...d,
    state: doseState(d, now, escalationMinutes),
    medication: meds.get(d.medicationId) ?? getMedication(d.medicationId),
    profile: profiles.get(d.profileId) ?? null,
  });
}

/** Doses due on a local day (default today), by due time, optionally one profile's. */
export function dosesForDay(dayKey: DayKey = todayKey(), profileId?: string): DoseView[] {
  const { start, end } = dayBounds(dayKey, deviceTimeZone());
  return listDosesBetween(start, end, profileId).map(viewer());
}

export function doseView(id: string): DoseView | null {
  const d = getDose(id);
  return d ? viewer()(d) : null;
}

type DayContext = { today: DayKey; tz: string; doses: () => Dose[] };

/** Today's doses, read at most once per batch and only when an as-needed medication asks. */
function dayContext(): DayContext {
  const tz = deviceTimeZone();
  const today = todayKey(tz);
  let cached: Dose[] | null = null;
  return {
    today,
    tz,
    doses: () => {
      if (!cached) {
        const { start, end } = dayBounds(today, tz);
        cached = listDosesBetween(start, end);
      }
      return cached;
    },
  };
}

function toMedicationView(m: Medication, ctx: DayContext): MedicationView {
  const perDay = dosesPerDay(m.schedule);
  const asNeeded = m.schedule.kind === 'as-needed';
  return {
    ...m,
    perDay,
    daysLeft: daysLeft(m, perDay),
    refillDate: refillDate(m, perDay, ctx.today),
    needsRefill: needsRefill(m),
    asNeededToday: asNeeded ? asNeededCount(m, ctx.doses(), ctx.today, ctx.tz) : 0,
    asNeededRemaining: asNeeded ? asNeededRemaining(m, ctx.doses(), ctx.today, ctx.tz) : null,
  };
}

/** Live medications (optionally one profile's, archived only when asked) with refill and as-needed maths. */
export function medicationViews(profileId?: string, opts: { includeArchived?: boolean } = {}): MedicationView[] {
  const ctx = dayContext();
  return listMedications(profileId, opts).map((m) => toMedicationView(m, ctx));
}

/** One medication with refill and as-needed maths (archived / deleted rows included), or null. */
export function medicationView(id: string): MedicationView | null {
  const m = getMedication(id);
  return m ? toMedicationView(m, dayContext()) : null;
}

/** The shared `activeWindow` around now, with dose details for the UI. */
export function activeDoseWindow(): ActiveDoseWindow | null {
  const now = Date.now();
  const doses = listDosesBetween(new Date(now - 24 * 3600_000).toISOString(), new Date(now + 60_000).toISOString());
  const window = activeWindow(doses, nowIso());
  if (!window) return null;
  const view = viewer();
  const byId = new Map(doses.map((d) => [d.id, d]));
  return { ...window, doses: window.doseIds.flatMap((id) => (byId.has(id) ? [view(byId.get(id)!)] : [])) };
}
