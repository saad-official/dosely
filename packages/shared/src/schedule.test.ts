import { CREATED, MED_ID, MED_ID_2, PROFILE_ID, makeDose, makeMed } from "./fixtures.test-util";
import { idFromKey, isUuid } from "./ids";
import { asNeededRemaining, doseIdFor, expandDoses, logAsNeeded, nextDueAfter } from "./schedule";
import { localTime } from "./tz";

const TOR = "America/Toronto";
const dues = (doses: { dueAt: string }[]) => doses.map((d) => d.dueAt);

describe("doseIdFor", () => {
  it("is a uuid derived from the medication id and due instant", () => {
    const id = doseIdFor(MED_ID, "2026-10-05T12:00:00.000Z");
    expect(isUuid(id)).toBe(true);
    expect(id).toBe(idFromKey(Date.parse("2026-10-05T12:00:00.000Z"), MED_ID));
  });
  it("ignores how the instant is written", () => {
    expect(doseIdFor(MED_ID, "2026-10-05T08:00:00-04:00")).toBe(doseIdFor(MED_ID, "2026-10-05T12:00:00.000Z"));
  });
  it("differs between medications due at the same time", () => {
    expect(doseIdFor(MED_ID, "2026-10-05T12:00:00Z")).not.toBe(doseIdFor(MED_ID_2, "2026-10-05T12:00:00Z"));
  });
});

describe("expandDoses: fixed times", () => {
  it("creates one dose per time per day, sorted, in UTC by default", () => {
    const doses = expandDoses(makeMed({ schedule: { kind: "times", times: ["20:00", "08:00"] } }), "2026-10-05", 2);
    expect(dues(doses)).toEqual([
      "2026-10-05T08:00:00.000Z",
      "2026-10-05T20:00:00.000Z",
      "2026-10-06T08:00:00.000Z",
      "2026-10-06T20:00:00.000Z",
    ]);
  });
  it("fills dose fields from the medication", () => {
    const [d] = expandDoses(makeMed({ windowMinutes: 30 }), "2026-10-05", 1);
    expect(d).toEqual({
      id: doseIdFor(MED_ID, "2026-10-05T08:00:00.000Z"),
      medicationId: MED_ID,
      profileId: PROFILE_ID,
      dueAt: "2026-10-05T08:00:00.000Z",
      windowEndsAt: "2026-10-05T08:30:00.000Z",
      takenAt: null,
      skippedAt: null,
      snoozedUntil: null,
      source: "scheduled",
      createdAt: CREATED,
      updatedAt: CREATED,
      deletedAt: null,
    });
  });
  it("stamps createdAt/updatedAt with now when given", () => {
    const [d] = expandDoses(makeMed(), "2026-10-05", 1, "UTC", "2026-10-05T07:00:00.000Z");
    expect(d?.createdAt).toBe("2026-10-05T07:00:00.000Z");
    expect(d?.updatedAt).toBe("2026-10-05T07:00:00.000Z");
  });
  it("is idempotent: re-expanding and overlapping ranges give the same ids", () => {
    const med = makeMed();
    const a = expandDoses(med, "2026-10-05", 3);
    expect(expandDoses(med, "2026-10-05", 3)).toEqual(a);
    const b = expandDoses(med, "2026-10-06", 1);
    expect(b.map((d) => d.id)).toEqual(a.slice(2, 4).map((d) => d.id));
  });
  it("uses the zone's local days", () => {
    const doses = expandDoses(makeMed({ schedule: { kind: "times", times: ["23:30"] } }), "2026-10-05", 1, TOR);
    expect(dues(doses)).toEqual(["2026-10-06T03:30:00.000Z"]);
  });
  it("keeps the wall-clock time across spring-forward", () => {
    const doses = expandDoses(makeMed({ schedule: { kind: "times", times: ["08:00"] } }), "2026-03-07", 3, TOR);
    expect(dues(doses)).toEqual(["2026-03-07T13:00:00.000Z", "2026-03-08T12:00:00.000Z", "2026-03-09T12:00:00.000Z"]);
    expect(doses.map((d) => localTime(d.dueAt, TOR))).toEqual(["08:00", "08:00", "08:00"]);
  });
  it("keeps the wall-clock time across fall-back", () => {
    const doses = expandDoses(makeMed({ schedule: { kind: "times", times: ["08:00"] } }), "2026-10-31", 3, TOR);
    expect(dues(doses)).toEqual(["2026-10-31T12:00:00.000Z", "2026-11-01T13:00:00.000Z", "2026-11-02T13:00:00.000Z"]);
  });
  it("moves a time in the skipped hour to 03:30 on the spring-forward day only", () => {
    const doses = expandDoses(makeMed({ schedule: { kind: "times", times: ["02:30"] } }), "2026-03-07", 3, TOR);
    expect(doses.map((d) => localTime(d.dueAt, TOR))).toEqual(["02:30", "03:30", "02:30"]);
    expect(doses[1]?.dueAt).toBe("2026-03-08T07:30:00.000Z");
  });
  it("uses the first 01:30 on the fall-back day (one dose, not two)", () => {
    const doses = expandDoses(makeMed({ schedule: { kind: "times", times: ["01:30"] } }), "2026-11-01", 1, TOR);
    expect(dues(doses)).toEqual(["2026-11-01T05:30:00.000Z"]);
  });
  it("collapses two times that land on the same instant after the gap shift", () => {
    const doses = expandDoses(makeMed({ schedule: { kind: "times", times: ["02:30", "03:30"] } }), "2026-03-08", 1, TOR);
    expect(dues(doses)).toEqual(["2026-03-08T07:30:00.000Z"]);
  });
  it("measures the window in elapsed minutes", () => {
    const [d] = expandDoses(makeMed({ schedule: { kind: "times", times: ["01:30"] } }), "2026-11-01", 1, TOR);
    expect(d?.windowEndsAt).toBe("2026-11-01T06:30:00.000Z");
  });
  it("respects a weekday subset", () => {
    const med = makeMed({ schedule: { kind: "times", times: ["09:00"], days: [1, 4] } });
    const doses = expandDoses(med, "2026-10-04", 7);
    expect(dues(doses)).toEqual(["2026-10-05T09:00:00.000Z", "2026-10-08T09:00:00.000Z"]);
  });
  it("judges the weekday in the zone, not UTC", () => {
    const med = makeMed({ schedule: { kind: "times", times: ["22:00"], days: [0] } });
    expect(dues(expandDoses(med, "2026-10-04", 1, TOR))).toEqual(["2026-10-05T02:00:00.000Z"]);
  });
  it("returns nothing for zero days", () => {
    expect(expandDoses(makeMed(), "2026-10-05", 0)).toEqual([]);
  });
});

