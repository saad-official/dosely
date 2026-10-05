// Keeps every system surface in line with the doses table: scheduled reminders, the dose-window
// Live Activity / Live Update, and widgets. Actions call `refreshSurfaces` after each write; the root
// layout calls `startSurfaceWatcher` so the Live Activity starts at due time while the app is open.
import { activeWindow, type ActiveWindow } from '@dosely/shared';
import { AppState, type AppStateStatus } from 'react-native';

import { listDosesBetween } from '@/data/doses-repo';
import { ensureDosesExpanded } from '@/data/expand';
import { isDatabaseReady } from '@/data/store';
import { nowIso } from '@/data/time';

import { reportMissedDoses } from './escalation';
import { syncDoseWindow } from './live-status';
import { addDoseNotificationReceivedListener, dismissDeliveredFor, reschedule, rescheduleAll } from './notifications';
import { refreshWidgetsFromDatabase } from './widgets';

/** The shared `activeWindow` over doses around now. */
export function currentActiveWindow(): ActiveWindow | null {
  const now = Date.now();
  const doses = listDosesBetween(new Date(now - 24 * 3600_000).toISOString(), new Date(now + 60_000).toISOString());
  return activeWindow(doses, nowIso());
}

let lastWindowKey: string | null | undefined;

/** Shows / updates / ends the dose-window surface; reports missed doses when a window closes. */
export async function refreshDoseWindow(): Promise<void> {
  const window = currentActiveWindow();
  const key = window ? `${window.earliestDueAt}|${window.doseIds.join(',')}` : null;
  await syncDoseWindow(window).catch((e) => console.warn('[surfaces] syncDoseWindow failed', e));
  if (!window && lastWindowKey) await reportMissedDoses();
  lastWindowKey = key;
}

type RefreshOptions = { medId?: string; doseIds?: string[]; skipNotifications?: boolean };

let chain: Promise<void> = Promise.resolve();

/**
 * Reschedules reminders (diffed, for `medId` or all), syncs the dose-window surface and refreshes
 * widgets. Calls are serialised; failures are logged, never thrown.
 */
export function refreshSurfaces(opts: RefreshOptions = {}): Promise<void> {
  chain = chain.then(async () => {
    if (!isDatabaseReady()) return;
    const jobs: Promise<unknown>[] = [];
    if (!opts.skipNotifications) jobs.push(opts.medId ? reschedule(opts.medId) : rescheduleAll());
    if (opts.doseIds?.length) jobs.push(dismissDeliveredFor(opts.doseIds));
    jobs.push(refreshDoseWindow());
    jobs.push(refreshWidgetsFromDatabase());
    const results = await Promise.allSettled(jobs);
    for (const r of results) if (r.status === 'rejected') console.warn('[surfaces] refresh failed', r.reason);
  });
  return chain;
}

/** Daily / launch maintenance: expand 7 days of doses, then refresh everything and report misses. */
export async function runMaintenance(): Promise<void> {
  ensureDosesExpanded();
  await refreshSurfaces();
  await reportMissedDoses();
}

let watcher: { stop(): void } | null = null;

/**
 * While the app is in the foreground: re-check the dose window every 30 s (so the Live Activity
 * starts at due time and ends when the window closes) and run maintenance on every return to the
 * foreground. Returns a stop function. Idempotent.
 */
export function startSurfaceWatcher(): () => void {
  if (watcher) return watcher.stop;
  let timer: ReturnType<typeof setInterval> | null = null;
  const startTimer = () => {
    if (timer) return;
    timer = setInterval(() => {
      refreshDoseWindow().catch(() => undefined);
      reportMissedDoses().catch(() => undefined);
    }, 30_000);
  };
  const stopTimer = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  const onChange = (state: AppStateStatus) => {
    if (state === 'active') {
      startTimer();
      runMaintenance().catch(() => undefined);
    } else {
      stopTimer();
    }
  };
  const appSub = AppState.addEventListener('change', onChange);
  const removeReceived = addDoseNotificationReceivedListener(() => {
    refreshSurfaces({ skipNotifications: true }).catch(() => undefined);
  });
  if (AppState.currentState === 'active') onChange('active');
  watcher = {
    stop: () => {
      stopTimer();
      appSub.remove();
      removeReceived();
      watcher = null;
    },
  };
  return watcher.stop;
}
