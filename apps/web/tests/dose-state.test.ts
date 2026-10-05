import { describe, expect, it } from "vitest";
import { dayBounds, isTimeZone, localDate } from "@/lib/domain/day";
import { ESCALATE_AFTER_MINUTES, doseState, escalationDueAt } from "@/lib/domain/dose-state";

const due = new Date("2026-10-05T12:00:00.000Z");
const at = (minutes: number) => new Date(due.getTime() + minutes * 60_000);
const dose = (extra: Partial<Parameters<typeof doseState>[0]> = {}) => ({
  dueAt: due,
  takenAt: null,
  skippedAt: null,
  snoozedUntil: null,
  ...extra,
});

describe("doseState", () => {
  it("is upcoming before the due time", () => {
    expect(doseState(dose(), 60, at(-1))).toBe("upcoming");
  });

  it("is due inside the window", () => {
    expect(doseState(dose(), 60, at(0))).toBe("due");
    expect(doseState(dose(), 60, at(59))).toBe("due");
  });

  it("is late after the window until the escalation delay passes", () => {
    expect(ESCALATE_AFTER_MINUTES).toBe(30);
    expect(doseState(dose(), 60, at(60))).toBe("late");
    expect(doseState(dose(), 60, at(89))).toBe("late");
  });

  it("is missed 30 minutes after the window closes", () => {
    expect(doseState(dose(), 60, at(90))).toBe("missed");
    expect(doseState(dose(), 15, at(45))).toBe("missed");
  });

  it("taken and skipped win over the clock", () => {
    expect(doseState(dose({ takenAt: at(200) }), 60, at(300))).toBe("taken");
    expect(doseState(dose({ skippedAt: at(5) }), 60, at(300))).toBe("skipped");
    expect(doseState(dose({ takenAt: at(-5) }), 60, at(-10))).toBe("taken");
  });

  it("a snooze past the window pushes the escalation clock", () => {
    const snoozed = dose({ snoozedUntil: at(80) });
    expect(doseState(snoozed, 60, at(70))).toBe("due");
    expect(doseState(snoozed, 60, at(100))).toBe("late");
    expect(doseState(snoozed, 60, at(110))).toBe("missed");
    expect(escalationDueAt(snoozed, 60)).toEqual(at(110));
    expect(escalationDueAt(dose(), 60)).toEqual(at(90));
  });
});

describe("dayBounds", () => {
  it("is midnight to midnight UTC for UTC", () => {
    expect(dayBounds("2026-10-05", "UTC")).toEqual({
      start: new Date("2026-10-05T00:00:00.000Z"),
      end: new Date("2026-10-06T00:00:00.000Z"),
    });
  });

  it("uses the local midnight of the zone", () => {
    expect(dayBounds("2026-10-05", "America/Toronto").start).toEqual(new Date("2026-10-05T04:00:00.000Z"));
    expect(dayBounds("2026-10-05", "Asia/Kolkata").start).toEqual(new Date("2026-10-04T18:30:00.000Z"));
  });

  it("handles DST days of 23 and 25 hours", () => {
    const spring = dayBounds("2026-03-08", "America/New_York");
    expect((spring.end.getTime() - spring.start.getTime()) / 3_600_000).toBe(23);
    const fall = dayBounds("2026-11-01", "America/New_York");
    expect((fall.end.getTime() - fall.start.getTime()) / 3_600_000).toBe(25);
    expect(fall.start).toEqual(new Date("2026-11-01T04:00:00.000Z"));
  });
});

describe("localDate / isTimeZone", () => {
  it("formats the calendar date in a zone", () => {
    const instant = new Date("2026-10-05T02:00:00.000Z");
    expect(localDate(instant, "UTC")).toBe("2026-10-05");
    expect(localDate(instant, "America/Vancouver")).toBe("2026-10-04");
  });

  it("accepts IANA zones and rejects junk", () => {
    expect(isTimeZone("Europe/London")).toBe(true);
    expect(isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(isTimeZone("")).toBe(false);
  });
});
