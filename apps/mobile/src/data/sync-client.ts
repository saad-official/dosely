// Circle sync: pushes rows dirtied since the last push and pulls rows changed on the server, using
// shared `diffDirty` / `applyPull` (last write wins) against `/api/sync/push|pull`
// (wire contract: apps/web/lib/sync/contract.ts). Only circle owners sync: health data leaves the
// phone only when the user shares it with a caregiver circle.
import {
  applyPull,
  diffDirty,
  type Dose,
  DoseSchema,
  type Medication,
  MedicationSchema,
  type Profile,
  ProfileSchema,
  rowVersion,
  type SyncRow,
} from '@dosely/shared';

import { refreshSurfaces } from '@/native/surfaces';

import { ApiError, apiFetch } from './api';
import { isSignedIn } from './auth-client';
import { ownsCircle } from './circles-client';
import { allDoseRows, saveDoses } from './doses-repo';
import { allMedicationRows, putMedications } from './medications-repo';
import { allProfileRows, putProfiles } from './profiles-repo';
import { createStore } from './store';
import { getAppValue, setAppValue } from './settings-repo';
import { getDeviceId, getSyncState, pullCursor, setPulledAt, setPushedUpTo, SYNCED_TABLES } from './sync-state-repo';

const MAX_PUSH_ROWS = 2000;

// ---------------------------------------------------------------------------
// Wire rows (contract.ts)

type WireBase = { id: string; createdAt: string; updatedAt: string; deletedAt: string | null };
type WireProfile = WireBase & { name: string; color: string; avatarInitial: string | null };
type WireMedication = WireBase & {
  profileId: string;
  name: string;
  strength: string | null;
  form: string | null;
  instructions: string | null;
  color: string | null;
  schedule: unknown;
  windowMinutes: number;
  inventoryCount: number | null;
  refillThreshold: number | null;
};
type WireDose = WireBase & {
  medicationId: string;
  dueAt: string;
  takenAt: string | null;
  skippedAt: string | null;
  snoozedUntil: string | null;
  source: string;
};
type WireTables = { profiles: WireProfile[]; medications: WireMedication[]; doses: WireDose[] };

const base = (r: { id: string; createdAt: string; updatedAt: string; deletedAt?: string | null }): WireBase => ({
  id: r.id,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  deletedAt: r.deletedAt ?? null,
});

// The server stores whole counts; inventory may be fractional on the device (half tablets).
const wholeCount = (n: number | null | undefined) => (n === null || n === undefined ? null : Math.max(0, Math.round(n)));

const toWireProfile = (p: Profile): WireProfile => ({ ...base(p), name: p.name, color: p.color, avatarInitial: p.initial });
const toWireMedication = (m: Medication): WireMedication => ({
  ...base(m),
  profileId: m.profileId,
  name: m.name,
  strength: m.strength ?? null,
  form: m.form,
  instructions: m.instructions ?? null,
  color: m.color,
  schedule: m.schedule,
  windowMinutes: m.windowMinutes,
  inventoryCount: wholeCount(m.inventoryCount),
  refillThreshold: wholeCount(m.refillThreshold),
});
const toWireDose = (d: Dose): WireDose => ({
  ...base(d),
  medicationId: d.medicationId,
  dueAt: d.dueAt,
  takenAt: d.takenAt ?? null,
  skippedAt: d.skippedAt ?? null,
  snoozedUntil: d.snoozedUntil ?? null,
  source: d.source,
});

// Pulled rows: fields the wire lacks come from the local copy (icon, archive, isSelf) or are derived.
function fromWireProfile(w: WireProfile, local?: Profile): Profile | null {
  const r = ProfileSchema.safeParse({
    ...w,
    initial: w.avatarInitial ?? (w.name.trim()[0] ?? '?').toUpperCase(),
    isSelf: local?.isSelf ?? false,
    color: w.color,
  });
  return r.success ? r.data : null;
}

function fromWireMedication(w: WireMedication, local?: Medication): Medication | null {
  const r = MedicationSchema.safeParse({
    ...w,
    form: w.form ?? local?.form ?? 'other',
    color: w.color ?? local?.color ?? 'teal',
    icon: local?.icon ?? 'pill',
    archivedAt: local?.archivedAt ?? null,
  });
  return r.success ? r.data : null;
}

function fromWireDose(w: WireDose, meds: Map<string, Medication>, local?: Dose): Dose | null {
  const med = meds.get(w.medicationId);
  if (!med && !local) return null;
  const windowMs = (med?.windowMinutes ?? 60) * 60_000;
  const r = DoseSchema.safeParse({
    ...w,
    profileId: med?.profileId ?? local?.profileId,
    windowEndsAt: local && local.dueAt === w.dueAt ? local.windowEndsAt : new Date(Date.parse(w.dueAt) + windowMs).toISOString(),
    source: w.source === 'as-needed' ? 'as-needed' : 'scheduled',
  });
  return r.success ? r.data : null;
}

// ---------------------------------------------------------------------------
// Status store (for UI)

export type SyncStatus = { running: boolean; lastSyncAt: string | null; error: string | null };
export const syncStatus = createStore<SyncStatus>({ running: false, lastSyncAt: null, error: null });
let statusHydrated = false;