describe("expandDoses: interval", () => {
  const interval = (anchor: string, everyHours = 8) => makeMed({ schedule: { kind: "interval", everyHours, anchor } });
  it("steps from the anchor in elapsed hours", () => {
    expect(dues(expandDoses(interval("2026-10-05T06:00:00.000Z"), "2026-10-05", 1))).toEqual([
      "2026-10-05T06:00:00.000Z",
      "2026-10-05T14:00:00.000Z",
      "2026-10-05T22:00:00.000Z",
    ]);
  });
  it("continues the cadence when the anchor is days earlier", () => {
    expect(dues(expandDoses(interval("2026-10-01T06:00:00.000Z"), "2026-10-05", 1))).toEqual([
      "2026-10-05T06:00:00.000Z",
      "2026-10-05T14:00:00.000Z",
      "2026-10-05T22:00:00.000Z",
    ]);
  });
  it("starts no earlier than the anchor", () => {
    expect(dues(expandDoses(interval("2026-10-05T12:00:00.000Z"), "2026-10-05", 1))).toEqual([
      "2026-10-05T12:00:00.000Z",
      "2026-10-05T20:00:00.000Z",
    ]);
  });
  it("lets wall-clock times drift across DST (elapsed time is kept)", () => {
    const doses = expandDoses(interval("2026-03-07T13:00:00.000Z", 12), "2026-03-08", 1, TOR);
    expect(doses.map((d) => localTime(d.dueAt, TOR))).toEqual(["09:00", "21:00"]);
  });
  it("supports fractional hours", () => {
    expect(expandDoses(interval("2026-10-05T00:00:00.000Z", 1.5), "2026-10-05", 1)).toHaveLength(16);
  });
});

describe("expandDoses: exclusions", () => {
  it("expands as-needed medications to nothing", () => {
    expect(expandDoses(makeMed({ schedule: { kind: "as-needed" } }), "2026-10-05", 7)).toEqual([]);
  });
  it("expands archived or deleted medications to nothing", () => {
    expect(expandDoses(makeMed({ archivedAt: "2026-02-01T00:00:00Z" }), "2026-10-05", 1)).toEqual([]);
    expect(expandDoses(makeMed({ deletedAt: "2026-02-01T00:00:00Z" }), "2026-10-05", 1)).toEqual([]);
  });
  it("drops doses whose window closed before the medication was created", () => {
    expect(dues(expandDoses(makeMed({ createdAt: "2026-10-05T12:30:00.000Z" }), "2026-10-05", 1))).toEqual([
      "2026-10-05T20:00:00.000Z",
    ]);
  });
  it("keeps a dose whose window is still open when the medication is created", () => {
    expect(expandDoses(makeMed({ createdAt: "2026-10-05T08:30:00.000Z" }), "2026-10-05", 1)).toHaveLength(2);
  });
});

