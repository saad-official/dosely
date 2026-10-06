// Local dose reminders (expo-notifications): permission flow, Android channels, the iOS `dose`
// category (Taken / Snooze 10 / Skip), a rolling 7-day set of scheduled notifications grouped per
// due instant, response decoding, and Expo push token registration for caregiver alerts.
import { type Dose, type Medication, type Profile } from '@dosely/shared';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Storage from 'expo-sqlite/kv-store';
import { Linking, Platform } from 'react-native';

import { getDoses, listDosesBetween } from '@/data/doses-repo';
import { listMedications } from '@/data/medications-repo';
import { listProfiles } from '@/data/profiles-repo';
import { formatClock } from '@/data/time';

// ---------------------------------------------------------------------------
// Identifiers

export const CATEGORY_DOSE = 'dose';
export const CHANNEL_DOSES = 'doses';
export const CHANNEL_CAREGIVER = 'caregiver-alerts';
/** Shared with expo-live-updates (`channelId` in app.json): the ongoing dose-window notification. */
export const CHANNEL_DOSE_WINDOW = 'doses-live';

export const ACTION_TAKEN = 'taken';
export const ACTION_SNOOZE = 'snooze';
export const ACTION_SKIP = 'skip';
export const SNOOZE_MINUTES = 10;

const DOSE_PREFIX = 'dose:';
const WINDOW_STATUS_ID = 'dose-window-status';
export const ROLLING_DAYS = 7;
/** iOS keeps at most 64 pending local notifications per app; leave room for the status one. */
const MAX_SCHEDULED = Platform.OS === 'ios' ? 60 : 150;

/** `content.data` of every notification Dosely posts or receives. */
export type DoselyNotificationData =
  | { kind: 'dose'; doseIds: string[]; dueAt: string; sig: string }
  | { kind: 'dose-window'; doseIds: string[] }
  | { kind: 'dose_missed'; circleId: string; doseIds?: string[]; url?: string };

export type DoseNotificationAction = 'taken' | 'snooze' | 'skip' | 'open';

export type DoseNotificationEvent = {
  action: DoseNotificationAction;
  doseIds: string[];
  /** Deep link to open for taps (`dosely://today`, `dosely://circle/:id`). */
  url: string | null;
};

// ---------------------------------------------------------------------------
// Setup

let setupPromise: Promise<void> | null = null;

/**
 * Idempotent: foreground presentation, Android channels and the `dose` category. Call at startup
 * (root layout) — every function below awaits it too.
 */
export function setupNotifications(): Promise<void> {
  if (!setupPromise) {
    Notifications.setNotificationHandler({
      handleNotification: async (n) => {
        const data = n.request.content.data as Partial<DoselyNotificationData> | undefined;
        const quiet = data?.kind === 'dose-window';
        return { shouldShowBanner: !quiet, shouldShowList: true, shouldPlaySound: !quiet, shouldSetBadge: false };
      },
    });
    setupPromise = (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_DOSES, {
          name: 'Dose reminders',
          description: 'A reminder when a medication is due, with Taken / Snooze / Skip.',
          importance: Notifications.AndroidImportance.HIGH,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
          vibrationPattern: [0, 250, 150, 250],
          enableVibrate: true,
        });
        await Notifications.setNotificationChannelAsync(CHANNEL_CAREGIVER, {
          name: 'Caregiver alerts',
          description: 'When someone in your circle has not marked a dose.',
          importance: Notifications.AndroidImportance.HIGH,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
        });
        // expo-live-updates creates this channel at default importance; the reminder already
        // chimed on `doses`, so the ongoing window status stays silent.
        await Notifications.setNotificationChannelAsync(CHANNEL_DOSE_WINDOW, {
          name: 'Dose window',
          description: 'Ongoing status while doses are due.',
          importance: Notifications.AndroidImportance.LOW,
          sound: null,
          vibrationPattern: null,
          enableVibrate: false,
          showBadge: false,
        });
      }
      await Notifications.setNotificationCategoryAsync(CATEGORY_DOSE, [
        { identifier: ACTION_TAKEN, buttonTitle: 'Taken', options: { opensAppToForeground: false } },
        { identifier: ACTION_SNOOZE, buttonTitle: `Snooze ${SNOOZE_MINUTES} min`, options: { opensAppToForeground: false } },
        { identifier: ACTION_SKIP, buttonTitle: 'Skip', options: { opensAppToForeground: false, isDestructive: true } },
      ]);
    })().catch((error) => {
      setupPromise = null;
      throw error;
    });
  }
  return setupPromise;
}

