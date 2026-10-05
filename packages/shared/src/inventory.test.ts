import { makeMed } from "./fixtures.test-util";
import { daysLeft, decrement, dosesPerDay, increment, needsRefill, refillDate } from "./inventory";

const NOW = "2026-10-05T12:00:00.000Z";

describe("dosesPerDay", () => {
  it("counts fixed times per day", () => {
    expect(dosesPerDay({ kind: "times", times: ["08:00", "14:00", "20:00"] })).toBe(3);
  });
  it("averages a weekday subset over the week", () => {
    expect(dosesPerDay({ kind: "times", times: ["08:00"], days: [1, 4] })).toBeCloseTo(2 / 7);
  });
  it("divides 24 by the interval", () => {
    expect(dosesPerDay({ kind: "interval", everyHours: 8, anchor: NOW })).toBe(3);
    expect(dosesPerDay({ kind: "interval", everyHours: 36, anchor: NOW })).toBeCloseTo(2 / 3);
  });
  it("is zero for as-needed", () => {
    expect(dosesPerDay({ kind: "as-needed", maxPerDay: 4 })).toBe(0);
  });
});

describe("decrement", () => {
  it("removes one unit and bumps updatedAt", () => {
    expect(decrement(makeMed({ inventoryCount: 30 }), NOW)).toMatchObject({ inventoryCount: 29, updatedAt: NOW });
  });
  it("removes several units", () => {
    expect(decrement(makeMed({ inventoryCount: 30 }), NOW, 2).inventoryCount).toBe(28);
  });
  it("never goes below zero", () => {
    expect(decrement(makeMed({ inventoryCount: 1 }), NOW, 2).inventoryCount).toBe(0);
  });
  it("leaves untracked inventory alone", () => {
    const med = makeMed({ inventoryCount: null });
    expect(decrement(med, NOW)).toBe(med);
    const med2 = makeMed();
    expect(decrement(med2, NOW)).toBe(med2);
  });
});

describe("increment", () => {
  it("adds units back (undo of a take)", () => {
    expect(increment(makeMed({ inventoryCount: 0 }), NOW)).toMatchObject({ inventoryCount: 1, updatedAt: NOW });
  });
  it("leaves untracked inventory alone", () => {
    const med = makeMed();
    expect(increment(med, NOW)).toBe(med);
  });
});

describe("daysLeft", () => {
  it("is whole days of supply", () => {
    expect(daysLeft(makeMed({ inventoryCount: 30 }), 2)).toBe(15);
    expect(daysLeft(makeMed({ inventoryCount: 31 }), 2)).toBe(15);
    expect(daysLeft(makeMed({ inventoryCount: 1 }), 2)).toBe(0);
  });
  it("is null without inventory or with no regular doses", () => {
    expect(daysLeft(makeMed(), 2)).toBeNull();
    expect(daysLeft(makeMed({ inventoryCount: 10 }), 0)).toBeNull();
  });
});

describe("refillDate", () => {
  it("is the local day the supply runs out", () => {
    expect(refillDate(makeMed({ inventoryCount: 30 }), 2, "2026-10-05")).toBe("2026-10-20");
    expect(refillDate(makeMed({ inventoryCount: 0 }), 2, "2026-10-05")).toBe("2026-10-05");
  });
  it("is null when days left is unknown", () => {
    expect(refillDate(makeMed(), 2, "2026-10-05")).toBeNull();
  });
});

describe("needsRefill", () => {
  it("is true at or below the threshold", () => {
    expect(needsRefill(makeMed({ inventoryCount: 7, refillThreshold: 7 }))).toBe(true);
    expect(needsRefill(makeMed({ inventoryCount: 3, refillThreshold: 7 }))).toBe(true);
    expect(needsRefill(makeMed({ inventoryCount: 8, refillThreshold: 7 }))).toBe(false);
  });
  it("is false when inventory or threshold is unset", () => {
    expect(needsRefill(makeMed({ inventoryCount: 0 }))).toBe(false);
    expect(needsRefill(makeMed({ refillThreshold: 5 }))).toBe(false);
  });
});
