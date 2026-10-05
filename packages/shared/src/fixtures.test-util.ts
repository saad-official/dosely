import type { Dose, Medication } from "./schemas";

export const PROFILE_ID = "0199b3a0-0000-7000-8000-0000000000a1";
export const MED_ID = "0199b3a0-0000-7000-8000-0000000000b1";
export const MED_ID_2 = "0199b3a0-0000-7000-8000-0000000000b2";
export const CREATED = "2026-01-01T00:00:00.000Z";

export function makeMed(overrides: Partial<Medication> = {}): Medication {
  return {
    id: MED_ID,
    profileId: PROFILE_ID,
    name: "Metformin",
    form: "tablet",
    color: "teal",
    icon: "pill",
    schedule: { kind: "times", times: ["08:00", "20:00"] },
    windowMinutes: 60,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

let seq = 0;

/** A scheduled dose due at `dueAt` with a 60-minute window unless overridden. */
export function makeDose(dueAt: string, overrides: Partial<Dose> = {}): Dose {
  seq += 1;
  const windowEndsAt = new Date(Date.parse(dueAt) + 60 * 60_000).toISOString();
  return {
    id: `0199b3a0-0000-7000-8000-${String(seq).padStart(12, "0")}`,
    medicationId: MED_ID,
    profileId: PROFILE_ID,
    dueAt,
    windowEndsAt,
    takenAt: null,
    skippedAt: null,
    snoozedUntil: null,
    source: "scheduled",
    createdAt: CREATED,
    updatedAt: CREATED,
    deletedAt: null,
    ...overrides,
  };
}

export const iso = (ms: number) => new Date(ms).toISOString();
export const plusMin = (at: string, minutes: number) => iso(Date.parse(at) + minutes * 60_000);
