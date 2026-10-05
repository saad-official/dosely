import { useLiveQuery } from '@/data/store';
import { useClockTick } from '@/data/time';
import { activeDoseWindow, type ActiveDoseWindow } from '@/data/views';

/**
 * The open dose window right now (shared `activeWindow`: scheduled doses whose
 * `[dueAt, windowEndsAt)` contains now and are not yet taken / skipped), with dose details;
 * null when nothing is due. Re-evaluated every 30 s and after every write.
 */
export function useActiveWindow(): ActiveDoseWindow | null {
  const tick = useClockTick();
  return useLiveQuery(
    'active-window',
    ['doses', 'medications', 'profiles', 'settings'],
    activeDoseWindow,
    null,
    String(tick),
  );
}
