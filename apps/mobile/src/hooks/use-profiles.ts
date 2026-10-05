import type { Profile } from '@dosely/shared';

import { getProfile, getSelfProfile, listProfiles } from '@/data/profiles-repo';
import { useLiveQuery } from '@/data/store';

const EMPTY: Profile[] = [];

/** Live profiles (self first, then dependents by creation). `[]` until the database is ready. */
export function useProfiles(): Profile[] {
  return useLiveQuery('profiles', ['profiles'], listProfiles, EMPTY);
}

/** One profile (tombstoned rows included, so check `deletedAt`), or null. */
export function useProfile(id: string | null | undefined): Profile | null {
  return useLiveQuery(`profile:${id ?? ''}`, ['profiles'], () => (id ? getProfile(id) : null), null);
}

/** The user's own profile, or null before onboarding creates it (`ensureSelfProfile`). */
export function useSelfProfile(): Profile | null {
  return useLiveQuery('profile:self', ['profiles'], getSelfProfile, null);
}