// ---------------------------------------------------------------------------
// Permission

export type NotificationPermission = {
  /** `granted` also covers iOS provisional authorisation. */
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
};

function toPermission(p: Notifications.NotificationPermissionsStatus): NotificationPermission {
  const iosStatus = p.ios?.status;
  const granted =
    p.granted ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL;
  return {
    status: granted ? 'granted' : p.status === 'undetermined' ? 'undetermined' : 'denied',
    canAskAgain: p.canAskAgain,
  };
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  return toPermission(await Notifications.getPermissionsAsync());
}

/**
 * Shows the OS prompt when it still can (call after the priming screen); otherwise returns the
 * current status so the UI can offer `openNotificationSettings()`. Reschedules on grant.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  await setupNotifications(); // Android 13+: a channel must exist before the prompt.
  const current = await getNotificationPermission();
  if (current.status === 'granted' || !current.canAskAgain) return current;
  const next = toPermission(
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    }),
  );
  if (next.status === 'granted') await rescheduleAll().catch(() => undefined);
  return next;
}

/** App settings page (notifications, and on Android 12+ "Alarms & reminders" for exact times). */
export function openNotificationSettings(): Promise<void> {
  return Linking.openSettings();
}

// ---------------------------------------------------------------------------
// Scheduling

type Planned = { identifier: string; date: number; content: Notifications.NotificationContentInput; sig: string };

const medLabel = (m: Medication | undefined) => (m ? (m.strength ? `${m.name} ${m.strength}` : m.name) : 'Medication');

function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** When an open dose should ring: its due time, or the end of an active snooze. */
function triggerAt(d: Dose, now: number): number | null {
  if (d.takenAt || d.skippedAt || d.deletedAt || d.source !== 'scheduled') return null;
  const snoozed = d.snoozedUntil ? Date.parse(d.snoozedUntil) : 0;
  const at = snoozed > now ? snoozed : Date.parse(d.dueAt);
  return at > now ? at : null;
}

function plan(doses: readonly Dose[], meds: readonly Medication[], profiles: readonly Profile[], now: number): Planned[] {
  const medById = new Map(meds.map((m) => [m.id, m]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const groups = new Map<number, Dose[]>();
  for (const d of doses) {
    const at = triggerAt(d, now);
    if (at === null || !medById.has(d.medicationId)) continue;
    groups.set(at, [...(groups.get(at) ?? []), d]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .slice(0, MAX_SCHEDULED)
    .map(([at, group]) => {
      const snoozed = group.every((d) => d.snoozedUntil && Date.parse(d.snoozedUntil) === at);
      const lines = group.map((d) => {
        const who = profileById.get(d.profileId);
        const label = medLabel(medById.get(d.medicationId));
        return who && !who.isSelf ? `${who.name}: ${label}` : label;
      });
      const first = medById.get(group[0]!.medicationId);
      const title =
        group.length === 1
          ? `${snoozed ? 'Reminder: ' : ''}Time for ${first?.name ?? 'your medication'}`
          : `${snoozed ? 'Reminder: ' : ''}${group.length} medications due`;
      const due = formatClock(group[0]!.dueAt);
      const body = group.length === 1 ? `${lines[0]} · due ${due}` : `${lines.join(', ')} · due ${due}`;
      const doseIds = group.map((d) => d.id);
      const sig = hash(`${at}|${doseIds.join(',')}|${title}|${body}`);
      const data: DoselyNotificationData = { kind: 'dose', doseIds, dueAt: group[0]!.dueAt, sig };
      return {
        identifier: `${DOSE_PREFIX}${at}`,
        date: at,
        sig,
        content: {
          title,
          body,
          data,
          sound: 'default',
          categoryIdentifier: CATEGORY_DOSE,
          interruptionLevel: 'timeSensitive',
          priority: Notifications.AndroidNotificationPriority.MAX,
          autoDismiss: true,
        },
      };
    });
}

let syncing: Promise<void> | null = null;
let again = false;

/**
 * Diffs the scheduled `dose:*` notifications against the doses table for the next 7 days and
 * cancels / schedules only what changed (grouped per due instant, summary body listing the meds).
 * Coalesces concurrent calls. No-op without permission.
 */
export function rescheduleAll(): Promise<void> {
  if (syncing) {
    again = true;
    return syncing;
  }
  syncing = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

/**
 * After a change to one medication. Groups can mix medications, so this runs the same diff as
 * `rescheduleAll` (only changed notifications are touched); `medId` is kept for call-site clarity.
 */
export function reschedule(_medId: string): Promise<void> {
  return rescheduleAll();
}

async function syncOnce(): Promise<void> {
  await setupNotifications();
  if ((await getNotificationPermission()).status !== 'granted') return;
  const now = Date.now();
  const from = new Date(now - 24 * 3600_000).toISOString(); // snoozed doses can be due earlier
  const until = new Date(now + ROLLING_DAYS * 24 * 3600_000).toISOString();
  const wanted = plan(listDosesBetween(from, until), listMedications(), listProfiles(), now);
  const wantedById = new Map(wanted.map((p) => [p.identifier, p]));

  const scheduled = (await Notifications.getAllScheduledNotificationsAsync()).filter((n) =>
    n.identifier.startsWith(DOSE_PREFIX),
  );
  const keep = new Set<string>();
  await Promise.all(
    scheduled.map(async (n) => {
      const data = n.content.data as Partial<DoselyNotificationData> | undefined;
      const want = wantedById.get(n.identifier);
      if (want && data && 'sig' in data && data.sig === want.sig) {
        keep.add(n.identifier);
        return;
      }
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined);
    }),
  );
  for (const p of wanted) {
    if (keep.has(p.identifier)) continue;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: p.identifier,
        content: p.content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date, channelId: CHANNEL_DOSES },
      });
    } catch (error) {
      console.warn('[notifications] schedule failed', p.identifier, error);
    }
  }
}

