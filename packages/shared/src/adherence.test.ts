import { MED_ID, MED_ID_2, makeDose, plusMin } from "./fixtures.test-util";
import { dailyRate, onTimeRate, streak, weeklySummary } from "./adherence";
import type { Dose } from "./schemas";

const TOR = "America/Toronto";
const at = (day: string, hhmm: string) => `${day}T${hhmm}:00.000Z`;
const taken = (dueAt: string, extra: Partial<Dose> = {}) => makeDose(dueAt, { takenAt: plusMin(dueAt, 5), ...extra });
const skipped = (dueAt: string, extra: Partial<Dose> = {}) => makeDose(dueAt, { skippedAt: plusMin(dueAt, 5), ...extra });
const open = (dueAt: string, extra: Partial<Dose> = {}) => makeDose(dueAt, extra);

describe("dailyRate", () => {
  it("is taken / scheduled for the local day", () => {
    const doses = [taken(at("2026-10-05", "08:00")), open(at("2026-10-05", "20:00")), taken(at("2026-10-06", "08:00"))];
    expect(dailyRate(doses, "2026-10-05", "UTC")).toBe(0.5);
  });
  it("counts skipped doses against the rate", () => {
    expect(dailyRate([taken(at("2026-10-05", "08:00")), skipped(at("2026-10-05", "20:00"))], "2026-10-05", "UTC")).toBe(0.5);
  });
  it("is null with no scheduled doses that day", () => {
    expect(dailyRate([], "2026-10-05", "UTC")).toBeNull();
  });
  it("assigns doses to local days in the zone", () => {
    const doses = [taken(at("2026-10-06", "02:00")), open(at("2026-10-06", "12:00"))];
    expect(dailyRate(doses, "2026-10-05", TOR)).toBe(1);
    expect(dailyRate(doses, "2026-10-06", TOR)).toBe(0);
  });
  it("ignores as-needed and deleted doses", () => {
    const doses = [
      taken(at("2026-10-05", "08:00")),
      taken(at("2026-10-05", "09:00"), { source: "as-needed" }),
      open(at("2026-10-05", "20:00"), { deletedAt: at("2026-10-05", "07:00") }),
    ];
    expect(dailyRate(doses, "2026-10-05", "UTC")).toBe(1);
  });
});

describe("weeklySummary", () => {
  const WEEK = "2026-10-05";
  const NOW = at("2026-10-12", "00:00");
  const doses = [
    taken(at("2026-10-05", "08:00")),
    taken(at("2026-10-05", "20:00")),
    taken(at("2026-10-06", "08:00")),
    skipped(at("2026-10-06", "20:00")),
    open(at("2026-10-07", "08:00")),
    open(at("2026-10-07", "20:00")),
    taken(at("2026-10-07", "08:00"), { medicationId: MED_ID_2 }),
    taken(at("2026-10-12", "08:00")),
  ];

  it("summarises per medication", () => {
    const s = weeklySummary(doses, WEEK, "UTC", NOW);
    expect(s.perMed).toEqual([
      { medicationId: MED_ID, taken: 3, skipped: 1, missed: 2, pending: 0, total: 6, rate: 0.5 },
      { medicationId: MED_ID_2, taken: 1, skipped: 0, missed: 0, pending: 0, total: 1, rate: 1 },
    ]);
  });
  it("totals the week and lists seven days", () => {
    const s = weeklySummary(doses, WEEK, "UTC", NOW);
    expect(s).toMatchObject({ weekStart: WEEK, taken: 4, skipped: 1, missed: 2, pending: 0, total: 7 });
    expect(s.rate).toBeCloseTo(4 / 7);
    expect(s.days.map((d) => d.dayKey)).toEqual([
      "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11",
    ]);
    expect(s.days[3]).toEqual({ dayKey: "2026-10-08", taken: 0, skipped: 0, missed: 0, pending: 0, total: 0, rate: null });
  });
  it("picks best and worst days among days with settled doses", () => {
    const s = weeklySummary(doses, WEEK, "UTC", NOW);
    expect(s.bestDay).toBe("2026-10-05");
    expect(s.worstDay).toBe("2026-10-07");
  });
  it("breaks ties toward the earlier day", () => {
    const s = weeklySummary([taken(at("2026-10-05", "08:00")), taken(at("2026-10-06", "08:00"))], WEEK, "UTC", NOW);
    expect(s.bestDay).toBe("2026-10-05");
    expect(s.worstDay).toBe("2026-10-05");
  });
  it("leaves unsettled doses out of the rate mid-week", () => {
    const s = weeklySummary(doses, WEEK, "UTC", at("2026-10-07", "08:30"));
    expect(s.perMed[0]).toMatchObject({ missed: 0, pending: 2, rate: 0.75 });
  });
  it("has null rate and days when nothing is settled", () => {
    const s = weeklySummary([], WEEK, "UTC", NOW);
    expect(s).toMatchObject({ total: 0, rate: null, bestDay: null, worstDay: null, perMed: [] });
  });
  it("uses the given escalation delay to decide missed", () => {
    const late = [open(at("2026-10-05", "08:00"))];
    expect(weeklySummary(late, WEEK, "UTC", at("2026-10-05", "09:20"), 30).pending).toBe(1);
    expect(weeklySummary(late, WEEK, "UTC", at("2026-10-05", "09:20"), 10).missed).toBe(1);
  });
});

