// Alternate app icons per theme (expo-alternate-app-icons). The only place icons are switched.
// app.json registers one alternate per non-default theme, named in PascalCase from APP_ICONS
// (`icon-new-year` → `IconNewYear`); the default theme restores the primary icon (null).
import { APP_ICONS, type ThemeId } from '@dosely/shared';
import { getAppIconName, setAlternateAppIcon, supportsAlternateIcons as nativeSupports } from 'expo-alternate-app-icons';
import { AppState, Platform } from 'react-native';

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

// ---------------------------------------------------------------------------
// Deferred switching (Android)
//
// On Android an alternate icon is an <activity-alias>: enabling it disables the current launcher
// component, which closes the app's task on the spot. Switching while the user is looking at the
// screen therefore feels like a crash. So on Android the swap waits until the app is in the
// background; iOS switches immediately (the system shows its own confirmation alert).

let pendingTheme: ThemeId | null = null;
let appStateSub: { remove(): void } | null = null;

async function flushPendingIcon(): Promise<void> {
  const theme = pendingTheme;
  pendingTheme = null;
  appStateSub?.remove();
  appStateSub = null;
  if (theme) await applyAppIcon(theme);
}

/** Switches the icon now on iOS; on Android, the next time the app goes to the background. */
export async function applyAppIconWhenIdle(themeId: ThemeId): Promise<{ changed: boolean; deferred: boolean }> {
  if (Platform.OS !== 'android') {
    const r = await applyAppIcon(themeId);
    return { ...r, deferred: false };
  }
  if (!supportsAlternateIcons()) return { changed: false, deferred: false };
  if (currentAppIcon() === alternateIconName(themeId)) {
    pendingTheme = null;
    return { changed: false, deferred: false };
  }
  pendingTheme = themeId;
  if (AppState.currentState !== 'active') {
    await flushPendingIcon();
    return { changed: true, deferred: false };
  }
  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') void flushPendingIcon();
    });
  }
  return { changed: false, deferred: true };
}
