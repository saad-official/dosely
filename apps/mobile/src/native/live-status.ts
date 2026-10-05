// Default (web) implementation: no system status surface, but notification actions still flow
// through `addStatusActionListener`. iOS: live-status.ios.ts, Android: live-status.android.ts.
import type { ActiveWindow } from '@dosely/shared';

import { notificationStatusListener } from './live-status.shared';
import type { StatusActionListener } from './live-status.types';

export type { DoseWindowView, StatusAction, StatusActionListener, StatusActionSource } from './live-status.types';

/**
 * Shows, updates or ends the dose-window surface: iOS Live Activity `DoseWindow`, Android 16 Live
 * Update, or an ongoing notification below Android 16. `null` ends it.
 */
export async function syncDoseWindow(_window: ActiveWindow | null): Promise<void> {}

/** Unified Taken / Snooze / Skip / Taken-all events from every surface. Returns unsubscribe. */
export function addStatusActionListener(listener: StatusActionListener): () => void {
  return notificationStatusListener(listener);
}
