// One theme entry point: `import { spacing, useTheme, textStyles } from '@/theme'`.
// Values come from `@dosely/shared/tokens` (+ seasonal overrides from `themes.ts`); this folder only
// resolves them for React Native: colour scheme, effective seasonal theme, Reanimated easings.
import { Platform, StyleSheet } from 'react-native';

export { fontWeight, motion, radius, shadows, spacing, type } from '@dosely/shared/tokens';
export type { ColorScheme, RadiusToken, ShadowLevel, SpacingToken, TypeToken } from '@dosely/shared/tokens';
export { cssEasing, easing, springs } from './motion';
export {
  buildAppTheme,
  contrastRatio,
  mix,
  motifTint,
  onSwatchFor,
  readableOn,
  withAlpha,
  type AppTheme,
  type MotifStrength,
  type ThemeColors,
} from './palette';
export { AppThemeProvider } from './theme-provider';
export { ThemeContext, useTheme } from './theme-context';
export { CHROME_FONT_CAP, tabular, textStyles, typeStyle } from './typography';
export { useAnimatedColor } from './use-animated-color';

/** One device pixel: list separators only. */
export const hairline = StyleSheet.hairlineWidth;

/** Minimum touch target (HIG 44 pt / Material 48 dp). */
export const touchTarget = Platform.select({ android: 48, default: 44 });

/** Dose actions (Taken, Snooze, Log a dose) are bigger: tired hands, older eyes. */
export const doseTarget = 56;
