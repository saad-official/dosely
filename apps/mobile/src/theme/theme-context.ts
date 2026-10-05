import { createContext, use } from 'react';

import { buildAppTheme, type AppTheme } from './palette';

export const ThemeContext = createContext<AppTheme>(buildAppTheme('default', 'light'));

/**
 * The resolved theme: the effective seasonal theme (manual pick or auto-by-date) in the current
 * colour scheme, with its motif. Referentially stable per theme + scheme.
 */
export function useTheme(): AppTheme {
  return use(ThemeContext);
}
