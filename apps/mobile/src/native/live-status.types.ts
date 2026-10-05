// Shared pieces of the dose-window status surfaces (iOS Live Activity, Android Live Update /
// ongoing notification): the event type every surface reports and the view model they render.
import { type ActiveWindow, effectiveTheme } from '@dosely/shared';

import { getDoses } from '@/data/doses-repo';
import { getMedication } from '@/data/medications-repo';
import { getProfile } from '@/data/profiles-repo';
import { getSettings } from '@/data/settings-repo';
import { todayKey } from '@/data/time';

import { SNOOZE_MINUTES } from './notifications';
import { dueLabel, widgetPalette, type WidgetPalette } from './widget-snapshot';

export type StatusActionSource = 'live-activity' | 'live-update' | 'notification';

/**
 * One event for every "do something with this dose" tap outside the app UI. `taken-all` /
 * `snooze` from the Live Activity apply to every open dose of the current window; notification
 * actions carry the dose ids of the reminder they came from.
 */
export type StatusAction = {
  action: 'taken' | 'snooze' | 'skip' | 'taken-all';
  doseId?: string;
  doseIds?: string[];
  source: StatusActionSource;
};

export type StatusActionListener = (event: StatusAction) => void;

export type DoseWindowView = {
  /** Stable key of the window (earliest due instant): a new key means a new Live Activity. */
  key: string;
  doseIds: string[];
  title: string;
  dueAt: string;
  dueLabel: string;
  endsAt: string;
  remaining: number;
  total: number;
  /** 0…1 share of the window already elapsed (Android progress). */
  elapsed: number;
  snoozeMinutes: number;
  palette: WidgetPalette;
};

/** Enriches the shared `ActiveWindow` with medication / profile names and theme colours. */
export function toDoseWindowView(window: ActiveWindow, now = Date.now()): DoseWindowView {
  const doses = getDoses(window.doseIds);
  const labels = doses.map((d) => {
    const med = getMedication(d.medicationId);
    const profile = getProfile(d.profileId);
    const name = med?.name ?? 'Medication';
    return profile && !profile.isSelf ? `${profile.name}: ${name}` : name;
  });
  const unique = [...new Set(labels)];
  const title = unique.length <= 2 ? unique.join(', ') : `${unique.slice(0, 2).join(', ')} +${unique.length - 2}`;
  const start = Date.parse(window.earliestDueAt);
  const end = Date.parse(window.latestWindowEndsAt);
  const settings = getSettings();
  return {
    key: window.earliestDueAt,
    doseIds: window.doseIds,
    title: title || 'Medication due',
    dueAt: window.earliestDueAt,
    dueLabel: dueLabel(window.earliestDueAt),
    endsAt: window.latestWindowEndsAt,
    remaining: window.remaining,
    total: window.total,
    elapsed: end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : 1,
    snoozeMinutes: SNOOZE_MINUTES,
    palette: widgetPalette(effectiveTheme(settings, todayKey())),
  };
}