/** Loads the last sync time / error persisted in settings (after migrations). */
export function hydrateSyncStatus(): void {
  if (statusHydrated) return;
  statusHydrated = true;
  syncStatus.setState({
    running: false,
    lastSyncAt: getAppValue<string | null>('lastSyncAt', null),
    error: getAppValue<string | null>('lastSyncError', null),
  });
}

// ---------------------------------------------------------------------------
// Push / pull

const maxVersion = (rows: readonly SyncRow[]) =>
  rows.reduce((max, r) => Math.max(max, rowVersion(r)), 0);

/**
 * POST /api/sync/push with every row changed since that table's last accepted push (shared
 * `diffDirty` against `sync_state.pushed_up_to`). Returns how many rows the server accepted.
 * 403 `no_circle` (not sharing) is not an error: nothing is sent.
 */
export async function pushDirty(): Promise<{ pushed: number; accepted: number }> {
  const profiles = diffDirty(allProfileRows(), getSyncState('profiles').pushedUpTo);
  const medications = diffDirty(allMedicationRows(), getSyncState('medications').pushedUpTo);
  const doses = diffDirty(allDoseRows(), getSyncState('doses').pushedUpTo);
  const total = profiles.length + medications.length + doses.length;
  if (!total) return { pushed: 0, accepted: 0 };
  const deviceId = getDeviceId();
  let accepted = 0;
  const pages = Math.max(1, Math.ceil(Math.max(profiles.length, medications.length, doses.length) / MAX_PUSH_ROWS));
  for (let i = 0; i < pages; i++) {
    const slice = <T>(xs: T[]) => xs.slice(i * MAX_PUSH_ROWS, (i + 1) * MAX_PUSH_ROWS);
    const tables: WireTables = {
      profiles: slice(profiles).map(toWireProfile),
      medications: slice(medications).map(toWireMedication),
      doses: slice(doses).map(toWireDose),
    };
    try {
      const res = await apiFetch<{ serverTime: string; accepted: number }>('/api/sync/push', {
        method: 'POST',
        body: { deviceId, tables },
      });
      accepted += res.accepted;
    } catch (error) {
      if (error instanceof ApiError && error.status === 403 && error.code === 'no_circle') return { pushed: 0, accepted: 0 };
      throw error;
    }
  }
  // Only after every page succeeded: a failed push is simply re-sent next time (the server is idempotent).
  const mark = (table: (typeof SYNCED_TABLES)[number], rows: readonly SyncRow[]) => {
    if (rows.length) setPushedUpTo(table, new Date(maxVersion(rows)).toISOString());
  };
  mark('profiles', profiles);
  mark('medications', medications);
  mark('doses', doses);
  return { pushed: total, accepted };
}

/** GET /api/sync/pull?since=<cursor>, merged last-write-wins (shared `applyPull`) into local tables. */
export async function pullSince(): Promise<{ applied: number }> {
  const since = pullCursor();
  const res = await apiFetch<{ serverTime: string; tables: Partial<WireTables> }>('/api/sync/pull', {
    query: { since: since ?? undefined },
  });
  const pulled = { profiles: res.tables.profiles ?? [], medications: res.tables.medications ?? [], doses: res.tables.doses ?? [] };

  const localProfiles = allProfileRows();
  const profileById = new Map(localProfiles.map((p) => [p.id, p]));
  const profileRows = pulled.profiles.flatMap((w) => fromWireProfile(w, profileById.get(w.id)) ?? []);
  const p = applyPull(localProfiles, profileRows);
  putProfiles(p.rows.filter((r) => p.applied.includes(r.id)));

  const localMeds = allMedicationRows();
  const medById = new Map(localMeds.map((m) => [m.id, m]));
  const medRows = pulled.medications.flatMap((w) => fromWireMedication(w, medById.get(w.id)) ?? []);
  const m = applyPull(localMeds, medRows);
  putMedications(m.rows.filter((r) => m.applied.includes(r.id)));

  const medsNow = new Map(allMedicationRows().map((x) => [x.id, x]));
  const localDoses = allDoseRows();
  const doseById = new Map(localDoses.map((d) => [d.id, d]));
  const doseRows = pulled.doses.flatMap((w) => fromWireDose(w, medsNow, doseById.get(w.id)) ?? []);
  const d = applyPull(localDoses, doseRows);
  saveDoses(d.rows.filter((r) => d.applied.includes(r.id)));

  setPulledAt(SYNCED_TABLES, res.serverTime);
  return { applied: p.applied.length + m.applied.length + d.applied.length };
}

let running: Promise<void> | null = null;

/** Push then pull, when signed in and sharing with a circle. Single-flight; never throws. */
export function syncNow(): Promise<void> {
  if (running) return running;
  running = (async () => {
    try {
      if (!(await isSignedIn()) || !ownsCircle()) return;
      syncStatus.setState((s) => ({ ...s, running: true, error: null }));
      await pushDirty();
      const { applied } = await pullSince();
      const at = new Date().toISOString();
      setAppValue('lastSyncAt', at);
      setAppValue('lastSyncError', undefined);
      syncStatus.setState({ running: false, lastSyncAt: at, error: null });
      if (applied) {
        // Pulled marks or schedule changes: bring reminders and surfaces in line.
        await refreshSurfaces();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAppValue('lastSyncError', message);
      syncStatus.setState((s) => ({ ...s, running: false, error: message }));
    } finally {
      running = null;
    }
  })();
  return running;
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Debounced `syncNow` after local writes (actions call this). */
export function scheduleSync(delayMs = 4000): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, delayMs);
}
