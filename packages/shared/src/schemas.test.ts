import {
  CircleMemberSchema,
  CircleSchema,
  DEFAULT_SETTINGS,
  DeviceSchema,
  DoseSchema,
  EscalationReportSchema,
  HhmmSchema,
  MED_COLOR_NAMES,
  MED_ICONS,
  MED_PALETTE,
  MedicationSchema,
  ProfileSchema,
  ScheduleSchema,
  SettingsSchema,
  SyncPullResponseSchema,
  SyncPushRequestSchema,
  SyncPushResponseSchema,
} from "./schemas";

const ID = "0199b3a0-0000-7000-8000-000000000001";
const ID2 = "0199b3a0-0000-7000-8000-000000000002";
const ID3 = "0199b3a0-0000-7000-8000-000000000003";
const T = "2026-10-05T13:00:00.000Z";

const profile = { id: ID, name: "Mom", color: "teal", initial: "M", isSelf: false, createdAt: T, updatedAt: T };
const med = {
  id: ID2,
  profileId: ID,
  name: "Metformin",
  form: "tablet",
  color: "blue",
  icon: "pill",
  schedule: { kind: "times", times: ["08:00", "20:00"] },
  createdAt: T,
  updatedAt: T,
};
const dose = {
  id: ID3,
  medicationId: ID2,
  profileId: ID,
  dueAt: "2026-10-05T12:00:00.000Z",
  windowEndsAt: "2026-10-05T13:00:00.000Z",
  source: "scheduled",
  createdAt: T,
  updatedAt: T,
};

describe("MED_PALETTE and MED_ICONS", () => {
  it("has ten distinct named hex colours", () => {
    expect(MED_PALETTE).toHaveLength(10);
    expect(new Set(MED_PALETTE.map((c) => c.name)).size).toBe(10);
    for (const c of MED_PALETTE) expect(c.hex).toMatch(/^#[0-9A-F]{6}$/);
    expect(MED_COLOR_NAMES).toEqual(MED_PALETTE.map((c) => c.name));
  });
  it("lists distinct icon names including pill", () => {
    expect(MED_ICONS).toContain("pill");
    expect(new Set(MED_ICONS).size).toBe(MED_ICONS.length);
  });
});

describe("HhmmSchema", () => {
  it("accepts 24-hour HH:mm", () => {
    expect(HhmmSchema.safeParse("00:00").success).toBe(true);
    expect(HhmmSchema.safeParse("23:59").success).toBe(true);
  });
  it("rejects out-of-range or unpadded times", () => {
    for (const bad of ["24:00", "8:00", "12:60", "12:5", "noon"]) expect(HhmmSchema.safeParse(bad).success, bad).toBe(false);
  });
});

describe("ProfileSchema", () => {
  it("parses a profile", () => {
    expect(ProfileSchema.parse(profile).initial).toBe("M");
  });
  it("rejects an empty name and a long initial", () => {
    expect(ProfileSchema.safeParse({ ...profile, name: " " }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...profile, initial: "MOM" }).success).toBe(false);
  });
});

describe("ScheduleSchema", () => {
  it("parses fixed times with an optional weekday subset", () => {
    expect(ScheduleSchema.parse({ kind: "times", times: ["08:00"], days: [1, 3, 5] })).toEqual({
      kind: "times",
      times: ["08:00"],
      days: [1, 3, 5],
    });
  });
  it("rejects empty times, duplicate times and bad weekdays", () => {
    expect(ScheduleSchema.safeParse({ kind: "times", times: [] }).success).toBe(false);
    expect(ScheduleSchema.safeParse({ kind: "times", times: ["08:00", "08:00"] }).success).toBe(false);
    expect(ScheduleSchema.safeParse({ kind: "times", times: ["08:00"], days: [7] }).success).toBe(false);
    expect(ScheduleSchema.safeParse({ kind: "times", times: ["08:00"], days: [] }).success).toBe(false);
    expect(ScheduleSchema.safeParse({ kind: "times", times: ["08:00"], days: [1, 1] }).success).toBe(false);
  });
  it("parses an interval with an anchor", () => {
    expect(ScheduleSchema.safeParse({ kind: "interval", everyHours: 8, anchor: T }).success).toBe(true);
  });
  it("rejects a non-positive or over-a-week interval", () => {
    expect(ScheduleSchema.safeParse({ kind: "interval", everyHours: 0, anchor: T }).success).toBe(false);
    expect(ScheduleSchema.safeParse({ kind: "interval", everyHours: 169, anchor: T }).success).toBe(false);
  });
  it("parses as-needed with or without a daily cap", () => {
    expect(ScheduleSchema.safeParse({ kind: "as-needed" }).success).toBe(true);
    expect(ScheduleSchema.safeParse({ kind: "as-needed", maxPerDay: 4 }).success).toBe(true);
    expect(ScheduleSchema.safeParse({ kind: "as-needed", maxPerDay: 0 }).success).toBe(false);
  });
  it("rejects an unknown kind", () => {
    expect(ScheduleSchema.safeParse({ kind: "monthly" }).success).toBe(false);
  });
});

