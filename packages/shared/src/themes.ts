/**
 * Seasonal themes: partial colour overrides of the base tokens, a motif for
 * the subtle layer on Today, and the matching alternate app icon.
 *
 * Ids match `SEASONS` in `seasons.ts` (the date resolver) plus `default`.
 * Overrides touch surfaces and accents only; text roles stay the base ink so
 * every theme keeps WCAG AA contrast (checked in apps/web/tests/themes.test.ts).
 * Manual selection always beats the auto-by-date resolver (that rule lives in
 * the app's settings, not here).
 */
import { colors, type ColorPalette, type ColorScheme } from "./tokens";

export const THEME_IDS = [
  "default",
  "new-year",
  "valentines",
  "st-patricks",
  "easter",
  "canada-day",
  "independence-day",
  "halloween",
  "thanksgiving-ca",
  "thanksgiving-us",
  "holidays",
] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const MOTIFS = ["none", "snow", "hearts", "clover", "eggs", "maple", "stars", "leaves", "pumpkins", "lights"] as const;
export type Motif = (typeof MOTIFS)[number];

export type ThemeOverrides = Partial<ColorPalette>;

export type Theme = {
  id: ThemeId;
  name: string;
  description: string;
  light: ThemeOverrides;
  dark: ThemeOverrides;
  motif: Motif;
  /** Alternate app icon asset name (`APP_ICONS[id]`). */
  iconKey: string;
};

/** Alternate app icon per theme (iOS alternate icon name / Android activity-alias). */
export const APP_ICONS = Object.fromEntries(THEME_IDS.map((id) => [id, `icon-${id}`])) as Record<ThemeId, string>;

