import { CSV_HEADER, csvEscape, exportRows, toCsv } from "./csv";
import { MED_ID_2, PROFILE_ID, makeDose, makeMed } from "./fixtures.test-util";

describe("csvEscape", () => {
  it("leaves plain values alone", () => {
    expect(csvEscape("Smith kitchen")).toBe("Smith kitchen");
    expect(csvEscape(12.5)).toBe("12.5");
  });
  it("renders null and undefined as empty", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });
  it("quotes values containing commas, quotes or newlines and doubles quotes", () => {
    expect(csvEscape("Tiles, grout")).toBe('"Tiles, grout"');
    expect(csvEscape('Said "thanks"')).toBe('"Said ""thanks"""');
    expect(csvEscape("line 1\nline 2")).toBe('"line 1\nline 2"');
    expect(csvEscape("a\r\nb")).toBe('"a\r\nb"');
  });
  it("neutralises spreadsheet formulas", () => {
    expect(csvEscape("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvEscape("+1 555")).toBe("'+1 555");
    expect(csvEscape("@sum")).toBe("'@sum");
    expect(csvEscape("-cmd")).toBe("'-cmd");
  });
  it("keeps negative numbers numeric", () => {
    expect(csvEscape("-12.50")).toBe("-12.50");
    expect(csvEscape(-3)).toBe("-3");
  });
});

describe("toCsv", () => {
  it("joins escaped cells with commas and rows with CRLF", () => {
    expect(toCsv([["Date", "Note"], ["2026-10-05", "a, b"]])).toBe('Date,Note\r\n2026-10-05,"a, b"\r\n');
  });
  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });
});

describe("exportRows", () => {
  const TOR = "America/Toronto";
  const med = makeMed({ strength: "500 mg" });
  const med2 = makeMed({ id: MED_ID_2, name: "Vitamin D", strength: null });
  const morning = makeDose("2026-10-05T12:00:00.000Z", { takenAt: "2026-10-05T12:07:00.000Z" });
  const evening = makeDose("2026-10-06T00:00:00.000Z", { skippedAt: "2026-10-06T00:30:00.000Z" });
  const open = makeDose("2026-10-05T16:00:00.000Z", { medicationId: MED_ID_2 });

  it("starts with a header row", () => {
    expect(exportRows([], [med], TOR)[0]).toEqual(CSV_HEADER);
    expect(CSV_HEADER).toEqual(["Date", "Due", "Medication", "Strength", "Profile", "Status", "Taken at", "Skipped at", "Source"]);
  });
  it("writes one row per dose in local time, sorted by due time", () => {
    expect(exportRows([evening, morning, open], [med, med2], TOR).slice(1)).toEqual([
      ["2026-10-05", "08:00", "Metformin", "500 mg", "", "taken", "2026-10-05 08:07", "", "scheduled"],
      ["2026-10-05", "12:00", "Vitamin D", "", "", "unmarked", "", "", "scheduled"],
      ["2026-10-05", "20:00", "Metformin", "500 mg", "", "skipped", "", "2026-10-05 20:30", "scheduled"],
    ]);
  });
  it("uses dose states when given now", () => {
    const rows = exportRows([open], [med2], TOR, { now: "2026-10-06T00:00:00.000Z" });
    expect(rows[1]?.[5]).toBe("missed");
  });
  it("adds profile names when profiles are given", () => {
    const profiles = [{ id: PROFILE_ID, name: "Mom" }];
    expect(exportRows([morning], [med], TOR, { profiles })[1]?.[4]).toBe("Mom");
  });
  it("skips deleted doses and labels unknown medications", () => {
    const gone = makeDose("2026-10-05T12:00:00.000Z", { medicationId: "gone" });
    const rows = exportRows([{ ...morning, deletedAt: morning.dueAt }, gone], [], "UTC");
    expect(rows).toHaveLength(2);
    expect(rows[1]?.[2]).toBe("(deleted medication)");
  });
  it("round-trips through toCsv", () => {
    const lines = toCsv(exportRows([morning], [med], TOR)).split("\r\n");
    expect(lines[1]).toBe("2026-10-05,08:00,Metformin,500 mg,,taken,2026-10-05 08:07,,scheduled");
  });
});
