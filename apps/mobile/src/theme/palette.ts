// Resolves a theme id + colour scheme into the colours the UI paints with. Pure (no React), memoised,
// so the same theme object is shared by every consumer and by previews of other themes.
import {
  resolveThemeColors,
  SHADOW_COLOR,
  shadows,
  THEMES,
  type ColorPalette,
  type ColorScheme,
  type Motif,
  type ShadowLevel,
  type ThemeId,
} from '@dosely/shared';

export type ThemeColors = ColorPalette & {
  /** Inverted surface for toasts. */
  inverseSurface: string;
  inverseText: string;
  /** Action text on the inverse surface (the toast "Undo"). */
  inverseAccent: string;
  /** Dimmed backdrop behind transient overlays. */
  scrim: string;
  /** Unfilled part of the progress ring and empty day squares. */
  track: string;
  /** Low-contrast tints for the seasonal motif layer (never painted behind text). */
  motifPrimary: string;
  motifSecondary: string;
};

export type AppTheme = {
  themeId: ThemeId;
  name: string;
  motif: Motif;
  scheme: ColorScheme;
  isDark: boolean;
  colors: ThemeColors;
  /** CSS `boxShadow` for an elevation level (never legacy shadow props). */
  shadow: (level: ShadowLevel) => string;
};

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `#RRGGBB` + alpha → `rgba(...)`: translucent tints derived from theme roles. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const SHADOW_RGB = rgb(SHADOW_COLOR).join(', ');
const cache = new Map<string, AppTheme>();

export function buildAppTheme(themeId: ThemeId, scheme: ColorScheme): AppTheme {
  const key = `${themeId}:${scheme}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const meta = THEMES[themeId] ?? THEMES.default;
  const base = resolveThemeColors(meta.id, scheme);
  const inverse = resolveThemeColors(meta.id, scheme === 'dark' ? 'light' : 'dark');
  const isDark = scheme === 'dark';
  const colors: ThemeColors = {
    ...base,
    inverseSurface: inverse.surfaceElevated,
    inverseText: inverse.text,
    inverseAccent: inverse.accentText,
    scrim: `rgba(${SHADOW_RGB}, ${isDark ? 0.6 : 0.35})`,
    track: base.surfaceSunken,
    motifPrimary: withAlpha(base.accent, isDark ? 0.32 : 0.24),
    motifSecondary: withAlpha(isDark ? base.accentText : base.accentPressed, isDark ? 0.2 : 0.15),
  };
  const levels = shadows[scheme];
  const theme: AppTheme = {
    themeId: meta.id,
    name: meta.name,
    motif: meta.motif,
    scheme,
    isDark,
    colors,
    shadow: (level) => {
      const s = levels[level];
      return `${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.spread}px rgba(${SHADOW_RGB}, ${s.opacity})`;
    },
  };
  cache.set(key, theme);
  return theme;
}
