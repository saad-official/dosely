// Android: Live Update (expo-live-updates) on Android 16+, an ongoing notification below that.
import type { ActiveWindow } from '@dosely/shared';
import { addNotificationStateChangeListener, startLiveUpdate, stopLiveUpdate, updateLiveUpdate } from 'expo-live-updates';
// The package index does not re-export its state/config types.
import type { LiveUpdateConfig, LiveUpdateState } from 'expo-live-updates/build/types';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

import { notificationStatusListener } from './live-status.shared';
import { type DoseWindowView, type StatusActionListener, timeLeftLabel, toDoseWindowView } from './live-status.types';
import {
  dismissDoseWindowNotification,
  getNotificationPermission,
  presentDoseWindowNotification,
} from './notifications';

export type { DoseWindowView, StatusAction, StatusActionListener, StatusActionSource } from './live-status.types';

// Live Updates exist from API 36 (promoted to the status-bar chip on 36.1+; on 36.0 they render as
// a regular ongoing notification, which is still right). Older versions get our own notification.
const LIVE_UPDATES_MIN_API = 36;
const usesLiveUpdates = () => Number(Platform.Version) >= LIVE_UPDATES_MIN_API;
const PROGRESS_MAX = 100;

// The notification id must survive an app kill, or the Live Update could never be stopped.
const STATE_KEY = 'dosely.liveUpdate.window';
type Stored = { id: number; key: string; doseIds: string[] };

function stored(): Stored | null {
  try {
    const raw = Storage.getItemSync(STATE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function remember(value: Stored | null): void {
  try {
    if (value) Storage.setItemSync(STATE_KEY, JSON.stringify(value));
    else Storage.removeItemSync(STATE_KEY);
  } catch {
    // best effort
  }
}

function toLiveUpdate(v: DoseWindowView): { state: LiveUpdateState; config: LiveUpdateConfig } {
  const minutesLeft = Math.max(0, Math.ceil((Date.parse(v.endsAt) - Date.now()) / 60_000));
  return {
    state: {
      title: v.title,
      text: `due ${v.dueLabel} · ${timeLeftLabel(v.endsAt)}`,
      subText: v.total > 1 ? `${v.total - v.remaining} of ${v.total} taken` : undefined,
      progress: { max: PROGRESS_MAX, progress: Math.round(v.elapsed * PROGRESS_MAX) },
      // Status-bar chip (≤ 7 characters).
      shortCriticalText: `${minutesLeft}m`,
      showTime: true,
      time: Date.parse(v.endsAt),
    },
    config: { deepLinkUrl: 'dosely://today', iconBackgroundColor: v.palette.light.accent },
  };
}

function stopStored(): void {
  const prev = stored();
  if (prev) {
    try {
      stopLiveUpdate(prev.id);
    } catch {
      // already gone
    }
  }
  remember(null);
}

async function fallbackNotification(v: DoseWindowView): Promise<void> {
  await presentDoseWindowNotification({
    doseIds: v.doseIds,
    title: v.title,
    body: `due ${v.dueLabel} · ${timeLeftLabel(v.endsAt)}`,
  });
}

export async function syncDoseWindow(window: ActiveWindow | null): Promise<void> {
  if (!window) {
    stopStored();
    await dismissDoseWindowNotification();
    return;
  }
  if ((await getNotificationPermission()).status !== 'granted') return;
  const view = toDoseWindowView(window);
  if (!usesLiveUpdates()) {
    await fallbackNotification(view);
    return;
  }
  const { state, config } = toLiveUpdate(view);
  const prev = stored();
  if (prev && prev.key === view.key) {
    try {
      updateLiveUpdate(prev.id, state, config);
      remember({ ...prev, doseIds: view.doseIds });
      return;
    } catch (error) {
      console.warn('[live-status] updateLiveUpdate failed; restarting', error);
    }
  }
  stopStored();
  try {
    const id = startLiveUpdate(state, config);
    if (typeof id === 'number') remember({ id, key: view.key, doseIds: view.doseIds });
    else await fallbackNotification(view);
  } catch (error) {
    console.warn('[live-status] startLiveUpdate failed; using an ongoing notification', error);
    await fallbackNotification(view);
  }
}

/**
 * Live Update taps open `dosely://today` (no action buttons in expo-live-updates 0.1), so its
 * events carry no dose action; the reminder notification's Taken / Snooze / Skip and the fallback
 * notification's actions arrive through the notification listener.
 */
export function addStatusActionListener(listener: StatusActionListener): () => void {
  const liveSub = addNotificationStateChangeListener((event) => {
    if (event.action === 'dismissed' && stored()?.id === event.notificationId) remember(null);
  });
  const removeNotifications = notificationStatusListener(listener);
  return () => {
    liveSub?.remove();
    removeNotifications();
  };
}
