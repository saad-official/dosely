import { adherenceFor, type AdherenceRange, type AdherenceReport } from '@/data/adherence';
import { useLiveQuery } from '@/data/store';
import { useClockTick } from '@/data/time';

export { lastDays, type AdherenceRange, type AdherenceReport } from '@/data/adherence';

const TABLES = ['doses', 'medications', 'settings'] as const;

/**
 * Adherence over an inclusive range of local days (shared `weeklySummary`, `streak`,
 * `onTimeRate`): per-day tallies, per-medication tallies with streaks, the range total and the
 * on-time share. `lastDays(7)` is "this week". Only scheduled doses count. Null until the database
 * is ready.
 */
export function useAdherence(range: AdherenceRange, profileId?: string | null): AdherenceReport | null {
  const tick = useClockTick();
  const { from, to } = range;
  return useLiveQuery(
    `adherence:${from}:${to}:${profileId ?? ''}`,
    TABLES,
    () => adherenceFor({ from, to }, profileId ?? undefined),
    null,
    String(tick),
  );
}
