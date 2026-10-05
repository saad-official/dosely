// What the home-screen / Lock Screen widgets show, built from SQLite (also from headless JS).
import { type Dose, doseState, effectiveTheme, MED_PALETTE, resolveThemeColors, type ThemeId } from '@dosely/shared';

import { listDosesBetween } from '@/data/doses-repo';
import { listMedications } from '@/data/medications-repo';
import { listProfiles } from '@/data/profiles-repo';
import { getSettings } from '@/data/settings-repo';
import { dayBounds, deviceTimeZone, formatClock, todayKey } from '@/data/time';

export type WidgetSnapshot = {
  nextDose?: { medName: string; dueAt: string; profileName: string };
  todayTaken: number;
  todayTotal: number;
  themeId: ThemeId;
};

/** Theme colours a widget needs, for both schemes (the widget picks by `colorScheme`). */
export type WidgetColors = { surface: string; text: string; textSecondary: string; accent: string; accentText: string; track: string };
export type WidgetPalette = { light: WidgetColors; dark: WidgetColors };

export function widgetPalette(themeId: ThemeId): WidgetPalette {
  const pick = (scheme: 'light' | 'dark'): WidgetColors => {
    const c = resolveThemeColors(themeId, scheme);
    return {
      surface: c.surfaceElevated,
      text: c.text,
      textSecondary: c.textSecondary,
      accent: c.accent,
      accentText: c.accentText,
      track: c.surfaceSunken,
    };
  };
  return { light: pick('light'), dark: pick('dark') };
}

export const medColorHex = (name: string | undefined): string =>
  MED_PALETTE.find((c) => c.name === name)?.hex ?? MED_PALETTE[0].hex;

/**
 * The next open scheduled dose (due now or later, or snoozed), today's progress and the theme,
 * as they will look at `at` (default now) if nothing else gets marked.
 */
export function buildWidgetSnapshot(at: number = Date.now()): WidgetSnapshot {
  const tz = deviceTimeZone();
  const now = new Date(at).toISOString();
  const settings = getSettings();
  const today = todayKey(tz, at);
  const { start, end } = dayBounds(today, tz);
  const meds = new Map(listMedications(undefined, { includeArchived: true }).map((m) => [m.id, m]));
  const profiles = new Map(listProfiles().map((p) => [p.id, p]));
  const todays = listDosesBetween(start, end).filter((d) => d.source === 'scheduled');
  const horizon = new Date(at + 8 * 24 * 3600_000).toISOString();
  const upcoming = listDosesBetween(start, horizon).filter(
    (d) => d.source === 'scheduled' && ['upcoming', 'due', 'snoozed'].includes(doseState(d, now, settings.escalationMinutes)),
  );
  const next: Dose | undefined = upcoming[0];
  const med = next ? meds.get(next.medicationId) : undefined;
  return {
    nextDose:
      next && med
        ? { medName: med.name, dueAt: next.dueAt, profileName: profiles.get(next.profileId)?.name ?? '' }
        : undefined,
    todayTaken: todays.filter((d) => d.takenAt).length,
    todayTotal: todays.length,
    themeId: effectiveTheme(settings, today),
  };
}

/** Instants after now when the widget content changes by itself (a dose window opens or closes). */
export function upcomingChangeInstants(limit = 12): number[] {
  const now = Date.now();
  const horizon = new Date(now + 2 * 24 * 3600_000).toISOString();
  const instants = listDosesBetween(new Date(now - 24 * 3600_000).toISOString(), horizon)
    .filter((d) => d.source === 'scheduled' && !d.takenAt && !d.skippedAt)
    .flatMap((d) => [Date.parse(d.dueAt), Date.parse(d.windowEndsAt)])
    .filter((t) => t > now);
  return [...new Set(instants)].sort((a, b) => a - b).slice(0, limit);
}

export const dueLabel = (iso: string) => formatClock(iso);
