/**
 * Dosely design tokens: one source for the Expo app (`apps/mobile/src/theme`)
 * and the web (`toCssVars` -> `apps/web/app/globals.css`). Pure data, no deps.
 *
 * Identity: calm clinical-soft, premium, accessible. Ink text on cool soft
 * surfaces, a teal accent, semantic colours that stay legible (danger marks
 * missed doses), a large type scale with generous line heights and gentle
 * motion. Numbers are unitless (points on mobile, CSS px on the web).
 *
 * Seasonal palettes are partial overrides of `colors` and live in `themes.ts`.
 */

export type ColorScheme = "light" | "dark";

export type ColorRole =
  | "surface"
  | "surfaceElevated"
  | "surfaceSunken"
  | "text"
  | "textSecondary"
  | "textTertiary"
  | "accent"
  | "accentPressed"
  | "accentSoft"
  | "accentText"
  | "onAccent"
  | "success"
  | "successSoft"
  | "warning"
  | "warningSoft"
  | "danger"
  | "dangerSoft"
  | "onDanger"
  | "separator"
  | "border";

export type ColorPalette = Record<ColorRole, string>;

export const colors = {
  light: {
    /** Cool soft white: the page and screen background. */
    surface: "#F7F9F9",
    /** Cards, sheets, grouped rows. */
    surfaceElevated: "#FFFFFF",
    /** Wells, inputs, inset lists. */
    surfaceSunken: "#EBF0F1",
    /** Ink. */
    text: "#1C2430",
    textSecondary: "#4D5866",
    /** Placeholders and disabled labels only (not body copy). */
    textTertiary: "#7C8794",
    /** Teal: fills, primary buttons, progress rings. Use `accentText` for small text. */
    accent: "#1FA39A",
    accentPressed: "#198C84",
    accentSoft: "#DDF2EF",
    /** Teal that reads as text and links on light surfaces (WCAG AA). */
    accentText: "#0B6E67",
    /** Text and icons on an accent fill. */
    onAccent: "#0B1D1C",
    success: "#1B7348",
    successSoft: "#DFF3E7",
    warning: "#8A5A00",
    warningSoft: "#FBEFD5",
    /** Missed doses. */
    danger: "#B3261E",
    dangerSoft: "#FBE4E1",
    onDanger: "#FFFFFF",
    separator: "#DFE5E7",
    border: "#C9D2D6",
  },
  dark: {
    surface: "#101417",
    surfaceElevated: "#1A2025",
    surfaceSunken: "#0A0D0F",
    text: "#EEF3F4",
    textSecondary: "#A6B1BA",
    textTertiary: "#6F7B85",
    accent: "#3BC4BA",
    accentPressed: "#5BD2C9",
    accentSoft: "#123532",
    accentText: "#5FD3CA",
    onAccent: "#06201E",
    success: "#4CC98A",
    successSoft: "#12301F",
    warning: "#E8B04B",
    warningSoft: "#33270F",
    danger: "#FF7B70",
    dangerSoft: "#3A1715",
    onDanger: "#2A0603",
    separator: "#252D33",
    border: "#36414A",
  },
} as const satisfies Record<ColorScheme, ColorPalette>;

/** 4-pt spacing scale. */
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export type SpacingToken = keyof typeof spacing;

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
export type RadiusToken = keyof typeof radius;

/** React Native `fontWeight` strings; valid CSS `font-weight` values too. */
export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;
export type FontWeight = (typeof fontWeight)[keyof typeof fontWeight];

export type TextStyleToken = {
  fontSize: number;
  lineHeight: number;
  fontWeight: FontWeight;
  /** Tracking in points/px (RN `letterSpacing`). */
  letterSpacing: number;
};

/**
 * Large, readable scale (SF Pro / Roboto on device; scales with Dynamic Type
 * and Android font scale). Line heights are generous for older eyes.
 */
export const type = {
  display: { fontSize: 40, lineHeight: 48, fontWeight: fontWeight.semibold, letterSpacing: -0.8 },
  title: { fontSize: 28, lineHeight: 36, fontWeight: fontWeight.semibold, letterSpacing: -0.4 },
  headline: { fontSize: 22, lineHeight: 30, fontWeight: fontWeight.semibold, letterSpacing: -0.2 },
  body: { fontSize: 17, lineHeight: 26, fontWeight: fontWeight.regular, letterSpacing: -0.1 },
  callout: { fontSize: 15, lineHeight: 22, fontWeight: fontWeight.regular, letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.medium, letterSpacing: 0.1 },
} as const satisfies Record<string, TextStyleToken>;
export type TypeToken = keyof typeof type;

