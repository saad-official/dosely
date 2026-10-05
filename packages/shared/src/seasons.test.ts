import {
  effectiveTheme,
  easterSunday,
  nthWeekdayOfMonth,
  resolveSeason,
  SEASON_IDS,
  SEASONS,
  seasonWindows,
} from "./seasons";
import { THEME_IDS } from "./themes";

describe("easterSunday", () => {
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2038, "2038-04-25"],
    [2285, "2285-03-22"],
  ])("computes %i as %s", (year, key) => {
    expect(easterSunday(year)).toBe(key);
  });
});

describe("nthWeekdayOfMonth", () => {
  it("finds the 2nd Monday of October", () => {
    expect(nthWeekdayOfMonth(2026, 10, 1, 2)).toBe("2026-10-12");
    expect(nthWeekdayOfMonth(2024, 10, 1, 2)).toBe("2024-10-14");
  });
  it("finds the 4th Thursday of November", () => {
    expect(nthWeekdayOfMonth(2026, 11, 4, 4)).toBe("2026-11-26");
    expect(nthWeekdayOfMonth(2024, 11, 4, 4)).toBe("2024-11-28");
  });
  it("handles a month starting on the wanted weekday", () => {
    expect(nthWeekdayOfMonth(2026, 11, 0, 1)).toBe("2026-11-01");
  });
  it("supports n = -1 for the last weekday of the month", () => {
    expect(nthWeekdayOfMonth(2026, 5, 1, -1)).toBe("2026-05-25");
  });
  it("throws when the month has no such weekday", () => {
    expect(() => nthWeekdayOfMonth(2026, 2, 1, 5)).toThrow(RangeError);
  });
});

describe("SEASONS table", () => {
  it("has the ten seasonal themes", () => {
    expect(SEASON_IDS).toEqual([
      "new-year", "valentines", "st-patricks", "easter", "canada-day",
      "independence-day", "halloween", "thanksgiving-ca", "thanksgiving-us", "holidays",
    ]);
    expect(SEASONS.map((s) => s.id)).toEqual(SEASON_IDS);
  });
  it("matches the theme ids in themes.ts (default + one per season)", () => {
    expect(THEME_IDS).toEqual(["default", ...SEASON_IDS]);
  });
  it("gives every season a label", () => {
    for (const s of SEASONS) expect(s.label.length).toBeGreaterThan(0);
  });
});

describe("seasonWindows", () => {
  it("returns every season for 'both', sorted by start", () => {
    const w = seasonWindows(2026, "both");
    expect(w.map((x) => x.id)).toEqual([
      "new-year", "valentines", "st-patricks", "easter", "canada-day",
      "independence-day", "thanksgiving-ca", "halloween", "thanksgiving-us", "holidays",
    ]);
  });
  it("labels new-year by the year whose January 1st it contains", () => {
    expect(seasonWindows(2026, "both")[0]).toEqual({ id: "new-year", start: "2025-12-31", end: "2026-01-02" });
  });
  it("computes the moveable windows for 2026", () => {
    const byId = Object.fromEntries(seasonWindows(2026, "both").map((x) => [x.id, x]));
    expect(byId.easter).toEqual({ id: "easter", start: "2026-04-03", end: "2026-04-06" });
    expect(byId["thanksgiving-ca"]).toEqual({ id: "thanksgiving-ca", start: "2026-10-09", end: "2026-10-15" });
    expect(byId["thanksgiving-us"]).toEqual({ id: "thanksgiving-us", start: "2026-11-23", end: "2026-11-29" });
  });
  it("computes the fixed windows", () => {
    const byId = Object.fromEntries(seasonWindows(2026, "both").map((x) => [x.id, x]));
    expect(byId.valentines).toMatchObject({ start: "2026-02-07", end: "2026-02-14" });
    expect(byId["st-patricks"]).toMatchObject({ start: "2026-03-14", end: "2026-03-17" });
    expect(byId["canada-day"]).toMatchObject({ start: "2026-06-28", end: "2026-07-01" });
    expect(byId["independence-day"]).toMatchObject({ start: "2026-07-01", end: "2026-07-04" });
    expect(byId.halloween).toMatchObject({ start: "2026-10-15", end: "2026-10-31" });
    expect(byId.holidays).toMatchObject({ start: "2026-12-01", end: "2026-12-30" });
  });
  it("omits the other country's seasons for a single region", () => {
    const ca = seasonWindows(2026, "CA").map((x) => x.id);
    expect(ca).toContain("canada-day");
    expect(ca).toContain("thanksgiving-ca");
    expect(ca).not.toContain("independence-day");
    expect(ca).not.toContain("thanksgiving-us");
    const us = seasonWindows(2026, "US").map((x) => x.id);
    expect(us).not.toContain("canada-day");
    expect(us).toContain("thanksgiving-us");
  });
});

