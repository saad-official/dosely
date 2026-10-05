// Schedule expansion into the doses table, using shared `expandDoses` (DST-safe, deterministic ids).
import { addDaysToKey, type Dose, expandDoses, type Medication, zonedMidnight } from '@dosely/shared';

import { getDoses, insertDosesIgnoringExisting, listFutureDosesForMedication, saveDoses } from './doses-repo';
import { listMedications } from './medications-repo';
import { deviceTimeZone, nowIso, todayKey } from './time';

export const DEFAULT_EXPANSION_DAYS = 7;

const isUnmarked = (d: Dose) => !d.takenAt && !d.skippedAt;

/**
 * Brings one medication's future, unmarked scheduled doses in line with its current schedule:
 * new instants are inserted, changed windows updated, and doses the schedule no longer produces
 * (edit, archive, delete, time-zone change) are soft-deleted so the deletion syncs. Past and marked
 * doses are never touched. Returns true when anything changed.
 */
export function reconcileMedicationDoses(med: Medication, days = DEFAULT_EXPANSION_DAYS): boolean {
  const now = nowIso();
  const tz = deviceTimeZone();
  const today = todayKey(tz);
  const wanted = expandDoses(med, today, days, tz, now).filter((d) => d.dueAt > now);
  const wantedById = new Map(wanted.map((d) => [d.id, d]));
  // End of the expanded range; doses after it belong to a later expansion and are left alone.
  const horizon = new Date(zonedMidnight(addDaysToKey(today, days), tz)).toISOString();

  const changed: Dose[] = [];
  for (const existing of listFutureDosesForMedication(med.id, now)) {
    if (existing.source !== 'scheduled' || !isUnmarked(existing)) continue;
    const target = wantedById.get(existing.id);
    if (target) {
      wantedById.delete(existing.id);
      if (existing.windowEndsAt !== target.windowEndsAt || existing.profileId !== target.profileId) {
        changed.push({ ...existing, windowEndsAt: target.windowEndsAt, profileId: target.profileId, updatedAt: now });
      }
    } else if (existing.dueAt < horizon || !wanted.length) {
      // Inside the expanded range the schedule no longer produces this instant (or nothing at all).
      changed.push({ ...existing, snoozedUntil: null, deletedAt: now, updatedAt: now });
    }
  }
  // Revive soft-deleted rows whose id the schedule produces again (insert-or-ignore would skip them).
  const revived = insertOrRevive([...wantedById.values()], now);
  if (changed.length) saveDoses(changed);
  return changed.length > 0 || revived;
}

function insertOrRevive(rows: Dose[], now: string): boolean {
  if (!rows.length) return false;
  const inserted = insertDosesIgnoringExisting(rows);
  if (inserted === rows.length) return inserted > 0;
  // Some ids existed: they are either live (already handled above) or tombstones to bring back.
  const ids = new Set(rows.map((r) => r.id));
  const tombstones = getDoses([...ids]).filter((d) => !!d.deletedAt && d.source === 'scheduled' && isUnmarked(d));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const revive = tombstones.map((d) => ({ ...byId.get(d.id)!, createdAt: d.createdAt, updatedAt: now, deletedAt: null }));
  if (revive.length) saveDoses(revive);
  return inserted > 0 || revive.length > 0;
}

/**
 * Makes sure every active medication has doses for `days` local days from today
 * (insert-or-ignore by deterministic id, so marks survive) and prunes future unmarked doses the
 * schedules no longer produce. Archived and deleted medications lose their future unmarked doses.
 * Idempotent and cheap; run on launch, foreground, after edits and from the daily background task.
 */
export function ensureDosesExpanded(days = DEFAULT_EXPANSION_DAYS): { changed: boolean } {
  let changed = false;
  for (const med of listMedications(undefined, { includeArchived: true })) {
    if (reconcileMedicationDoses(med, days)) changed = true;
  }
  return { changed };
}