describe("streak", () => {
  const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"];
  const allTaken = days.flatMap((d) => [taken(at(d, "08:00")), taken(at(d, "20:00"))]);

  it("counts consecutive fully-taken days up to the given day", () => {
    expect(streak(allTaken, MED_ID, "2026-10-05", "UTC")).toBe(5);
    expect(streak(allTaken, MED_ID, "2026-10-03", "UTC")).toBe(3);
  });
  it("breaks on a day with a skipped or unmarked dose", () => {
    const doses = allTaken.map((d) => (d.dueAt === at("2026-10-03", "20:00") ? { ...d, takenAt: null, skippedAt: d.dueAt } : d));
    expect(streak(doses, MED_ID, "2026-10-05", "UTC")).toBe(2);
  });
  it("is zero when the last day is incomplete and no clock is given", () => {
    const doses = [...allTaken.slice(0, 8), taken(at("2026-10-05", "08:00")), open(at("2026-10-05", "20:00"))];
    expect(streak(doses, MED_ID, "2026-10-05", "UTC")).toBe(0);
  });
  it("treats a day with only not-yet-missed doses outstanding as neutral when given now", () => {
    const doses = [...allTaken.slice(0, 8), taken(at("2026-10-05", "08:00")), open(at("2026-10-05", "20:00"))];
    expect(streak(doses, MED_ID, "2026-10-05", "UTC", at("2026-10-05", "12:00"))).toBe(4);
    expect(streak(doses, MED_ID, "2026-10-05", "UTC", at("2026-10-05", "21:30"))).toBe(0);
  });
  it("skips over days with nothing scheduled (weekday subsets)", () => {
    const doses = [taken(at("2026-09-28", "09:00")), taken(at("2026-10-01", "09:00")), taken(at("2026-10-05", "09:00"))];
    expect(streak(doses, MED_ID, "2026-10-07", "UTC")).toBe(3);
  });
  it("ignores other medications, as-needed and deleted doses", () => {
    const doses = [
      ...allTaken,
      open(at("2026-10-05", "12:00"), { medicationId: MED_ID_2 }),
      open(at("2026-10-05", "13:00"), { source: "as-needed" }),
      open(at("2026-10-05", "14:00"), { deletedAt: at("2026-10-05", "00:00") }),
    ];
    expect(streak(doses, MED_ID, "2026-10-05", "UTC")).toBe(5);
  });
  it("is zero with no doses", () => {
    expect(streak([], MED_ID, "2026-10-05", "UTC")).toBe(0);
  });
  it("groups by local day in the zone", () => {
    const doses = [taken(at("2026-10-05", "02:00")), open(at("2026-10-05", "12:00"))];
    expect(streak(doses, MED_ID, "2026-10-04", TOR)).toBe(1);
    expect(streak(doses, MED_ID, "2026-10-05", TOR)).toBe(0);
  });
});

describe("onTimeRate", () => {
  const due = at("2026-10-05", "08:00");
  it("is the share of taken doses taken inside their window", () => {
    const doses = [
      makeDose(due, { takenAt: plusMin(due, 10) }),
      makeDose(due, { takenAt: plusMin(due, 60) }),
      makeDose(due, { takenAt: plusMin(due, 61) }),
      makeDose(due, { takenAt: plusMin(due, -1) }),
      makeDose(due, { skippedAt: due }),
    ];
    expect(onTimeRate(doses)).toBe(0.5);
  });
  it("allows an early grace period", () => {
    expect(onTimeRate([makeDose(due, { takenAt: plusMin(due, -10) })], 15)).toBe(1);
  });
  it("is null when nothing was taken and ignores as-needed doses", () => {
    expect(onTimeRate([makeDose(due)])).toBeNull();
    expect(onTimeRate([makeDose(due, { source: "as-needed", takenAt: plusMin(due, 300) })])).toBeNull();
  });
});