/** Removes delivered reminders of doses that are now marked (e.g. taken from the app). */
export async function dismissDeliveredFor(doseIds: readonly string[]): Promise<void> {
  if (!doseIds.length) return;
  const ids = new Set(doseIds);
  const presented = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  await Promise.all(
    presented
      .filter((n) => {
        const data = n.request.content.data as Partial<DoselyNotificationData> | undefined;
        if (data?.kind !== 'dose' || !Array.isArray(data.doseIds)) return false;
        const open = getDoses(data.doseIds).filter((d) => !d.takenAt && !d.skippedAt && !d.deletedAt);
        return data.doseIds.some((id) => ids.has(id)) && open.length === 0;
      })
      .map((n) => Notifications.dismissNotificationAsync(n.request.identifier).catch(() => undefined)),
  );
}

/** Cancels every scheduled dose reminder (sign-out of all data / delete all data). */
export async function cancelAllDoseNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(DOSE_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined)),
  );
}

// ---------------------------------------------------------------------------
// Ongoing dose-window notification (Android below 16; used by live-status.android.ts)

export async function presentDoseWindowNotification(input: { doseIds: string[]; title: string; body: string }): Promise<void> {
  await setupNotifications();
  const data: DoselyNotificationData = { kind: 'dose-window', doseIds: input.doseIds };
  await Notifications.scheduleNotificationAsync({
    identifier: WINDOW_STATUS_ID, // same id → replaced in place
    content: {
      title: input.title,
      body: input.body,
      data,
      sticky: true,
      autoDismiss: false,
      sound: false,
      priority: Notifications.AndroidNotificationPriority.LOW,
      categoryIdentifier: CATEGORY_DOSE,
    },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL_DOSE_WINDOW } : null,
  });
}

