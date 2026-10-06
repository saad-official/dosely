// Resolves a theme id + colour scheme into the colours the UI paints with. Pure (no React), memoised,
// so the same theme object is shared by every consumer and by previews of other themes.
import {
  colors as baseColors,
  resolveThemeColors,
  SHADOW_COLORS,
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
  /**
   * Neutral fill that reads on the page and on cards in both schemes: the unfilled ring, step bars,
   * skeletons, empty day squares, unselected chips, neutral pills and disabled buttons.
   * (`surfaceSunken` is ~1.05:1 against the dark page, so fills made from it vanished.)
   */
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

/** Opaque blend of two `#RRGGBB` colours (`t` = 0 → `a`, 1 → `b`). */
export function mix(a: string, b: string, t: number): string {
  const ca = rgb(a);
  const cb = rgb(b);
  return `#${ca
    .map((v, i) => Math.round(v + (cb[i]! - v) * t).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio of two `#RRGGBB` colours. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The candidate with the highest contrast on `bg` (text on a computed fill). */
export function readableOn(bg: string, candidates: readonly string[]): string {
  return candidates.reduce((best, c) => (contrastRatio(c, bg) > contrastRatio(best, bg) ? c : best));
}

/**
 * Glyphs and initials on a medication colour swatch: white on the deep swatches, ink on the light
 * ones (amber, orange, teal read badly with white).
 */
export function onSwatchFor(hex: string): string {
  return readableOn(hex, ['#FFFFFF', baseColors.light.text]);
}

/**
 * Motif strength, as the contrast a particle should have against the page. Calibrated per theme
 * (a gold accent needs more ink than a red one to be equally visible), and kept opaque so the
 * overlapping parts of a heart or a maple leaf never double up into darker blotches.
 */
const MOTIF_CONTRAST = {
  primary: { light: 1.4, dark: 1.5 },
  secondary: { light: 1.2, dark: 1.28 },
  /** String-light bulbs: a little brighter, they are meant to glow. */
  bulb: { light: 1.6, dark: 1.75 },
  /** The theme gallery's motif chip: a preview, never behind text. */
  chip: { light: 2, dark: 2.3 },
} as const;
export type MotifStrength = keyof typeof MOTIF_CONTRAST;

/** `color` blended into `surface` until it reaches the motif contrast for `strength`. */
export function motifTint(color: string, surface: string, strength: MotifStrength = 'primary'): string {
  const target = MOTIF_CONTRAST[strength][luminance(surface) < 0.2 ? 'dark' : 'light'];
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 12; i++) {
    const t = (lo + hi) / 2;
    if (contrastRatio(mix(surface, color, t), surface) < target) lo = t;
    else hi = t;
  }
  return mix(surface, color, Math.min(0.85, Math.max(0.08, hi)));
}

const cache = new Map<string, AppTheme>();

export function buildAppTheme(themeId: ThemeId, scheme: ColorScheme): AppTheme {
  const key = `${themeId}:${scheme}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const meta = THEMES[themeId] ?? THEMES.default;
  const base = resolveThemeColors(meta.id, scheme);
  const inverse = resolveThemeColors(meta.id, scheme === 'dark' ? 'light' : 'dark');
  const isDark = scheme === 'dark';
  const shadowRgb = rgb(SHADOW_COLORS[scheme]).join(', ');
  const colors: ThemeColors = {
    ...base,
    // In dark mode the inverse is a soft light grey, never a glaring pure-white slab.
    inverseSurface: isDark ? inverse.surfaceSunken : inverse.surfaceElevated,
    inverseText: inverse.text,
    inverseAccent: inverse.accentText,
    scrim: `rgba(${shadowRgb}, ${isDark ? 0.6 : 0.35})`,
    // A quiet neutral that still reads on the page itself (surfaceSunken is ~1.05:1 there, so an
    // empty ring, step bar or skeleton vanished).
    track: mix(base.surface, base.text, isDark ? 0.13 : 0.1),
    motifPrimary: motifTint(base.accent, base.surface, 'primary'),
    motifSecondary: motifTint(isDark ? base.accentText : base.accentPressed, base.surface, 'secondary'),
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
      return `${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.spread}px rgba(${shadowRgb}, ${s.opacity})`;
    },
  };
  cache.set(key, theme);
  return theme;
}
