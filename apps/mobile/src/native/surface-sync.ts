// One call from the root layout starts everything native: `startNativeServices()`.
// Headless entry points (background task, Android widget handler, notification / Live Activity
// actions) are registered separately at JS entry (native/entry.ts, imported by index.ts).
import { syncAppIconWithTheme } from '@/data/actions';
import { hydrateCircles, refreshCircles } from '@/data/circles-client';
import { registerPushDevice } from '@/data/devices';
import { ensureDatabaseReady } from '@/data/migrate';
import { hydrateSyncStatus, syncNow } from '@/data/sync-client';
import { todayStore } from '@/data/time';

import { registerBackgroundTasks } from './background';
import { addNotificationOpenListener, setupNotifications } from './notifications';
import { takePendingOpenUrl } from './status-actions';
import { refreshSurfaces, runMaintenance, startSurfaceWatcher } from './surfaces';

export { refreshSurfaces as syncNativeSurfaces, runMaintenance } from './surfaces';

let boot: Promise<void> | null = null;

/**
 * Idempotent start sequence: migrate, notification channels / categories, background task
 * registration, expand 7 days of doses + reschedule reminders + Live Activity / Live Update +
 * widgets + escalation report, align the app icon with the effective theme, then (when signed in)
 * refresh circles, register the push token and sync.
 */
export function initializeNativeServices(): Promise<void> {
  if (!boot) {
    boot = (async () => {
      await ensureDatabaseReady();
      hydrateCircles();
      hydrateSyncStatus();
      await setupNotifications().catch((e) => console.warn('[surface-sync] notification setup failed', e));
      await registerBackgroundTasks();
      await runMaintenance().catch((e) => console.warn('[surface-sync] maintenance failed', e));
      await syncAppIconWithTheme().catch(() => undefined);
      void (async () => {
        await refreshCircles().catch(() => undefined);
        await registerPushDevice().catch(() => undefined);
        await syncNow();
      })();
    })().catch((error) => {
      boot = null;
      throw error;
    });
  }
  return boot;
}

export type NativeServicesOptions = {
  /**
   * A notification tap that should navigate: `dosely://today` for dose reminders / the dose
   * window, `dosely://circle/:id` for caregiver alerts. Typically `(url) => router.push(url)`;
   * expo-router also handles these links on its own when the OS opens them.
   */
  onOpenUrl?: (url: string) => void;
};

/**
 * Root layout: `useEffect(() => (db.success ? startNativeServices({ onOpenUrl }) : undefined), [db.success])`.
 * Runs `initializeNativeServices`, then while mounted: re-checks the dose window every 30 s in the
 * foreground (so the Live Activity starts at due time), runs maintenance on every return to the
 * foreground and at local midnight (expand, reschedule, icon for the new day's season), and
 * forwards notification taps to `onOpenUrl`. Returns a cleanup function.
 */
export function startNativeServices(opts: NativeServicesOptions = {}): () => void {
  let disposed = false;
  initializeNativeServices()
    .then(() => {
      if (disposed) return;
      const pending = takePendingOpenUrl();
      if (pending) opts.onOpenUrl?.(pending);
    })
    .catch((e) => console.warn('[surface-sync] start failed', e));

  const stopWatcher = startSurfaceWatcher();
  const offOpen = addNotificationOpenListener((url) => opts.onOpenUrl?.(url));

  let day = todayStore.getSnapshot();
  const offDay = todayStore.subscribe(() => {
    const next = todayStore.getSnapshot();
    if (next === day) return;
    day = next;
    runMaintenance()
      .then(() => syncAppIconWithTheme())
      .then(() => refreshSurfaces({ skipNotifications: true }))
      .catch(() => undefined);
  });

  return () => {
    disposed = true;
    stopWatcher();
    offOpen();
    offDay();
  };
}