export async function dismissDoseWindowNotification(): Promise<void> {
  await Notifications.dismissNotificationAsync(WINDOW_STATUS_ID).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Responses (action buttons and taps)

const HANDLED_KEY = 'dosely.notifications.handled';

/** True the first time a given response is seen (listener, launch response and Android background task may all fire). */
function firstTime(response: Notifications.NotificationResponse): boolean {
  const key = `${response.notification.request.identifier}|${response.actionIdentifier}|${response.notification.date}`;
  try {
    const seen: string[] = JSON.parse(Storage.getItemSync(HANDLED_KEY) ?? '[]');
    if (seen.includes(key)) return false;
    Storage.setItemSync(HANDLED_KEY, JSON.stringify([...seen.slice(-49), key]));
  } catch {
    // best effort
  }
  return true;
}

export function toDoseNotificationEvent(response: Notifications.NotificationResponse): DoseNotificationEvent | null {
  const data = (response.notification.request.content.data ?? {}) as Partial<DoselyNotificationData> & { url?: string };
  const id = response.actionIdentifier;
  const doseIds = 'doseIds' in data && Array.isArray(data.doseIds) ? data.doseIds.filter((x) => typeof x === 'string') : [];
  if (id === ACTION_TAKEN || id === ACTION_SNOOZE || id === ACTION_SKIP) {
    return doseIds.length ? { action: id, doseIds, url: null } : null;
  }
  if (id === Notifications.DEFAULT_ACTION_IDENTIFIER) {
    const url =
      typeof data.url === 'string'
        ? data.url
        : data.kind === 'dose_missed' && data.circleId
          ? `dosely://circle/${data.circleId}`
          : data.kind === 'dose' || data.kind === 'dose-window'
            ? 'dosely://today'
            : null;
    return { action: 'open', doseIds, url };
  }
  return null;
}

/** Decodes a response once (deduped across listener / launch / background task). */
export function claimNotificationResponse(response: Notifications.NotificationResponse): DoseNotificationEvent | null {
  const event = toDoseNotificationEvent(response);
  if (!event || !firstTime(response)) return null;
  // Android leaves the notification up after a background action; clear it.
  if (event.action !== 'open') {
    Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => undefined);
  }
  return event;
}

const responseListeners = new Set<(event: DoseNotificationEvent) => void>();
let responseSub: { remove(): void } | null = null;

/**
 * Action buttons and taps on Dosely notifications while JS runs. One native subscription fans out
 * to every listener, so each response is claimed once and every listener sees it. Returns unsubscribe.
 */
export function addNotificationResponseListener(listener: (event: DoseNotificationEvent) => void): () => void {
  responseListeners.add(listener);
  if (!responseSub) {
    responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const event = claimNotificationResponse(response);
      if (event) responseListeners.forEach((l) => l(event));
    });
  }
  return () => {
    responseListeners.delete(listener);
    if (!responseListeners.size) {
      responseSub?.remove();
      responseSub = null;
    }
  };
}

/** Taps that should navigate (`dosely://today`, `dosely://circle/:id`). Returns unsubscribe. */
export function addNotificationOpenListener(listener: (url: string) => void): () => void {
  return addNotificationResponseListener((event) => {
    if (event.action === 'open' && event.url) listener(event.url);
  });
}

/** The response that cold-launched the app (e.g. "Taken" while the app was killed), handled once. */
export async function consumeLaunchNotificationResponse(): Promise<DoseNotificationEvent | null> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return null;
  await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  return claimNotificationResponse(response);
}

/** Fires when a dose reminder arrives while the app is open (to refresh the Live Activity / widgets). */
export function addDoseNotificationReceivedListener(listener: () => void): () => void {
  const sub = Notifications.addNotificationReceivedListener((n) => {
    const data = n.request.content.data as Partial<DoselyNotificationData> | undefined;
    if (data?.kind === 'dose') listener();
  });
  return () => sub.remove();
}

// ---------------------------------------------------------------------------
// Expo push token (caregiver alerts)

export type PushRegistration =
  | { ok: true; token: string; platform: 'ios' | 'android' }
  | { ok: false; reason: 'not-a-device' | 'unsupported' | 'permission-denied' | 'missing-project-id' | 'error'; message?: string };

/** EAS project id from app config (`extra.eas.projectId`), or null before `eas init`. */
export function getEasProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

/** Expo push token for `POST /api/devices`. Never throws; never prompts unless `prompt` is true. */
export async function getPushRegistration(opts: { prompt?: boolean } = {}): Promise<PushRegistration> {
  try {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return { ok: false, reason: 'unsupported' };
    if (!Device.isDevice) return { ok: false, reason: 'not-a-device' };
    const projectId = getEasProjectId();
    if (!projectId) return { ok: false, reason: 'missing-project-id' };
    const permission = opts.prompt ? await requestNotificationPermission() : await getNotificationPermission();
    if (permission.status !== 'granted') return { ok: false, reason: 'permission-denied' };
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { ok: true, token: data, platform: Platform.OS };
  } catch (error) {
    return { ok: false, reason: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}
