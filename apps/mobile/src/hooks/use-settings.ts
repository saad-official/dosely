import { DEFAULT_SETTINGS, type Settings } from '@dosely/shared';

import { getSettings } from '@/data/settings-repo';
import { useLiveQuery } from '@/data/store';

/**
 * Current settings (shared `SettingsSchema`, defaults applied; `DEFAULT_SETTINGS` until the
 * database is ready). Write with `updateSettings(patch)` from `@/data/actions`, which also
 * switches the app icon and recolours widgets when the theme changes.
 */
export function useSettings(): Settings {
  return useLiveQuery('settings', ['settings'], getSettings, DEFAULT_SETTINGS);
}
