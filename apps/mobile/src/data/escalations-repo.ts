// Doses this device already reported to caregivers (`escalations_sent`).
import { inArray, lt } from 'drizzle-orm';

import { db } from './db';
import { escalationsSent } from './schema';
import { notifyTables } from './store';

export function notifiedDoseIds(): Set<string> {
  return new Set(db.select({ id: escalationsSent.doseId }).from(escalationsSent).all().map((r) => r.id));
}

export function markEscalated(doseIds: readonly string[], at: string): void {
  if (!doseIds.length) return;
  db.transaction((tx) => {
    for (const doseId of doseIds) {
      tx.insert(escalationsSent).values({ doseId, notifiedAt: at }).onConflictDoNothing().run();
    }
  });
  notifyTables('escalations_sent');
}

export function unmarkEscalated(doseIds: readonly string[]): void {
  if (!doseIds.length) return;
  db.delete(escalationsSent).where(inArray(escalationsSent.doseId, [...doseIds])).run();
  notifyTables('escalations_sent');
}

/** Drops bookkeeping older than `beforeIso` (shared `missedDosesForEscalation` ignores old doses anyway). */
export function pruneEscalations(beforeIso: string): void {
  db.delete(escalationsSent).where(lt(escalationsSent.notifiedAt, beforeIso)).run();
}
