import type { ThemeId } from '@dosely/shared';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useEffectiveTheme } from '@/hooks/use-effective-theme';

import { buildAppTheme } from './palette';
import { ThemeContext } from './theme-context';

/**
 * Theme engine root. `useEffectiveTheme()` (manual pick, or the date's season when "switch
 * automatically" is on; re-evaluated at local midnight) + the colour scheme (system, or the
 * Appearance override from Settings) → `resolveThemeColors` → one context value. A theme change
 * goes through `updateSettings({ theme })`: settings re-render this provider, key surfaces
 * cross-fade via `useAnimatedColor`, the Today motif swaps, and the data layer swaps the app icon.
 */
export function AppThemeProvider({ children, themeId }: { children: ReactNode; themeId?: ThemeId }) {
  const effective = useEffectiveTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = buildAppTheme(themeId ?? effective, scheme);
  return <ThemeContext value={theme}>{children}</ThemeContext>;
}