export const THEMES: Record<ThemeId, Theme> = {
  default: {
    id: "default",
    name: "Dosely",
    description: "Calm teal on soft clinical white. The everyday look.",
    light: {},
    dark: {},
    motif: "none",
    iconKey: APP_ICONS.default,
  },
  "new-year": {
    id: "new-year",
    name: "New Year",
    description: "Midnight blue and a touch of gold for a fresh start.",
    light: {
      surface: "#F6F7FB",
      surfaceSunken: "#E9ECF5",
      accent: "#C9A227",
      accentPressed: "#B38E1C",
      accentSoft: "#F6EDCF",
      accentText: "#735600",
      onAccent: "#1A1402",
    },
    dark: {
      surface: "#0C1122",
      surfaceElevated: "#151C33",
      surfaceSunken: "#070A16",
      accent: "#E3C15A",
      accentPressed: "#ECD07C",
      accentSoft: "#2C2610",
      accentText: "#EACC6C",
      onAccent: "#1A1402",
      separator: "#222A42",
      border: "#323C58",
    },
    motif: "stars",
    iconKey: APP_ICONS["new-year"],
  },
  valentines: {
    id: "valentines",
    name: "Valentine's",
    description: "Soft rose for the people who keep each other well.",
    light: {
      surface: "#FBF7F8",
      surfaceSunken: "#F3E7EB",
      accent: "#C2335C",
      accentPressed: "#A82A50",
      accentSoft: "#FBE3EA",
      accentText: "#A12A4D",
      onAccent: "#FFFFFF",
    },
    dark: {
      surface: "#181014",
      surfaceElevated: "#23171D",
      surfaceSunken: "#100A0D",
      accent: "#F27A9B",
      accentPressed: "#F595AF",
      accentSoft: "#3A1824",
      accentText: "#F590AC",
      onAccent: "#2A0B15",
      separator: "#2F2027",
      border: "#45303A",
    },
    motif: "hearts",
    iconKey: APP_ICONS.valentines,
  },
  "st-patricks": {
    id: "st-patricks",
    name: "St. Patrick's",
    description: "Clover green, lightly done.",
    light: {
      surface: "#F5F9F6",
      surfaceSunken: "#E6EFE8",
      accent: "#237A4B",
      accentPressed: "#1C663E",
      accentSoft: "#DCF0E3",
      accentText: "#1C6B41",
      onAccent: "#FFFFFF",
    },
    dark: {
      surface: "#0E1511",
      surfaceElevated: "#17211B",
      surfaceSunken: "#0A0F0C",
      accent: "#4CC37F",
      accentPressed: "#6CD096",
      accentSoft: "#14321F",
      accentText: "#62D191",
      onAccent: "#06210F",
      separator: "#1F2B24",
      border: "#2F3E35",
    },
    motif: "clover",
    iconKey: APP_ICONS["st-patricks"],
  },
  easter: {
    id: "easter",
    name: "Easter",
    description: "Pastel lilac with a mint wash for spring mornings.",
    light: {
      surface: "#F8F6FB",
      surfaceSunken: "#EEE9F5",
      accent: "#7B5EA7",
      accentPressed: "#6A4E96",
      accentSoft: "#E3F4EC",
      accentText: "#5F4590",
      onAccent: "#FFFFFF",
    },
    dark: {
      surface: "#14121A",
      surfaceElevated: "#1E1B27",
      surfaceSunken: "#0D0C12",
      accent: "#B9A3E3",
      accentPressed: "#C9B7EA",
      accentSoft: "#163A2D",
      accentText: "#C6B3EC",
      onAccent: "#1C1230",
      separator: "#272333",
      border: "#3A3449",
    },
    motif: "eggs",
    iconKey: APP_ICONS.easter,
  },
  "canada-day": {
    id: "canada-day",
    name: "Canada Day",
    description: "Maple red on clean white for the first of July.",
    light: {
      surface: "#FAF7F7",
      surfaceSunken: "#F1E8E8",
      accent: "#C8102E",
      accentPressed: "#AD0D27",
      accentSoft: "#FBE2E5",
      accentText: "#A80D27",
      onAccent: "#FFFFFF",
    },
    dark: {
      surface: "#151012",
      surfaceElevated: "#21171A",
      surfaceSunken: "#0E0A0B",
      accent: "#FF6B72",
      accentPressed: "#FF8A8F",
      accentSoft: "#3B1518",
      accentText: "#FF8B90",
      onAccent: "#2A0608",
      separator: "#2D2023",
      border: "#433034",
    },
    motif: "maple",
    iconKey: APP_ICONS["canada-day"],
  },
  "independence-day": {
    id: "independence-day",
    name: "Independence Day",
    description: "Navy and red for the Fourth of July.",
    light: {
      surface: "#F5F7FA",
      surfaceSunken: "#E7EBF3",
      accent: "#B22234",
      accentPressed: "#9A1D2D",
      accentSoft: "#E4E9F4",
      accentText: "#9E1D2E",
      onAccent: "#FFFFFF",
    },
    dark: {
      surface: "#0B1424",
      surfaceElevated: "#131F38",
      surfaceSunken: "#070D18",
      accent: "#FF6070",
      accentPressed: "#FF808C",
      accentSoft: "#1C2A4A",
      accentText: "#FF8592",
      onAccent: "#2A0509",
      separator: "#1D2A44",
      border: "#2C3B5C",
    },
    motif: "stars",
    iconKey: APP_ICONS["independence-day"],
  },
  halloween: {
    id: "halloween",
    name: "Halloween",
    description: "Aubergine evenings and a pumpkin glow. Spooky, never scary.",
    light: {
      surface: "#F8F5F9",
      surfaceSunken: "#EEE6F0",
      accent: "#B84D0A",
      accentPressed: "#9E4208",
      accentSoft: "#FBE7D8",
      accentText: "#9A4108",
      onAccent: "#FFFFFF",
    },
    dark: {
      surface: "#160F1A",
      surfaceElevated: "#22182A",
      surfaceSunken: "#0E0911",
      accent: "#FF8C2E",
      accentPressed: "#FFA254",
      accentSoft: "#3A2014",
      accentText: "#FF9D4D",
      onAccent: "#2A1200",
      separator: "#2C2133",
      border: "#42344B",
    },
    motif: "pumpkins",
    iconKey: APP_ICONS.halloween,
  },
  "thanksgiving-ca": {
    id: "thanksgiving-ca",
    name: "Thanksgiving (Canada)",
    description: "Amber and maple leaves for the October long weekend.",
    light: {
      surface: "#FAF8F4",
      surfaceSunken: "#F1ECE2",
      accent: "#A85A12",
      accentPressed: "#904D0F",
      accentSoft: "#F8E8D4",
      accentText: "#8A490D",
      onAccent: "#FFFFFF",
    },
    dark: {
      surface: "#17120C",
      surfaceElevated: "#231B13",
      surfaceSunken: "#0F0C08",
      accent: "#E8A23A",
      accentPressed: "#EEB45E",
      accentSoft: "#38270F",
      accentText: "#F0B254",
      onAccent: "#2A1800",
      separator: "#2E251A",
      border: "#453829",
    },
    motif: "leaves",
    iconKey: APP_ICONS["thanksgiving-ca"],
  },
  "thanksgiving-us": {
    id: "thanksgiving-us",
    name: "Thanksgiving (US)",
    description: "Warm ochre for the fourth Thursday of November.",
    light: {
      surface: "#FAF8F3",
      surfaceSunken: "#F0EBDF",
      accent: "#946409",
      accentPressed: "#7E5508",
      accentSoft: "#F5EBCF",
      accentText: "#7A5207",
      onAccent: "#FFFFFF",
    },
    dark: {
      surface: "#16130B",
      surfaceElevated: "#221D12",
      surfaceSunken: "#0E0C07",
      accent: "#D9A441",
      accentPressed: "#E3B765",
      accentSoft: "#372A10",
      accentText: "#E5B85F",
      onAccent: "#261A00",
      separator: "#2E2819",
      border: "#453C28",
    },
    motif: "leaves",
    iconKey: APP_ICONS["thanksgiving-us"],
  },
  holidays: {
    id: "holidays",
    name: "Holidays",
    description: "Deep evergreen with a warm red, for December.",
    light: {
      surface: "#F4F8F5",
      surfaceSunken: "#E4EDE7",
      accent: "#B3261E",
      accentPressed: "#9A211A",
      accentSoft: "#DDEDE3",
      accentText: "#A0221B",
      onAccent: "#FFFFFF",
    },
    dark: {
      surface: "#0C1A14",
      surfaceElevated: "#14261D",
      surfaceSunken: "#08120E",
      accent: "#FF6B5E",
      accentPressed: "#FF8A80",
      accentSoft: "#163B29",
      accentText: "#FF8A7F",
      onAccent: "#2B0805",
      separator: "#1B3126",
      border: "#2A4637",
    },
    motif: "lights",
    iconKey: APP_ICONS.holidays,
  },
};

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

/** Base palette for `scheme` with the theme's overrides on top. Unknown ids resolve to default. */
export function resolveThemeColors(themeId: ThemeId, scheme: ColorScheme): ColorPalette {
  const theme = isThemeId(themeId) ? THEMES[themeId] : THEMES.default;
  return { ...colors[scheme], ...theme[scheme] };
}
