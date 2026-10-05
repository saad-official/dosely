import { useLiveQuery } from '@/data/store';
import { useToday } from '@/data/time';
import { medicationView, medicationViews, type MedicationView } from '@/data/views';

const EMPTY: MedicationView[] = [];
// Doses too: `asNeededToday` / `asNeededRemaining` change when an as-needed dose is logged or undone.
const MED_TABLES = ['medications', 'doses'] as const;

/**
 * Live medications with refill maths (`perDay`, `daysLeft`, `refillDate`, `needsRefill`) and today's
 * as-needed use (`asNeededToday`, `asNeededRemaining`), oldest first; one profile's when `profileId`
 * is given. Archived ones only with `includeArchived`.
 */
export function useMedications(profileId?: string | null, opts: { includeArchived?: boolean } = {}): MedicationView[] {
  const includeArchived = !!opts.includeArchived;
  const today = useToday();
  return useLiveQuery(
    `meds:${profileId ?? ''}:${includeArchived}`,
    MED_TABLES,
    () => medicationViews(profileId ?? undefined, { includeArchived }),
    EMPTY,
    today,
  );
}

/** One medication (archived / deleted included: check `archivedAt` / `deletedAt`), or null. */
export function useMedication(id: string | null | undefined): MedicationView | null {
  const today = useToday();
  return useLiveQuery(`med:${id ?? ''}`, MED_TABLES, () => (id ? medicationView(id) : null), null, today);
}
