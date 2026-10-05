// User intents. Each one applies the shared state machine / inventory maths, persists synchronously
// (hooks update immediately), then refreshes the native surfaces (reminders, Live Activity / Live
// Update, widgets) and schedules a circle sync. Await the returned promise in headless contexts
// (notification actions, background task) so the surfaces finish before JS is suspended.
import {
  asNeededRemaining,
  type Dose,
  decrement,
  effectiveTheme,
  increment,
  logAsNeeded as sharedLogAsNeeded,
  markSkipped,
  markTaken,
  type Medication,
  type Settings,
  snooze,
  undo,
} from '@dosely/shared';

import { applyAppIcon } from '@/native/app-icon';
import { cancelAllDoseNotifications } from '@/native/notifications';
import { refreshSurfaces } from '@/native/surfaces';

import { getDose, getDoses, listDosesBetween, saveDose, saveDoses } from './doses-repo';
import { reconcileMedicationDoses } from './expand';
import {
  getMedication,
  insertMedication,
  listMedications,
  markMedicationDeleted,
  type MedicationInput,
  type MedicationPatch,
  patchMedication,
  saveMedication,
  setMedicationArchived,
} from './medications-repo';
import { createProfile, markProfileDeleted, type ProfileInput, type ProfilePatch, updateProfile } from './profiles-repo';
import { wipeAllTables } from './reset';
import { getSettings, updateSettings as writeSettings } from './settings-repo';
import { scheduleSync } from './sync-client';
import { dayBounds, deviceTimeZone, nowIso, todayKey } from './time';

export const DEFAULT_SNOOZE_MINUTES = 10;

function afterWrite(opts: { medId?: string; doseIds?: string[] } = {}): Promise<void> {
  scheduleSync();
  return refreshSurfaces(opts);
}

/** Inventory delta for a mark change: −1 when a dose becomes taken, +1 when a take is cleared. */
function adjustInventory(medId: string, before: Dose, after: Dose, now: string): void {
  const wasTaken = !!before.takenAt;
  const isTaken = !!after.takenAt;
  if (wasTaken === isTaken) return;
  const med = getMedication(medId);
  if (!med) return;
  saveMedication(isTaken ? decrement(med, now) : increment(med, now));
}

function applyToDoses(ids: readonly string[], change: (d: Dose, now: string) => Dose): Dose[] {
  const now = nowIso();
  const changed: Dose[] = [];
  for (const dose of getDoses(ids)) {
    if (dose.deletedAt) continue;
    const next = change(dose, now);
    if (next === dose) continue;
    changed.push(next);
    adjustInventory(dose.medicationId, dose, next, now);
  }
  saveDoses(changed);
  return changed;
}

// ---------------------------------------------------------------------------
// Dose actions

/** Marks a dose taken (early, late or after a skip) and uses one unit of inventory. */
export async function takeDose(id: string): Promise<Dose | null> {
  return (await takeDoses([id]))[0] ?? getDose(id);
}

/** Taken for several doses at once (notification group, "Taken all" on the Live Activity). */
export async function takeDoses(ids: readonly string[]): Promise<Dose[]> {
  const changed = applyToDoses(ids, markTaken);
  if (changed.length) await afterWrite({ medId: changed[0]!.medicationId, doseIds: changed.map((d) => d.id) });
  return changed;
}

/** Marks a dose skipped (a previous take is returned to inventory). */
export async function skipDose(id: string): Promise<Dose | null> {
  return (await skipDoses([id]))[0] ?? getDose(id);
}

export async function skipDoses(ids: readonly string[]): Promise<Dose[]> {
  const changed = applyToDoses(ids, markSkipped);
  if (changed.length) await afterWrite({ medId: changed[0]!.medicationId, doseIds: changed.map((d) => d.id) });
  return changed;
}

/** Snoozes (capped at the escalation point by the shared rule); the reminder re-fires at `snoozedUntil`. */
export async function snoozeDose(id: string, minutes = DEFAULT_SNOOZE_MINUTES): Promise<Dose | null> {
  return (await snoozeDoses([id], minutes))[0] ?? getDose(id);
}

export async function snoozeDoses(ids: readonly string[], minutes = DEFAULT_SNOOZE_MINUTES): Promise<Dose[]> {
  const { escalationMinutes } = getSettings();
  const changed = applyToDoses(ids, (d, now) => snooze(d, now, minutes, escalationMinutes));
  if (changed.length) await afterWrite({ medId: changed[0]!.medicationId });
  return changed;
}

/** Clears taken / skipped / snooze (a take goes back to inventory). An as-needed log is removed. */
export async function undoDose(id: string): Promise<Dose | null> {
  const dose = getDose(id);
  if (!dose || dose.deletedAt) return dose;
  const now = nowIso();
  if (dose.source === 'as-needed') {
    const removed: Dose = { ...dose, deletedAt: now, updatedAt: now };
    saveDose(removed);
    adjustInventory(dose.medicationId, dose, { ...removed, takenAt: null }, now);
    await afterWrite({ medId: dose.medicationId });
    return removed;
  }
  const [changed] = applyToDoses([id], undo);
  if (changed) await afterWrite({ medId: changed.medicationId });
  return changed ?? dose;
}

