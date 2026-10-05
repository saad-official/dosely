// Caregiver circle API wrapper (`/api/circles*`) plus a cached view for `useCircle()`.
// Response types mirror apps/web/lib/services/{circles,today}.ts.
import type { DoseState } from '@dosely/shared';

import { ApiError, apiFetch } from './api';
import { isSignedIn } from './auth-client';
import { getAppValue, setAppValue } from './settings-repo';
import { createStore } from './store';
import { deviceTimeZone, todayKey } from './time';

export type CircleRole = 'member' | 'caregiver';
export type CircleMemberView = { userId: string; name: string; role: CircleRole; joinedAt: string };
export type CircleView = {
  id: string;
  /** The owner's account name (Better Auth `user.name`); missing from caches written by older builds. */
  ownerName: string;
  isOwner: boolean;
  role: CircleRole;
  /** Only the owner sees (and shares) the code. */
  inviteCode: string | null;
  createdAt: string;
  members: CircleMemberView[];
};

export type TodayDose = {
  id: string;
  medicationId: string;
  medicationName: string;
  strength: string | null;
  dueAt: string;
  state: DoseState;
  takenAt: string | null;
  skippedAt: string | null;
  snoozedUntil: string | null;
};
export type TodayProfile = { id: string; name: string; color: string; doses: TodayDose[] };
export type TodayMember = { userId: string; name: string; profiles: TodayProfile[] };
export type CircleTodayView = {
  circleId: string;
  /** The circle owner's account name (Better Auth `user.name`). */
  ownerName: string;
  /** When the circle was created (ISO). */
  createdAt: string;
  date: string;
  timeZone: string;
  generatedAt: string;
  members: TodayMember[];
};

export type CircleState = {
  circles: CircleView[];
  /** The circle the user owns (shares their doses with), if any. */
  own: CircleView | null;
  loading: boolean;
  error: string | null;
  updatedAt: string | null;
};

const CACHE_KEY = 'circles';

function stateFrom(circles: CircleView[], extra: Partial<CircleState> = {}): CircleState {
  return { circles, own: circles.find((c) => c.isOwner) ?? null, loading: false, error: null, updatedAt: null, ...extra };
}

/** Cached circles (persisted in settings so escalation and sync know offline whether a circle exists). */
export const circleStore = createStore<CircleState>(stateFrom([]));
let hydrated = false;

/** Loads the persisted cache once (after migrations). */
export function hydrateCircles(): void {
  if (hydrated) return;
  hydrated = true;
  const cached = getAppValue<{ circles: CircleView[]; updatedAt: string } | null>(CACHE_KEY, null);
  if (cached) circleStore.setState(stateFrom(cached.circles, { updatedAt: cached.updatedAt }));
}

function save(circles: CircleView[]): CircleView[] {
  const updatedAt = new Date().toISOString();
  setAppValue(CACHE_KEY, { circles, updatedAt });
  circleStore.setState(stateFrom(circles, { updatedAt }));
  return circles;
}

/** True when the cached circles say this user shares their own data with a circle. */
export function ownsCircle(): boolean {
  hydrateCircles();
  return circleStore.getSnapshot().own !== null;
}

/** GET /api/circles → refreshes the cache. Signed out → empty. */
export async function refreshCircles(): Promise<CircleView[]> {
  hydrateCircles();
  if (!(await isSignedIn())) return save([]);
  circleStore.setState((s) => ({ ...s, loading: true, error: null }));
  try {
    const { circles } = await apiFetch<{ circles: CircleView[] }>('/api/circles');
    return save(circles);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return save([]);
    circleStore.setState((s) => ({ ...s, loading: false, error: error instanceof Error ? error.message : String(error) }));
    throw error;
  }
}

/** POST /api/circles: creates (or returns) the caller's circle, whose invite code they share. */
export async function createCircle(profileName?: string): Promise<CircleView> {
  const { circle } = await apiFetch<{ circle: CircleView }>('/api/circles', { method: 'POST', body: { profileName } });
  await refreshCircles().catch(() => undefined);
  return circle;
}

/** POST /api/circles/join as a caregiver. Errors: 404 `circle_not_found`, 409 `own_circle` / `circle_full`. */
export async function joinCircle(code: string, profileName?: string): Promise<CircleView> {
  const { circle } = await apiFetch<{ circle: CircleView }>('/api/circles/join', { method: 'POST', body: { code, profileName } });
  await refreshCircles().catch(() => undefined);
  return circle;
}

/** Read-only "today" view of every member's doses (caregivers and owner). */
export async function getCircleToday(circleId: string, opts: { date?: string; tz?: string } = {}): Promise<CircleTodayView> {
  const tz = opts.tz ?? deviceTimeZone();
  return apiFetch<CircleTodayView>(`/api/circles/${encodeURIComponent(circleId)}/today`, {
    query: { tz, date: opts.date ?? todayKey(tz) },
  });
}

/** Owner stops sharing: deletes the circle and every mirrored row on the server. */
export async function deleteCircle(circleId: string): Promise<void> {
  await apiFetch(`/api/circles/${encodeURIComponent(circleId)}`, { method: 'DELETE' });
  await refreshCircles().catch(() => undefined);
}

/** Owner removes a caregiver, or a caregiver leaves (`userId` = their own id). */
export async function removeCircleMember(circleId: string, userId: string): Promise<void> {
  await apiFetch(`/api/circles/${encodeURIComponent(circleId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' });
  await refreshCircles().catch(() => undefined);
}

/** A caregiver leaves `circleId`. */
export async function leaveCircle(circleId: string, myUserId: string): Promise<void> {
  return removeCircleMember(circleId, myUserId);
}

/** Forget cached circles (sign-out). */
export function clearCircles(): void {
  save([]);
}
