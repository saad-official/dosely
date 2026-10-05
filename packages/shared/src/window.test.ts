import { MED_ID_2, makeDose, plusMin } from "./fixtures.test-util";
import { activeWindow, doseState, escalationDueAt, markSkipped, markTaken, snooze, timeLeftLabel, undo } from "./window";

const DUE = "2026-10-05T08:00:00.000Z";
const at = (minutes: number) => plusMin(DUE, minutes);

describe("doseState", () => {
  const dose = makeDose(DUE);
  it.each([
    [-1, "upcoming"],
    [0, "due"],
    [59, "due"],
    [60, "late"],
    [89, "late"],
    [90, "missed"],
    [600, "missed"],
  ])("at due%+i min is %s", (minutes, state) => {
    expect(doseState(dose, at(minutes))).toBe(state);
  });
  it("uses a custom escalation delay", () => {
    expect(doseState(dose, at(60), 0)).toBe("missed");
    expect(doseState(dose, at(100), 45)).toBe("late");
  });
  it("reports taken and skipped regardless of time", () => {
    expect(doseState({ ...dose, takenAt: at(200) }, at(300))).toBe("taken");
    expect(doseState({ ...dose, skippedAt: at(-30) }, at(-10))).toBe("skipped");
  });
  it("is snoozed until the snooze ends, then falls back to the clock", () => {
    const snoozed = { ...dose, snoozedUntil: at(20) };
    expect(doseState(snoozed, at(10))).toBe("snoozed");
    expect(doseState(snoozed, at(20))).toBe("due");
    expect(doseState({ ...dose, snoozedUntil: at(75) }, at(80))).toBe("late");
  });
  it("treats an as-needed dose as taken", () => {
    expect(doseState(makeDose(DUE, { source: "as-needed", takenAt: DUE, windowEndsAt: DUE }), at(5))).toBe("taken");
  });
});

describe("markTaken", () => {
  const dose = makeDose(DUE, { snoozedUntil: at(10) });
  it("sets takenAt, clears skip and snooze and bumps updatedAt", () => {
    expect(markTaken(dose, at(12))).toEqual({ ...dose, takenAt: at(12), skippedAt: null, snoozedUntil: null, updatedAt: at(12) });
  });
  it("turns a skipped dose into a taken one", () => {
    const t = markTaken({ ...dose, skippedAt: at(5) }, at(30));
    expect(t.skippedAt).toBeNull();
    expect(t.takenAt).toBe(at(30));
  });
  it("leaves an already-taken dose untouched", () => {
    const taken = markTaken(dose, at(5));
    expect(markTaken(taken, at(50))).toBe(taken);
  });
  it("does not mutate the input", () => {
    markTaken(dose, at(12));
    expect(dose.takenAt).toBeNull();
  });
});

describe("markSkipped", () => {
  const dose = makeDose(DUE);
  it("sets skippedAt and clears taken and snooze", () => {
    const s = markSkipped({ ...dose, takenAt: at(1), snoozedUntil: at(10) }, at(5));
    expect(s).toMatchObject({ skippedAt: at(5), takenAt: null, snoozedUntil: null, updatedAt: at(5) });
  });
  it("leaves an already-skipped dose untouched", () => {
    const s = markSkipped(dose, at(5));
    expect(markSkipped(s, at(9))).toBe(s);
  });
});

describe("snooze", () => {
  const dose = makeDose(DUE);
  it("sets snoozedUntil now + minutes", () => {
    expect(snooze(dose, at(10), 10)).toMatchObject({ snoozedUntil: at(20), updatedAt: at(10) });
  });
  it("caps the snooze at window end + escalation", () => {
    expect(snooze(dose, at(85), 10).snoozedUntil).toBe(at(90));
    expect(snooze(dose, at(50), 60, 15).snoozedUntil).toBe(at(75));
  });
  it("does nothing once the dose is missed, taken or skipped", () => {
    expect(snooze(dose, at(90), 10)).toBe(dose);
    const taken = { ...dose, takenAt: at(1) };
    expect(snooze(taken, at(5), 10)).toBe(taken);
    const skipped = { ...dose, skippedAt: at(1) };
    expect(snooze(skipped, at(5), 10)).toBe(skipped);
  });
  it("rejects non-positive minutes", () => {
    expect(() => snooze(dose, at(5), 0)).toThrow(RangeError);
  });
});

describe("undo", () => {
  it("clears taken, skipped and snooze marks", () => {
    const d = makeDose(DUE, { takenAt: at(3), snoozedUntil: null });
    expect(undo(d, at(4))).toMatchObject({ takenAt: null, skippedAt: null, snoozedUntil: null, updatedAt: at(4) });
  });
  it("leaves an unmarked dose untouched", () => {
    const d = makeDose(DUE);
    expect(undo(d, at(4))).toBe(d);
  });
});

describe("escalationDueAt", () => {
  it("is window end + escalation minutes", () => {
    expect(escalationDueAt(makeDose(DUE), 30)).toBe(at(90));
    expect(escalationDueAt(makeDose(DUE), 0)).toBe(at(60));
  });
});

describe("activeWindow", () => {
  const a = makeDose(DUE);
  const b = makeDose(DUE, { medicationId: MED_ID_2, windowEndsAt: at(30) });
  const c = makeDose(plusMin(DUE, 240));
  it("groups the open doses whose window contains now", () => {
    expect(activeWindow([c, a, b], at(10))).toEqual({
      doseIds: [a.id, b.id],
      earliestDueAt: DUE,
      latestWindowEndsAt: at(60),
      remaining: 2,
      total: 2,
    });
  });
  it("counts marked doses in total but not remaining", () => {
    const w = activeWindow([{ ...a, takenAt: at(5) }, b, c], at(10));
    expect(w).toEqual({ doseIds: [b.id], earliestDueAt: DUE, latestWindowEndsAt: at(30), remaining: 1, total: 2 });
  });
  it("drops doses whose window has closed", () => {
    expect(activeWindow([a, b, c], at(40))?.doseIds).toEqual([a.id]);
  });
  it("keeps snoozed doses as open", () => {
    expect(activeWindow([{ ...a, snoozedUntil: at(20) }], at(10))?.remaining).toBe(1);
  });
  it("is null when every dose in the window is marked", () => {
    expect(activeWindow([{ ...a, takenAt: at(1) }, { ...b, skippedAt: at(2) }], at(10))).toBeNull();
  });
  it("is null outside any window and ignores deleted and as-needed doses", () => {
    expect(activeWindow([a, b, c], at(-5))).toBeNull();
    expect(activeWindow([{ ...a, deletedAt: at(0) }], at(10))).toBeNull();
    expect(activeWindow([makeDose(DUE, { source: "as-needed", windowEndsAt: at(60) })], at(10))).toBeNull();
  });
});

describe("timeLeftLabel", () => {
  it("counts whole minutes up under an hour", () => {
    expect(timeLeftLabel(at(35), DUE)).toBe("35 min left");
    expect(timeLeftLabel(at(35), Date.parse(at(0)) + 30_000)).toBe("35 min left");
  });
  it("shows hours with zero-padded minutes", () => {
    expect(timeLeftLabel(at(65), DUE)).toBe("1 h 05 min left");
    expect(timeLeftLabel(at(120), DUE)).toBe("2 h left");
  });
  it("says the window ends now at or after its end", () => {
    expect(timeLeftLabel(DUE, DUE)).toBe("ends now");
    expect(timeLeftLabel(DUE, at(5))).toBe("ends now");
  });
});
