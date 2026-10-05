import { effectiveTheme, type ThemeId } from '@dosely/shared';

import { useToday } from '@/data/time';

import { useSettings } from './use-settings';

/**
 * The theme to render now: the manual pick, or the date's season when "switch automatically by
 * date" is on (shared `effectiveTheme`). Re-evaluated at local midnight and on settings changes.
 */
export function useEffectiveTheme(): ThemeId {
  const settings = useSettings();
  const today = useToday();
  return effectiveTheme(settings, today);
}