describe("nextDueAfter", () => {
  it("finds the next time later the same day", () => {
    expect(nextDueAfter(makeMed(), "2026-10-05T09:00:00.000Z", "UTC")).toBe("2026-10-05T20:00:00.000Z");
  });
  it("is strictly after the given instant", () => {
    expect(nextDueAfter(makeMed(), "2026-10-05T20:00:00.000Z", "UTC")).toBe("2026-10-06T08:00:00.000Z");
  });
  it("rolls to the next allowed weekday", () => {
    const med = makeMed({ schedule: { kind: "times", times: ["09:00"], days: [1] } });
    expect(nextDueAfter(med, "2026-10-05T21:00:00.000Z", "UTC")).toBe("2026-10-12T09:00:00.000Z");
  });
  it("uses local wall-clock across DST", () => {
    const med = makeMed({ schedule: { kind: "times", times: ["08:00"] } });
    expect(nextDueAfter(med, "2026-03-08T03:00:00.000Z", TOR)).toBe("2026-03-08T12:00:00.000Z");
  });
  it("computes interval doses", () => {
    const med = makeMed({ schedule: { kind: "interval", everyHours: 8, anchor: "2026-10-05T06:00:00.000Z" } });
    expect(nextDueAfter(med, "2026-10-05T07:00:00.000Z", "UTC")).toBe("2026-10-05T14:00:00.000Z");
    expect(nextDueAfter(med, "2026-10-01T00:00:00.000Z", "UTC")).toBe("2026-10-05T06:00:00.000Z");
  });
  it("returns null for as-needed or archived medications", () => {
    expect(nextDueAfter(makeMed({ schedule: { kind: "as-needed" } }), "2026-10-05T00:00:00Z", "UTC")).toBeNull();
    expect(nextDueAfter(makeMed({ archivedAt: "2026-02-01T00:00:00Z" }), "2026-10-05T00:00:00Z", "UTC")).toBeNull();
  });
});

describe("logAsNeeded", () => {
  const med = makeMed({ schedule: { kind: "as-needed", maxPerDay: 3 } });
  const now = "2026-10-05T15:42:10.123Z";
  it("records a taken as-needed dose at now", () => {
    const d = logAsNeeded(med, now);
    expect(d).toMatchObject({
      medicationId: MED_ID,
      profileId: PROFILE_ID,
      dueAt: now,
      windowEndsAt: now,
      takenAt: now,
      source: "as-needed",
      createdAt: now,
      updatedAt: now,
    });
    expect(isUuid(d.id)).toBe(true);
  });
  it("uses an id that cannot clash with a scheduled dose at the same instant", () => {
    expect(logAsNeeded(med, now).id).not.toBe(doseIdFor(MED_ID, now));
  });
});

describe("asNeededRemaining", () => {
  const med = makeMed({ schedule: { kind: "as-needed", maxPerDay: 3 } });
  const taken = (at: string) => makeDose(at, { source: "as-needed", takenAt: at, windowEndsAt: at });
  it("is null without a daily cap", () => {
    expect(asNeededRemaining(makeMed({ schedule: { kind: "as-needed" } }), [], "2026-10-05", "UTC")).toBeNull();
  });
  it("subtracts as-needed doses taken that local day", () => {
    const doses = [taken("2026-10-05T10:00:00.000Z"), taken("2026-10-05T03:00:00.000Z"), taken("2026-10-04T23:00:00.000Z")];
    expect(asNeededRemaining(med, doses, "2026-10-05", "UTC")).toBe(1);
    expect(asNeededRemaining(med, doses, "2026-10-05", TOR)).toBe(2);
  });
  it("ignores deleted doses, other medications and never goes below zero", () => {
    const doses = [
      taken("2026-10-05T10:00:00.000Z"),
      taken("2026-10-05T11:00:00.000Z"),
      taken("2026-10-05T12:00:00.000Z"),
      taken("2026-10-05T13:00:00.000Z"),
      { ...taken("2026-10-05T14:00:00.000Z"), deletedAt: "2026-10-05T14:01:00.000Z" },
      { ...taken("2026-10-05T14:00:00.000Z"), medicationId: MED_ID_2 },
    ];
    expect(asNeededRemaining(med, doses, "2026-10-05", "UTC")).toBe(0);
    expect(asNeededRemaining(med, doses.slice(4), "2026-10-05", "UTC")).toBe(3);
  });
});
