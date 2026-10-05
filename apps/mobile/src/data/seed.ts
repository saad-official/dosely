// Development-only demo data: a self profile with three medications and a dependent with one, plus
// a few days of marked history so Today, History and the widgets have something to show.
import { addDaysToKey, type Dose, expandDoses, zonedInstant } from '@dosely/shared';

import { addMedication } from './actions';
import { saveDoses } from './doses-repo';
import { listMedications } from './medications-repo';
import { createProfile, ensureSelfProfile, listProfiles } from './profiles-repo';
import { updateSettings } from './settings-repo';
import { deviceTimeZone, todayKey } from './time';

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * Seeds demo data once (no-op when medications exist). Throws outside `__DEV__` so it can never
 * run in a release build. One medication is due ~5 minutes after seeding to try the dose window.
 */
export async function seedDemoData(): Promise<{ seeded: boolean }> {
  if (!__DEV__) throw new Error('seedDemoData is development-only');
  if (listMedications(undefined, { includeArchived: true }).length) return { seeded: false };

  updateSettings({ onboarded: true });
  const me = ensureSelfProfile('Sam');
  const mom = listProfiles().find((p) => !p.isSelf) ?? createProfile({ name: 'Mom', color: 'violet' });
  const soon = hhmm(new Date(Date.now() + 5 * 60_000));

  await addMedication({
    profileId: me.id,
    name: 'Metformin',
    strength: '500 mg',
    form: 'tablet',
    color: 'teal',
    icon: 'pill',
    instructions: 'With food',
    schedule: { kind: 'times', times: ['08:00', '20:00'] },
    inventoryCount: 42,
    refillThreshold: 10,
  });
  await addMedication({
    profileId: me.id,
    name: 'Vitamin D',
    strength: '1000 IU',
    form: 'capsule',
    color: 'amber',
    icon: 'sun',
    schedule: { kind: 'times', times: [soon] },
    windowMinutes: 45,
  });
  await addMedication({
    profileId: me.id,
    name: 'Ibuprofen',
    strength: '200 mg',
    form: 'tablet',
    color: 'red',
    icon: 'tablet',
    schedule: { kind: 'as-needed', maxPerDay: 4 },
    inventoryCount: 20,
  });
  await addMedication({
    profileId: mom.id,
    name: 'Lisinopril',
    strength: '10 mg',
    form: 'tablet',
    color: 'blue',
    icon: 'heart',
    schedule: { kind: 'times', times: ['09:00'], days: [1, 2, 3, 4, 5] },
    inventoryCount: 6,
    refillThreshold: 7,
  });

  // History: the previous 6 days, mostly taken, one skipped, one left unmarked.
  const tz = deviceTimeZone();
  const today = todayKey(tz);
  const start = addDaysToKey(today, -6);
  const history: Dose[] = [];
  for (const med of listMedications()) {
    const backdated = { ...med, createdAt: new Date(zonedInstant(start, '00:00', tz)).toISOString() };
    for (const dose of expandDoses(backdated, start, 6, tz)) {
      const i = history.length;
      const due = Date.parse(dose.dueAt);
      if (i % 9 === 4) history.push(dose);
      else if (i % 11 === 7) history.push({ ...dose, skippedAt: new Date(due + 5 * 60_000).toISOString() });
      else history.push({ ...dose, takenAt: new Date(due + ((i * 7) % 40) * 60_000).toISOString() });
    }
  }
  saveDoses(history);
  return { seeded: true };
}