export type LogAsNeededResult = { ok: true; dose: Dose } | { ok: false; reason: 'not-found' | 'not-as-needed' | 'daily-limit' };

/** Logs an as-needed dose taken now (respects `maxPerDay`) and uses one unit of inventory. */
export async function logAsNeeded(medId: string): Promise<LogAsNeededResult> {
  const med = getMedication(medId);
  if (!med || med.deletedAt) return { ok: false, reason: 'not-found' };
  if (med.schedule.kind !== 'as-needed') return { ok: false, reason: 'not-as-needed' };
  const tz = deviceTimeZone();
  const today = todayKey(tz);
  const { start, end } = dayBounds(today, tz);
  const remaining = asNeededRemaining(med, listDosesBetween(start, end), today, tz);
  if (remaining === 0) return { ok: false, reason: 'daily-limit' };
  const now = nowIso();
  const dose = sharedLogAsNeeded(med, now);
  saveDose(dose);
  saveMedication(decrement(med, now));
  await afterWrite({ medId });
  return { ok: true, dose };
}

// ---------------------------------------------------------------------------
// Medications and profiles (expand doses + reschedule after each change)

export async function addMedication(input: MedicationInput): Promise<Medication> {
  const med = insertMedication(input);
  reconcileMedicationDoses(med);
  await afterWrite({ medId: med.id });
  return med;
}

/** Edits a medication; schedule / window changes re-plan its future unmarked doses. */
export async function updateMedication(id: string, patch: MedicationPatch): Promise<Medication> {
  const med = patchMedication(id, patch);
  reconcileMedicationDoses(med);
  await afterWrite({ medId: id });
  return med;
}

/** Sets the remaining count (refill). */
export async function setInventory(id: string, count: number | null): Promise<Medication> {
  return updateMedication(id, { inventoryCount: count });
}

export async function archiveMedication(id: string, archived = true): Promise<Medication> {
  const med = setMedicationArchived(id, archived);
  reconcileMedicationDoses(med);
  await afterWrite({ medId: id });
  return med;
}

/** Soft-deletes a medication and its future unmarked doses (history stays). */
export async function deleteMedication(id: string): Promise<void> {
  markMedicationDeleted(id);
  const med = getMedication(id);
  if (med) reconcileMedicationDoses(med);
  await afterWrite({ medId: id });
}

/** Adds a dependent; `initial` defaults to `initialFor(name)`. */
export async function addProfile(input: ProfileInput) {
  const profile = createProfile(input);
  scheduleSync();
  return profile;
}

/** Renames / recolours a profile; a new name re-derives the initial unless one is given. */
export async function renameProfile(id: string, patch: ProfilePatch) {
  const profile = updateProfile(id, patch);
  await afterWrite();
  return profile;
}

/** Soft-deletes a dependent with their medications and future unmarked doses. */
export async function deleteProfile(id: string): Promise<void> {
  for (const med of listMedications(id, { includeArchived: true })) {
    markMedicationDeleted(med.id);
    const deleted = getMedication(med.id);
    if (deleted) reconcileMedicationDoses(deleted);
  }
  markProfileDeleted(id);
  await afterWrite();
}

// ---------------------------------------------------------------------------
// Settings

/**
 * Saves settings; theme changes switch the app icon (`effectiveTheme`: a manual pick unless
 * auto-by-date is on) and recolour widgets / the Live Activity.
 */
export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = writeSettings(patch);
  if ('theme' in patch || 'autoSeasonal' in patch || 'region' in patch) {
    await applyAppIcon(effectiveTheme(next, todayKey()));
    await refreshSurfaces({ skipNotifications: true });
  } else if ('escalationMinutes' in patch) {
    await refreshSurfaces();
  }
  return next;
}

/** Re-applies the effective theme's icon (call on launch and at local midnight). */
export async function syncAppIconWithTheme(): Promise<void> {
  await applyAppIcon(effectiveTheme(getSettings(), todayKey()));
}

// ---------------------------------------------------------------------------
// Danger zone

/** Removes every scheduled reminder (e.g. before deleting all data). */
export async function cancelAllReminders(): Promise<void> {
  await cancelAllDoseNotifications();
}

/**
 * Deletes every local row (profiles, medications, doses, settings, sync state, escalations), cancels
 * reminders and clears the Live Activity / widgets. Server data is deleted separately
 * (`deleteCircle` / `deleteAccount`). The encryption key is kept for the now-empty database.
 */
export async function deleteAllLocalData(): Promise<void> {
  await cancelAllDoseNotifications();
  wipeAllTables();
  await refreshSurfaces({ skipNotifications: true });
}
