// Caregiver escalation from the member's device: doses still unmarked `escalationMinutes` after
// their window are reported to `POST /api/escalations`, which pushes the circle's caregivers.
// Uses shared `missedDosesForEscalation` + `groupEscalations` and the `escalations_sent` table so a
// dose is reported once per device (the server is idempotent per dose as well).
import { groupEscalations, missedDosesForEscalation } from '@dosely/shared';

import { ApiError, apiFetch } from '@/data/api';
import { isSignedIn } from '@/data/auth-client';
import { ownsCircle } from '@/data/circles-client';
import { listDosesBetween } from '@/data/doses-repo';
import { markEscalated, notifiedDoseIds, pruneEscalations } from '@/data/escalations-repo';
import { getMedication } from '@/data/medications-repo';
import { getProfile } from '@/data/profiles-repo';
import { getSettings } from '@/data/settings-repo';
import { nowIso } from '@/data/time';

const DAY_MS = 24 * 3600_000;

export type EscalationReportResult = { reported: number; skipped?: 'signed-out' | 'no-circle' | 'nothing-missed'; error?: string };

let running: Promise<EscalationReportResult> | null = null;

/**
 * Reports newly missed doses to caregivers. Called from the daily background task, on app
 * foreground, every 30 s while the app is open and when a dose window closes. Single-flight; never throws.
 */
export function reportMissedDoses(): Promise<EscalationReportResult> {
  if (!running) {
    running = run().finally(() => {
      running = null;
    });
  }
  return running;
}

async function run(): Promise<EscalationReportResult> {
  try {
    // Cached circle first: it is free, while the session check reads the Keychain.
    if (!ownsCircle()) return { reported: 0, skipped: 'no-circle' };
    if (!(await isSignedIn())) return { reported: 0, skipped: 'signed-out' };
    const now = nowIso();
    const nowMs = Date.parse(now);
    const { escalationMinutes } = getSettings();
    // Missed doses are at most 24 h old (shared default), plus window and escalation delay.
    const from = new Date(nowMs - 2 * DAY_MS).toISOString();
    const missed = missedDosesForEscalation(listDosesBetween(from, now), now, escalationMinutes, notifiedDoseIds());
    if (!missed.length) {
      pruneEscalations(new Date(nowMs - 7 * DAY_MS).toISOString());
      return { reported: 0, skipped: 'nothing-missed' };
    }
    let reported = 0;
    for (const group of groupEscalations(missed)) {
      const profileName = getProfile(group.profileId)?.name ?? 'Someone';
      const medNames = group.medicationIds.map((id) => getMedication(id)?.name ?? 'a medication').slice(0, 20);
      for (let i = 0; i < group.doseIds.length; i += 50) {
        const doseIds = group.doseIds.slice(i, i + 50);
        try {
          await apiFetch('/api/escalations', { method: 'POST', body: { doseIds, profileName, medNames, dueAt: group.dueAt } });
          markEscalated(doseIds, now);
          reported += doseIds.length;
        } catch (error) {
          // 4xx other than auth: the report itself is unusable; do not retry it forever.
          if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401) {
            markEscalated(doseIds, now);
            continue;
          }
          throw error;
        }
      }
    }
    return { reported };
  } catch (error) {
    return { reported: 0, error: error instanceof Error ? error.message : String(error) };
  }
}