describe("MedicationSchema", () => {
  it("defaults the dose window to 60 minutes", () => {
    expect(MedicationSchema.parse(med).windowMinutes).toBe(60);
  });
  it("accepts inventory, strength and nullable optionals", () => {
    const m = MedicationSchema.parse({
      ...med,
      strength: "500 mg",
      inventoryCount: 30,
      refillThreshold: 7,
      archivedAt: null,
      deletedAt: null,
    });
    expect(m.inventoryCount).toBe(30);
  });
  it("rejects an unknown form, colour or icon", () => {
    expect(MedicationSchema.safeParse({ ...med, form: "gummy" }).success).toBe(false);
    expect(MedicationSchema.safeParse({ ...med, color: "#123456" }).success).toBe(false);
    expect(MedicationSchema.safeParse({ ...med, icon: "rocket" }).success).toBe(false);
  });
  it("rejects negative inventory and a zero window", () => {
    expect(MedicationSchema.safeParse({ ...med, inventoryCount: -1 }).success).toBe(false);
    expect(MedicationSchema.safeParse({ ...med, windowMinutes: 0 }).success).toBe(false);
  });
  it("rejects a non-uuid profile id", () => {
    expect(MedicationSchema.safeParse({ ...med, profileId: "mom" }).success).toBe(false);
  });
});

describe("DoseSchema", () => {
  it("parses a scheduled dose", () => {
    expect(DoseSchema.parse(dose).source).toBe("scheduled");
  });
  it("rejects a window ending before the due time", () => {
    expect(DoseSchema.safeParse({ ...dose, windowEndsAt: "2026-10-05T11:00:00.000Z" }).success).toBe(false);
  });
  it("rejects a dose that is both taken and skipped", () => {
    expect(DoseSchema.safeParse({ ...dose, takenAt: T, skippedAt: T }).success).toBe(false);
  });
  it("accepts nulls for unset marks", () => {
    expect(
      DoseSchema.safeParse({ ...dose, takenAt: null, skippedAt: null, snoozedUntil: null, deletedAt: null }).success,
    ).toBe(true);
  });
});

describe("SettingsSchema", () => {
  it("fills defaults", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      onboarded: false,
      theme: "default",
      autoSeasonal: false,
      region: "both",
      escalationMinutes: 30,
      appearance: "system",
    });
  });
  it("stores the colour-scheme preference: system, light or dark", () => {
    expect(SettingsSchema.parse({ appearance: "dark" }).appearance).toBe("dark");
    expect(SettingsSchema.parse({ appearance: "light" }).appearance).toBe("light");
    expect(SettingsSchema.safeParse({ appearance: "sepia" }).success).toBe(false);
  });
  it("accepts a season theme and quiet hours", () => {
    const s = SettingsSchema.parse({ theme: "halloween", quietHours: { start: "22:00", end: "07:00" } });
    expect(s.theme).toBe("halloween");
    expect(s.quietHours).toEqual({ start: "22:00", end: "07:00" });
  });
  it("rejects an unknown theme or region", () => {
    expect(SettingsSchema.safeParse({ theme: "auto" }).success).toBe(false);
    expect(SettingsSchema.safeParse({ region: "MX" }).success).toBe(false);
  });
});

describe("circle and device schemas", () => {
  const circle = { id: ID, name: "Family", ownerUserId: "u1", inviteCode: "K7QX4M", createdAt: T, updatedAt: T };
  it("parses a circle with an invite code", () => {
    expect(CircleSchema.safeParse(circle).success).toBe(true);
    expect(CircleSchema.safeParse({ ...circle, inviteCode: "k7" }).success).toBe(false);
  });
  it("parses a caregiver member", () => {
    const m = { id: ID2, circleId: ID, userId: "u2", displayName: "Sam", role: "caregiver", joinedAt: T, createdAt: T, updatedAt: T };
    expect(CircleMemberSchema.parse(m).role).toBe("caregiver");
    expect(CircleMemberSchema.safeParse({ ...m, role: "admin" }).success).toBe(false);
  });
  it("parses a device", () => {
    expect(
      DeviceSchema.safeParse({ userId: "u1", expoPushToken: "ExponentPushToken[x]", platform: "ios", lastSeenAt: T }).success,
    ).toBe(true);
  });
  it("parses an escalation report with at least one dose", () => {
    const r = { deviceId: "d1", doses: [{ doseId: ID3, medicationId: ID2, profileId: ID, dueAt: T }] };
    expect(EscalationReportSchema.safeParse(r).success).toBe(true);
    expect(EscalationReportSchema.safeParse({ ...r, doses: [] }).success).toBe(false);
  });
});

describe("sync payloads", () => {
  it("defaults push tables to empty arrays", () => {
    expect(SyncPushRequestSchema.parse({ deviceId: "d1" }).tables).toEqual({ profiles: [], medications: [], doses: [] });
  });
  it("validates rows inside the tables", () => {
    expect(
      SyncPushRequestSchema.safeParse({ deviceId: "d1", tables: { profiles: [profile], medications: [med], doses: [dose] } })
        .success,
    ).toBe(true);
    expect(SyncPushRequestSchema.safeParse({ deviceId: "d1", tables: { doses: [{ ...dose, id: "x" }] } }).success).toBe(false);
  });
  it("parses push and pull responses", () => {
    expect(SyncPushResponseSchema.parse({ serverTime: T, accepted: 3 }).accepted).toBe(3);
    expect(SyncPullResponseSchema.parse({ serverTime: T }).tables.doses).toEqual([]);
  });
});
