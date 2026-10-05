import type { Appearance as AppearancePreference, ThemeId } from '@dosely/shared';
import { type ReactNode, useEffect } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { useEffectiveTheme } from '@/hooks/use-effective-theme';
import { useSettings } from '@/hooks/use-settings';

import { buildAppTheme } from './palette';
import { ThemeContext } from './theme-context';

/** Pushes the Settings override to React Native so native views and `useColorScheme()` follow it. */
function applyAppearance(pref: AppearancePreference) {
  Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
}

/**
 * Theme engine root. `useEffectiveTheme()` (manual pick, or the date's season when "switch
 * automatically" is on; re-evaluated at local midnight) + the colour scheme (shared
 * `Settings.appearance`: the system scheme, or a forced light / dark) → `resolveThemeColors` → one
 * context value. A theme change goes through `updateSettings({ theme })` and an appearance change
 * through `updateSettings({ appearance })`: settings re-render this provider, key surfaces
 * cross-fade via `useAnimatedColor`, the Today motif swaps, and the data layer swaps the app icon.
 */
export function AppThemeProvider({ children, themeId }: { children: ReactNode; themeId?: ThemeId }) {
  const effective = useEffectiveTheme();
  const { appearance } = useSettings();
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  // Resolve the forced scheme here as well, so the first frame after a change is already right.
  const scheme = appearance === 'system' ? system : appearance;
  useEffect(() => applyAppearance(appearance), [appearance]);
  const theme = buildAppTheme(themeId ?? effective, scheme);
  return <ThemeContext value={theme}>{children}</ThemeContext>;
}
