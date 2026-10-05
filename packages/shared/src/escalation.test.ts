import { MED_ID, MED_ID_2, makeDose, plusMin } from "./fixtures.test-util";
import { caregiverMessage, groupEscalations, missedDosesForEscalation } from "./escalation";

const DUE = "2026-10-05T12:00:00.000Z";
const at = (minutes: number) => plusMin(DUE, minutes);
const OTHER_PROFILE = "0199b3a0-0000-7000-8000-0000000000a2";

describe("missedDosesForEscalation", () => {
  const missed = makeDose(DUE);
  const late = makeDose(at(30));
  const taken = makeDose(DUE, { takenAt: at(70) });
  const skipped = makeDose(DUE, { skippedAt: at(70) });
  const earlier = makeDose(at(-60));

  it("returns unmarked doses past window end + escalation, oldest first", () => {
    expect(missedDosesForEscalation([late, missed, taken, skipped, earlier], at(95), 30, new Set()).map((d) => d.id)).toEqual([
      earlier.id,
      missed.id,
    ]);
  });
  it("leaves out doses already notified", () => {
    expect(missedDosesForEscalation([missed, earlier], at(95), 30, new Set([earlier.id])).map((d) => d.id)).toEqual([missed.id]);
  });
  it("uses the given escalation delay", () => {
    expect(missedDosesForEscalation([missed], at(70), 30, new Set())).toEqual([]);
    expect(missedDosesForEscalation([missed], at(70), 10, new Set())).toHaveLength(1);
  });
  it("ignores as-needed and deleted doses", () => {
    const doses = [makeDose(DUE, { source: "as-needed" }), makeDose(DUE, { deletedAt: at(1) })];
    expect(missedDosesForEscalation(doses, at(200), 30, new Set())).toEqual([]);
  });
  it("does not escalate doses that went missed more than a day ago by default", () => {
    expect(missedDosesForEscalation([missed], at(90 + 24 * 60 + 1), 30, new Set())).toEqual([]);
    expect(missedDosesForEscalation([missed], at(90 + 24 * 60 - 1), 30, new Set())).toHaveLength(1);
  });
  it("accepts a custom max age", () => {
    expect(missedDosesForEscalation([missed], at(200), 30, new Set(), 60)).toEqual([]);
  });
});

describe("groupEscalations", () => {
  it("groups missed doses by profile and due time", () => {
    const a = makeDose(DUE);
    const b = makeDose(DUE, { medicationId: MED_ID_2 });
    const c = makeDose(at(60));
    const d = makeDose(DUE, { profileId: OTHER_PROFILE });
    expect(groupEscalations([a, b, c, d])).toEqual([
      { profileId: a.profileId, dueAt: DUE, doseIds: [a.id, b.id], medicationIds: [MED_ID, MED_ID_2] },
      { profileId: OTHER_PROFILE, dueAt: DUE, doseIds: [d.id], medicationIds: [MED_ID] },
      { profileId: a.profileId, dueAt: at(60), doseIds: [c.id], medicationIds: [MED_ID] },
    ]);
  });
  it("is empty for no doses", () => {
    expect(groupEscalations([])).toEqual([]);
  });
});

describe("caregiverMessage", () => {
  const TOR = "America/Toronto";
  it("names the person, medication and local due time", () => {
    expect(caregiverMessage("Mom", ["Metformin"], DUE, TOR, "en-US")).toBe("Mom hasn't marked Metformin as taken (due 8:00 AM).");
  });
  it("joins two and three medications", () => {
    expect(caregiverMessage("Mom", ["Metformin", "Lisinopril"], DUE, TOR, "en-US")).toBe(
      "Mom hasn't marked Metformin and Lisinopril as taken (due 8:00 AM).",
    );
    expect(caregiverMessage("Mom", ["A", "B", "C"], DUE, TOR, "en-US")).toBe("Mom hasn't marked A, B and C as taken (due 8:00 AM).");
  });
  it("shortens long lists", () => {
    expect(caregiverMessage("Mom", ["A", "B", "C", "D", "E"], DUE, TOR, "en-US")).toBe(
      "Mom hasn't marked A, B and 3 more as taken (due 8:00 AM).",
    );
  });
  it("falls back to 'a dose' with no names", () => {
    expect(caregiverMessage("Dad", [], DUE, "UTC", "en-US")).toBe("Dad hasn't marked a dose as taken (due 12:00 PM).");
  });
  it("defaults to en-US in UTC", () => {
    expect(caregiverMessage("Dad", ["Aspirin"], DUE)).toBe("Dad hasn't marked Aspirin as taken (due 12:00 PM).");
  });
  it("writes French for fr locales", () => {
    expect(caregiverMessage("Maman", ["Metformine", "Lisinopril"], DUE, TOR, "fr-CA")).toBe(
      "Maman n'a pas indiqué avoir pris Metformine et Lisinopril (prévu à 8 h 00).",
    );
    expect(caregiverMessage("Papa", [], DUE, TOR, "fr-CA")).toBe("Papa n'a pas indiqué avoir pris une dose (prévu à 8 h 00).");
  });
  it("uses only plain spaces", () => {
    expect(caregiverMessage("Mom", ["A"], DUE, TOR, "en-US")).not.toMatch(/[  ]/);
  });
});
