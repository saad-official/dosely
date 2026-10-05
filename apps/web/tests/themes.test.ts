import { describe, expect, it } from "vitest";
import { colors, type ColorScheme } from "@dosely/shared/tokens";
import { SEASON_IDS as SHARED_SEASON_IDS } from "@dosely/shared/seasons";
import { APP_ICONS, resolveThemeColors, THEME_IDS, THEMES, type ThemeId } from "@dosely/shared/themes";
import { contrast } from "./contrast";

const SEASON_IDS = [
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
const SCHEMES: ColorScheme[] = ["light", "dark"];
const MOTIFS = ["none", "snow", "hearts", "clover", "eggs", "maple", "stars", "leaves", "pumpkins", "lights"];

describe("THEMES", () => {
  it("has the default theme plus one per season, in order", () => {
    expect(THEME_IDS).toEqual(["default", ...SEASON_IDS]);
    expect([...SHARED_SEASON_IDS]).toEqual([...SEASON_IDS]);
    expect(Object.keys(THEMES).sort()).toEqual([...THEME_IDS].sort());
  });

  it.each(THEME_IDS)("%s has its id, a name, a description, a motif and an icon key", (id) => {
    const theme = THEMES[id];
    expect(theme.id).toBe(id);
    expect(theme.name.length).toBeGreaterThan(2);
    expect(theme.description.length).toBeGreaterThan(10);
    expect(MOTIFS).toContain(theme.motif);
    expect(theme.iconKey).toBe(APP_ICONS[id]);
  });

  it("default overrides nothing and has no motif", () => {
    expect(THEMES.default.light).toEqual({});
    expect(THEMES.default.dark).toEqual({});
    expect(THEMES.default.motif).toBe("none");
  });

  it("every seasonal theme changes the accent in both schemes and has a motif", () => {
    for (const id of SEASON_IDS) {
      expect(THEMES[id].light.accent, id).toBeDefined();
      expect(THEMES[id].dark.accent, id).toBeDefined();
      expect(THEMES[id].motif, id).not.toBe("none");
    }
  });

  it("overrides only known colour roles with #RRGGBB values", () => {
    const roles = Object.keys(colors.light);
    for (const id of THEME_IDS) {
      for (const scheme of SCHEMES) {
        for (const [role, value] of Object.entries(THEMES[id][scheme])) {
          expect(roles, `${id}.${scheme}.${role}`).toContain(role);
          expect(value, `${id}.${scheme}.${role}`).toMatch(/^#[0-9A-F]{6}$/);
        }
      }
    }
  });

  const cases = THEME_IDS.flatMap((id) => SCHEMES.map((scheme) => [id, scheme] as [ThemeId, ColorScheme]));
  it.each(cases)("%s (%s) keeps WCAG AA contrast", (id, scheme) => {
    const c = resolveThemeColors(id, scheme);
    for (const bg of [c.surface, c.surfaceElevated]) {
      expect(contrast(c.text, bg), "text").toBeGreaterThanOrEqual(7);
      expect(contrast(c.textSecondary, bg), "textSecondary").toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.accentText, bg), "accentText").toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.danger, bg), "danger").toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(c.onAccent, c.accent), "onAccent").toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.accentText, c.accentSoft), "accentText on accentSoft").toBeGreaterThanOrEqual(4.5);
  });
});

describe("resolveThemeColors", () => {
  it("returns the base palette for default", () => {
    expect(resolveThemeColors("default", "light")).toEqual(colors.light);
    expect(resolveThemeColors("default", "dark")).toEqual(colors.dark);
  });

  it("merges a season's overrides over the base palette", () => {
    const holidays = resolveThemeColors("holidays", "dark");
    expect(holidays.accent).toBe(THEMES.holidays.dark.accent);
    expect(holidays.text).toBe(colors.dark.text);
  });

  it("falls back to default for an unknown id", () => {
    expect(resolveThemeColors("nope" as ThemeId, "light")).toEqual(colors.light);
  });
});

describe("APP_ICONS", () => {
  it("maps every theme to an icon-<id> asset name", () => {
    for (const id of THEME_IDS) expect(APP_ICONS[id]).toBe(`icon-${id}`);
  });
});