export type SpringConfig = { damping: number; stiffness: number; mass: number };
export type Bezier = readonly [number, number, number, number];

export const motion = {
  /** Milliseconds. */
  duration: { fast: 150, base: 250, slow: 400 },
  /** Cubic-bezier control points (CSS `cubic-bezier()`, Reanimated `Easing.bezier`). */
  easing: {
    standard: [0.2, 0, 0, 1],
    exit: [0.3, 0, 1, 1],
  },
  /** Reanimated `withSpring` configs. Calm: no overshoot-heavy bounces. */
  spring: {
    /** Buttons, toggles, the Taken check. */
    gentle: { damping: 20, stiffness: 180, mass: 1 },
    /** Sheets, cards, the progress ring. */
    soft: { damping: 24, stiffness: 110, mass: 1 },
  },
} as const satisfies {
  duration: Record<string, number>;
  easing: Record<string, Bezier>;
  spring: Record<string, SpringConfig>;
};

export type ShadowToken = {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  /** Shadow colour is always ink (`SHADOW_COLOR`); opacity carries the weight. */
  opacity: number;
  /** Android elevation equivalent. */
  elevation: number;
};

export const SHADOW_COLOR = "#1C2430";

/** Soft, diffuse shadows. Dark mode leans on elevated surfaces, so shadows are deeper but rarer. */
export const shadows = {
  light: {
    sm: { offsetX: 0, offsetY: 1, blur: 3, spread: 0, opacity: 0.06, elevation: 1 },
    md: { offsetX: 0, offsetY: 8, blur: 24, spread: -6, opacity: 0.12, elevation: 4 },
    lg: { offsetX: 0, offsetY: 24, blur: 48, spread: -16, opacity: 0.2, elevation: 12 },
  },
  dark: {
    sm: { offsetX: 0, offsetY: 1, blur: 3, spread: 0, opacity: 0.4, elevation: 1 },
    md: { offsetX: 0, offsetY: 8, blur: 24, spread: -6, opacity: 0.5, elevation: 4 },
    lg: { offsetX: 0, offsetY: 24, blur: 48, spread: -16, opacity: 0.6, elevation: 12 },
  },
} as const satisfies Record<ColorScheme, Record<"sm" | "md" | "lg", ShadowToken>>;
export type ShadowLevel = keyof (typeof shadows)["light"];

export const tokens = { colors, spacing, radius, fontWeight, type, motion, shadows } as const;
export type Tokens = typeof tokens;

export type CssVarName = `--do-${string}`;

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function shadowCss(shadow: ShadowToken): string {
  const r = parseInt(SHADOW_COLOR.slice(1, 3), 16);
  const g = parseInt(SHADOW_COLOR.slice(3, 5), 16);
  const b = parseInt(SHADOW_COLOR.slice(5, 7), 16);
  return `${shadow.offsetX} ${shadow.offsetY}px ${shadow.blur}px ${shadow.spread}px rgb(${r} ${g} ${b} / ${shadow.opacity})`;
}

/**
 * Flat `--do-*` custom properties for one scheme, e.g.
 * `--do-color-on-accent`, `--do-space-md: 16px`, `--do-font-size-body: 17px`.
 * Non-colour tokens are identical in both schemes. `palette` overrides
 * colour roles (a seasonal theme from `resolveThemeColors`).
 */
export function toCssVars(scheme: ColorScheme, palette: Partial<ColorPalette> = {}): Record<CssVarName, string> {
  const vars: Record<CssVarName, string> = {};
  for (const [role, value] of Object.entries({ ...colors[scheme], ...palette })) {
    vars[`--do-color-${kebab(role)}`] = value;
  }
  for (const [name, value] of Object.entries(spacing)) vars[`--do-space-${name}`] = `${value}px`;
  for (const [name, value] of Object.entries(radius)) vars[`--do-radius-${name}`] = `${value}px`;
  for (const [name, style] of Object.entries(type)) {
    vars[`--do-font-size-${name}`] = `${style.fontSize}px`;
    vars[`--do-line-height-${name}`] = `${style.lineHeight}px`;
    vars[`--do-font-weight-${name}`] = style.fontWeight;
    vars[`--do-letter-spacing-${name}`] = `${style.letterSpacing}px`;
  }
  for (const [name, ms] of Object.entries(motion.duration)) vars[`--do-duration-${name}`] = `${ms}ms`;
  for (const [name, points] of Object.entries(motion.easing)) {
    vars[`--do-ease-${name}`] = `cubic-bezier(${points.join(", ")})`;
  }
  for (const [name, shadow] of Object.entries(shadows[scheme])) vars[`--do-shadow-${name}`] = shadowCss(shadow);
  return vars;
}
