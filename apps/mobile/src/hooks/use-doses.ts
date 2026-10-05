import type { DayKey } from '@dosely/shared';

import { useLiveQuery } from '@/data/store';
import { useClockTick, useToday } from '@/data/time';
import { doseView, dosesForDay, type DoseView } from '@/data/views';

const EMPTY: DoseView[] = [];
const DOSE_TABLES = ['doses', 'medications', 'profiles', 'settings'] as const;

/**
 * Today's doses (scheduled + as-needed logs), by due time, each with `state`
 * (`upcoming | due | late | missed | taken | skipped | snoozed`), its medication and profile.
 * States re-evaluate every 30 s and the list rolls over at local midnight.
 */
export function useTodayDoses(profileId?: string | null): DoseView[] {
  const today = useToday();
  const tick = useClockTick();
  return useLiveQuery(
    `today:${profileId ?? ''}`,
    DOSE_TABLES,
    () => dosesForDay(today, profileId ?? undefined),
    EMPTY,
    `${today}|${tick}`,
  );
}

/** Doses due on any local day (History). States re-evaluate every 30 s. */
export function useDosesForDay(dayKey: DayKey, profileId?: string | null): DoseView[] {
  const tick = useClockTick();
  return useLiveQuery(
    `day:${dayKey}:${profileId ?? ''}`,
    DOSE_TABLES,
    () => dosesForDay(dayKey, profileId ?? undefined),
    EMPTY,
    String(tick),
  );
}

/** One dose with live state, or null. */
export function useDose(id: string | null | undefined): DoseView | null {
  const tick = useClockTick();
  return useLiveQuery(`dose:${id ?? ''}`, DOSE_TABLES, () => (id ? doseView(id) : null), null, String(tick));
}
