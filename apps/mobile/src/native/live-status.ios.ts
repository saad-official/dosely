// iOS: dose-window Live Activity (`DoseWindow`, expo-widgets) on the Lock Screen / Dynamic Island.
import type { ActiveWindow } from '@dosely/shared';
import Storage from 'expo-sqlite/kv-store';
import { addUserInteractionListener, type LiveActivity } from 'expo-widgets';

import DoseWindowActivity, { type DoseWindowActivityProps } from '@/widgets/dose-window.activity';

import { notificationStatusListener } from './live-status.shared';
import { type DoseWindowView, type StatusActionListener, toDoseWindowView } from './live-status.types';

export type { DoseWindowView, StatusAction, StatusActionListener, StatusActionSource } from './live-status.types';

// Survives app restarts: Live Activities outlive the JS runtime.
const STATE_KEY = 'dosely.liveActivity.window';

type Stored = { key: string; doseIds: string[] };

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

function toProps(v: DoseWindowView): DoseWindowActivityProps {
  const pick = (c: DoseWindowView['palette']['light']) => ({
    surface: c.surface,
    text: c.text,
    textSecondary: c.textSecondary,
    accent: c.accent,
    accentText: c.accentText,
  });
  return {
    title: v.title,
    dueLabel: v.dueLabel,
    dueAtMs: Date.parse(v.dueAt),
    endsAtMs: Date.parse(v.endsAt),
    remaining: v.remaining,
    total: v.total,
    snoozeMinutes: v.snoozeMinutes,
    palette: { light: pick(v.palette.light), dark: pick(v.palette.dark) },
  };
}

function instances(): LiveActivity<DoseWindowActivityProps>[] {
  try {
    return DoseWindowActivity.getInstances();
  } catch {
    return [];
  }
}

async function endAll(): Promise<void> {
  await Promise.all(instances().map((a) => a.end('immediate').catch(() => undefined)));
  remember(null);
}

export async function syncDoseWindow(window: ActiveWindow | null): Promise<void> {
  if (!window) {
    await endAll();
    return;
  }
  const view = toDoseWindowView(window);
  const props = toProps(view);
  const staleDate = new Date(Date.parse(view.endsAt));
  const prev = stored();
  const [current, ...extra] = instances();
  await Promise.all(extra.map((a) => a.end('immediate').catch(() => undefined)));
  if (current && prev?.key === view.key) {
    try {
      await current.update(props, staleDate);
      remember({ key: view.key, doseIds: view.doseIds });
      return;
    } catch (error) {
      console.warn('[live-status] Live Activity update failed', error);
    }
  }
  if (current) await current.end('immediate').catch(() => undefined);
  try {
    // Starting needs the app in the foreground (no push-to-start in v0.1).
    DoseWindowActivity.start(props, 'dosely://today', staleDate);
    remember({ key: view.key, doseIds: view.doseIds });
  } catch (error) {
    // Live Activities off in Settings, iOS < 16.2, app in background, or the system limit.
    console.warn('[live-status] Live Activity start failed', error);
    remember(null);
  }
}

export function addStatusActionListener(listener: StatusActionListener): () => void {
  const sub = addUserInteractionListener((event) => {
    // Targets are unique to the DoseWindow activity (`source` naming differs between widget kinds).
    if (event.target !== 'taken-all' && event.target !== 'snooze') return;
    const doseIds = stored()?.doseIds ?? [];
    listener({ action: event.target, doseId: doseIds[0], doseIds, source: 'live-activity' });
  });
  const removeNotifications = notificationStatusListener(listener);
  return () => {
    sub.remove();
    removeNotifications();
  };
}
