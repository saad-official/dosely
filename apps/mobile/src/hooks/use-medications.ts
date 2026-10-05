import { useLiveQuery } from '@/data/store';
import { useToday } from '@/data/time';
import { medicationView, medicationViews, type MedicationView } from '@/data/views';

const EMPTY: MedicationView[] = [];

/**
 * Live medications with refill maths (`perDay`, `daysLeft`, `refillDate`, `needsRefill`), oldest
 * first; one profile's when `profileId` is given. Archived ones only with `includeArchived`.
 */
export function useMedications(profileId?: string | null, opts: { includeArchived?: boolean } = {}): MedicationView[] {
  const includeArchived = !!opts.includeArchived;
  const today = useToday();
  return useLiveQuery(
    `meds:${profileId ?? ''}:${includeArchived}`,
    ['medications'],
    () => medicationViews(profileId ?? undefined, { includeArchived }),
    EMPTY,
    today,
  );
}

/** One medication (archived / deleted included: check `archivedAt` / `deletedAt`), or null. */
export function useMedication(id: string | null | undefined): MedicationView | null {
  const today = useToday();
  return useLiveQuery(`med:${id ?? ''}`, ['medications'], () => (id ? medicationView(id) : null), null, today);
}
