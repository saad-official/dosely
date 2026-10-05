// Routes Taken / Snooze / Skip / Taken-all from notifications, the Live Activity and the Live Update
// into actions.ts. Started at JS entry (index.ts) so presses that wake the app in the background are
// handled even when no screen is mounted.
import { skipDoses, snoozeDoses, takeDoses } from '@/data/actions';
import { ensureDatabaseReady } from '@/data/migrate';
import { createStore } from '@/data/store';

import { haptics } from './haptics';
import { addStatusActionListener, type StatusAction } from './live-status';
import { consumeLaunchNotificationResponse, SNOOZE_MINUTES } from './notifications';
import { currentActiveWindow } from './surfaces';

/** Applies one status action. Exported for the Android background notification task. */
export async function handleStatusAction(event: StatusAction): Promise<void> {
  await ensureDatabaseReady();
  let ids = event.doseIds?.length ? event.doseIds : event.doseId ? [event.doseId] : [];
  // Live Activity buttons act on the window as it is now (marks may have changed since it started).
  if (event.action === 'taken-all' || (event.source === 'live-activity' && !ids.length)) {
    ids = currentActiveWindow()?.doseIds ?? ids;
  }
  if (!ids.length) return;
  switch (event.action) {
    case 'taken':
    case 'taken-all':
      await takeDoses(ids);
      haptics.taken();
      break;
    case 'snooze':
      await snoozeDoses(ids, SNOOZE_MINUTES);
      break;
    case 'skip':
      await skipDoses(ids);
      break;
  }
}

/** A notification tap that should navigate, received before the UI subscribed (cold launch). */
export const pendingOpenUrl = createStore<string | null>(null);

let started = false;

/** Idempotent. Subscribes the unified listener and handles the response that launched the app. */
export function startStatusActionHandling(): void {
  if (started) return;
  started = true;
  addStatusActionListener((event) => {
    handleStatusAction(event).catch((e) => console.warn('[status-actions] failed', event.action, e));
  });
  consumeLaunchNotificationResponse()
    .then(async (event) => {
      if (!event) return;
      if (event.action === 'open') {
        if (event.url) pendingOpenUrl.setState(event.url);
        return;
      }
      await handleStatusAction({ action: event.action, doseIds: event.doseIds, source: 'notification' });
    })
    .catch(() => undefined);
}

/** Returns (and clears) the deep link of the notification that opened the app, if any. */
export function takePendingOpenUrl(): string | null {
  const url = pendingOpenUrl.getSnapshot();
  if (url) pendingOpenUrl.setState(null);
  return url;
}
