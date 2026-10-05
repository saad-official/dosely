// Alternate app icons per theme (expo-alternate-app-icons). The only place icons are switched.
// app.json registers one alternate per non-default theme, named in PascalCase from APP_ICONS
// (`icon-new-year` → `IconNewYear`); the default theme restores the primary icon (null).
import { APP_ICONS, type ThemeId } from '@dosely/shared';
import { getAppIconName, setAlternateAppIcon, supportsAlternateIcons as nativeSupports } from 'expo-alternate-app-icons';

/** `icon-new-year` → `IconNewYear` (the plugin's naming). */
export function alternateIconName(themeId: ThemeId): string | null {
  if (themeId === 'default') return null;
  return APP_ICONS[themeId]
    .split(/[-_\s]+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join('');
}

export function supportsAlternateIcons(): boolean {
  try {
    return nativeSupports;
  } catch {
    return false;
  }
}

/** Icon currently shown: the alternate's name, or null for the primary icon. */
export function currentAppIcon(): string | null {
  try {
    return getAppIconName();
  } catch {
    return null;
  }
}

/**
 * Switches the home-screen icon to the theme's icon. No-op when already set or unsupported.
 * iOS shows a system alert on change; on Android the launcher may take a moment (activity-alias).
 */
export async function applyAppIcon(themeId: ThemeId): Promise<{ changed: boolean }> {
  if (!supportsAlternateIcons()) return { changed: false };
  const target = alternateIconName(themeId);
  if (currentAppIcon() === target) return { changed: false };
  try {
    await setAlternateAppIcon(target);
    return { changed: true };
  } catch (error) {
    console.warn('[app-icon] setAlternateAppIcon failed', error);
    return { changed: false };
  }
}