describe("resolveSeason", () => {
  it("returns null outside every window", () => {
    expect(resolveSeason("2026-05-10", "both")).toBeNull();
    expect(resolveSeason("2026-02-06", "both")).toBeNull();
  });
  it("includes both window ends", () => {
    expect(resolveSeason("2026-02-07", "US")).toBe("valentines");
    expect(resolveSeason("2026-02-14", "US")).toBe("valentines");
    expect(resolveSeason("2026-02-15", "US")).toBeNull();
  });
  it("wraps new-year across the year end", () => {
    expect(resolveSeason("2026-12-31", "CA")).toBe("new-year");
    expect(resolveSeason("2027-01-01", "CA")).toBe("new-year");
    expect(resolveSeason("2027-01-02", "CA")).toBe("new-year");
    expect(resolveSeason("2027-01-03", "CA")).toBeNull();
  });
  it("ends holidays on Dec 30", () => {
    expect(resolveSeason("2026-12-30", "both")).toBe("holidays");
  });
  it("covers Good Friday through Easter Monday", () => {
    expect(resolveSeason("2026-04-02", "both")).toBeNull();
    expect(resolveSeason("2026-04-03", "both")).toBe("easter");
    expect(resolveSeason("2026-04-06", "both")).toBe("easter");
    expect(resolveSeason("2026-04-07", "both")).toBeNull();
  });
  it("limits regional seasons to their region", () => {
    expect(resolveSeason("2026-06-29", "US")).toBeNull();
    expect(resolveSeason("2026-06-29", "CA")).toBe("canada-day");
    expect(resolveSeason("2026-07-03", "CA")).toBeNull();
    expect(resolveSeason("2026-07-03", "US")).toBe("independence-day");
  });
  it("gives Jul 1 to canada-day for 'both' (earliest start wins)", () => {
    expect(resolveSeason("2026-07-01", "both")).toBe("canada-day");
    expect(resolveSeason("2026-07-01", "US")).toBe("independence-day");
  });
  it("lets CA Thanksgiving beat Halloween where they overlap", () => {
    expect(resolveSeason("2024-10-16", "CA")).toBe("thanksgiving-ca");
    expect(resolveSeason("2024-10-16", "US")).toBe("halloween");
    expect(resolveSeason("2024-10-18", "CA")).toBe("halloween");
  });
  it("lets US Thanksgiving beat Holidays on Dec 1 when it runs that late", () => {
    expect(resolveSeason("2024-12-01", "US")).toBe("thanksgiving-us");
    expect(resolveSeason("2024-12-01", "CA")).toBe("holidays");
  });
});

describe("effectiveTheme", () => {
  const base = { theme: "default" as const, autoSeasonal: false, region: "both" as const };
  it("returns the manual theme when auto is off, even in season", () => {
    expect(effectiveTheme(base, "2026-10-31")).toBe("default");
    expect(effectiveTheme({ ...base, theme: "valentines" }, "2026-10-31")).toBe("valentines");
  });
  it("returns the season when auto is on and a season is active", () => {
    expect(effectiveTheme({ ...base, autoSeasonal: true }, "2026-10-31")).toBe("halloween");
  });
  it("falls back to the picked theme out of season", () => {
    expect(effectiveTheme({ ...base, autoSeasonal: true, theme: "easter" }, "2026-05-10")).toBe("easter");
  });
  it("respects the region when auto is on", () => {
    expect(effectiveTheme({ ...base, autoSeasonal: true, region: "US" }, "2026-06-29")).toBe("default");
  });
});
