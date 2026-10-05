// Profiles: the user ("self") and dependents. Soft deletes (`deletedAt`) so circles sync them.
import { initialFor, MED_COLOR_NAMES, type MedColor, type Profile, ProfileSchema } from '@dosely/shared';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { db } from './db';
import { fromProfile, newId, toProfile } from './mappers';
import { profiles } from './schema';
import { notifyTables } from './store';
import { nowIso } from './time';

/** `initial` defaults to `initialFor(name)`; `color` to the next palette colour. */
export type ProfileInput = { name: string; color?: MedColor; initial?: string; isSelf?: boolean };

/** Live profiles, self first, then by creation. */
export function listProfiles(): Profile[] {
  return db
    .select()
    .from(profiles)
    .where(isNull(profiles.deletedAt))
    .orderBy(desc(profiles.isSelf), asc(profiles.createdAt))
    .all()
    .map(toProfile);
}

export function getProfile(id: string): Profile | null {
  const row = db.select().from(profiles).where(eq(profiles.id, id)).get();
  return row ? toProfile(row) : null;
}

export function getSelfProfile(): Profile | null {
  const row = db
    .select()
    .from(profiles)
    .where(and(eq(profiles.isSelf, true), isNull(profiles.deletedAt)))
    .get();
  return row ? toProfile(row) : null;
}

export function createProfile(input: ProfileInput): Profile {
  const at = nowIso();
  const profile = ProfileSchema.parse({
    id: newId(),
    name: input.name,
    color: input.color ?? MED_COLOR_NAMES[listProfiles().length % MED_COLOR_NAMES.length],
    initial: input.initial ?? initialFor(input.name),
    isSelf: input.isSelf ?? false,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  });
  db.insert(profiles).values(fromProfile(profile)).run();
  notifyTables('profiles');
  return profile;
}

/** The "self" profile, created on first call (onboarding); its initial comes from `name`. */
export function ensureSelfProfile(name = 'Me'): Profile {
  return getSelfProfile() ?? createProfile({ name, isSelf: true });
}

export type ProfilePatch = Partial<Pick<Profile, 'name' | 'color' | 'initial'>>;

/** A new `name` without an explicit `initial` re-derives it (`initialFor`). */
export function updateProfile(id: string, patch: ProfilePatch): Profile {
  const current = getProfile(id);
  if (!current) throw new Error(`Profile ${id} not found`);
  const next = ProfileSchema.parse({
    ...current,
    ...patch,
    initial: patch.initial ?? (patch.name ? initialFor(patch.name) : current.initial),
    updatedAt: nowIso(),
  });
  db.update(profiles).set(fromProfile(next)).where(eq(profiles.id, id)).run();
  notifyTables('profiles');
  return next;
}

/**
 * Soft-deletes a dependent. Their medications and future unmarked doses are removed by
 * `deleteProfileCascade` in actions.ts (which also refreshes notifications); this only marks the row.
 */
export function markProfileDeleted(id: string): void {
  const at = nowIso();
  db.update(profiles).set({ deletedAt: at, updatedAt: at }).where(eq(profiles.id, id)).run();
  notifyTables('profiles');
}

/** Raw rows including tombstones (sync). */
export function allProfileRows(): Profile[] {
  return db.select().from(profiles).all().map(toProfile);
}

/** Writes pulled rows as-is (sync). */
export function putProfiles(rows: readonly Profile[]): void {
  if (!rows.length) return;
  db.transaction((tx) => {
    for (const p of rows) {
      const row = fromProfile(p);
      tx.insert(profiles).values(row).onConflictDoUpdate({ target: profiles.id, set: row }).run();
    }
  });
  notifyTables('profiles');
}
