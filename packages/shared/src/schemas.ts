import { z } from "zod";
import { isUuid } from "./ids";
import { REGIONS } from "./seasons";
import { THEME_IDS } from "./themes";

/** Medication / profile colours. Names are stored; hex is for rendering. */
export const MED_PALETTE = [
  { name: "teal", hex: "#1FA39A" },
  { name: "blue", hex: "#3B82C4" },
  { name: "indigo", hex: "#5B6BC9" },
  { name: "violet", hex: "#8B64C8" },
  { name: "pink", hex: "#D46A9A" },
  { name: "red", hex: "#D0574F" },
  { name: "orange", hex: "#E07E3C" },
  { name: "amber", hex: "#D9A23A" },
  { name: "green", hex: "#4E9F5B" },
  { name: "slate", hex: "#64748B" },
] as const;
export type MedColor = (typeof MED_PALETTE)[number]["name"];
export const MED_COLOR_NAMES = MED_PALETTE.map((c) => c.name) as [MedColor, ...MedColor[]];

/** Icon names; the app maps each to an SF Symbol / Material icon. */
export const MED_ICONS = [
  "pill",
  "capsule",
  "tablet",
  "bottle",
  "syringe",
  "inhaler",
  "drops",
  "patch",
  "spoon",
  "heart",
  "sun",
  "moon",
] as const;
export type MedIcon = (typeof MED_ICONS)[number];

export const MED_FORMS = ["tablet", "capsule", "liquid", "injection", "inhaler", "drops", "patch", "other"] as const;

/** ISO-8601 timestamp, `Z` or numeric offset. */
export const IsoTimestamp = z.iso.datetime({ offset: true });
export const IdSchema = z.string().refine(isUuid, "Invalid UUID");
export const DayKeySchema = z.iso.date();
/** 24-hour local wall-clock time, zero-padded `HH:mm`. */
export const HhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm");
export const WeekdaySchema = z.number().int().min(0).max(6);
export const MedFormSchema = z.enum(MED_FORMS);
export const MedColorSchema = z.enum(MED_COLOR_NAMES);
export const MedIconSchema = z.enum(MED_ICONS);
export const ThemeIdSchema = z.enum(THEME_IDS);
export const RegionSchema = z.enum(REGIONS);
export const DoseSourceSchema = z.enum(["scheduled", "as-needed"]);

const unique = <T>(xs: readonly T[]) => new Set(xs).size === xs.length;

const syncFields = {
  createdAt: IsoTimestamp,
  updatedAt: IsoTimestamp,
  deletedAt: IsoTimestamp.nullish(),
};

export const ProfileSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(80),
  color: MedColorSchema,
  initial: z.string().trim().min(1).max(2),
  isSelf: z.boolean(),
  ...syncFields,
});

export const TimesScheduleSchema = z.object({
  kind: z.literal("times"),
  times: z.array(HhmmSchema).min(1).max(24).refine(unique, "Duplicate time"),
  /** Weekday subset, 0 = Sunday … 6 = Saturday; absent = every day. */
  days: z.array(WeekdaySchema).min(1).max(7).refine(unique, "Duplicate weekday").optional(),
});

export const IntervalScheduleSchema = z.object({
  kind: z.literal("interval"),
  everyHours: z.number().positive().max(168),
  /** First dose instant; later doses are `anchor + k * everyHours` of elapsed time. */
  anchor: IsoTimestamp,
});

export const AsNeededScheduleSchema = z.object({
  kind: z.literal("as-needed"),
  maxPerDay: z.number().int().positive().max(48).optional(),
});

export const ScheduleSchema = z.discriminatedUnion("kind", [TimesScheduleSchema, IntervalScheduleSchema, AsNeededScheduleSchema]);

export const MedicationSchema = z.object({
  id: IdSchema,
  profileId: IdSchema,
  name: z.string().trim().min(1).max(120),
  strength: z.string().trim().max(60).nullish(),
  form: MedFormSchema,
  instructions: z.string().max(500).nullish(),
  color: MedColorSchema,
  icon: MedIconSchema,
  schedule: ScheduleSchema,
  windowMinutes: z.number().int().min(5).max(720).default(60),
  inventoryCount: z.number().nonnegative().nullish(),
  refillThreshold: z.number().nonnegative().nullish(),
  archivedAt: IsoTimestamp.nullish(),
  ...syncFields,
});

export const DoseSchema = z
  .object({
    id: IdSchema,
    medicationId: IdSchema,
    profileId: IdSchema,
    dueAt: IsoTimestamp,
    windowEndsAt: IsoTimestamp,
    takenAt: IsoTimestamp.nullish(),
    skippedAt: IsoTimestamp.nullish(),
    snoozedUntil: IsoTimestamp.nullish(),
    source: DoseSourceSchema,
    ...syncFields,
  })
  .refine((d) => Date.parse(d.windowEndsAt) >= Date.parse(d.dueAt), {
    message: "windowEndsAt must not be before dueAt",
    path: ["windowEndsAt"],
  })
  .refine((d) => !(d.takenAt && d.skippedAt), { message: "A dose cannot be both taken and skipped", path: ["skippedAt"] });

export const QuietHoursSchema = z.object({ start: HhmmSchema, end: HhmmSchema });

/** Colour-scheme preference: follow the system, or force light / dark. */
export const APPEARANCES = ["system", "light", "dark"] as const;
export const AppearanceSchema = z.enum(APPEARANCES);

export const SettingsSchema = z.object({
  onboarded: z.boolean().default(false),
  /** Picked theme. With `autoSeasonal` on, the date's season overrides it (see `effectiveTheme`). */
  theme: ThemeIdSchema.default("default"),
  autoSeasonal: z.boolean().default(false),
  region: RegionSchema.default("both"),
  /** Minutes after a dose window closes before it counts as missed and caregivers are told. */
  escalationMinutes: z.number().int().min(0).max(24 * 60).default(30),
  quietHours: QuietHoursSchema.optional(),
  /** Device colour scheme override (System / Light / Dark in Settings). */
  appearance: AppearanceSchema.default("system"),
});

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

/** Invite codes: 6–8 chars, uppercase, no look-alikes (0 O 1 I L). */
export const InviteCodeSchema = z.string().regex(/^[A-HJKMNP-Z2-9]{6,8}$/, "Invalid invite code");

export const CircleSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(80),
  ownerUserId: z.string().min(1),
  inviteCode: InviteCodeSchema,
  ...syncFields,
});

export const CircleMemberSchema = z.object({
  id: IdSchema,
  circleId: IdSchema,
  userId: z.string().min(1),
  displayName: z.string().trim().min(1).max(80),
  /** `owner` created the circle and shares their profiles; caregivers get read-only views and escalations. */
  role: z.enum(["owner", "member", "caregiver"]),
  joinedAt: IsoTimestamp,
  ...syncFields,
});

export const DeviceSchema = z.object({
  userId: z.string().min(1),
  expoPushToken: z.string().min(1),
  platform: z.enum(["ios", "android"]),
  lastSeenAt: IsoTimestamp,
});

/** Device → server: doses it detected as missed, for fan-out to caregivers. */
export const EscalationReportSchema = z.object({
  deviceId: z.string().min(1),
  doses: z
    .array(z.object({ doseId: IdSchema, medicationId: IdSchema, profileId: IdSchema, dueAt: IsoTimestamp }))
    .min(1)
    .max(200),
});

export const SyncTablesSchema = z.object({
  profiles: z.array(ProfileSchema).default([]),
  medications: z.array(MedicationSchema).default([]),
  doses: z.array(DoseSchema).default([]),
});

const EMPTY_TABLES = { profiles: [], medications: [], doses: [] };

/** Device → server: rows dirtied since the last push (soft deletes carry `deletedAt`). */
export const SyncPushRequestSchema = z.object({
  deviceId: z.string().min(1),
  tables: SyncTablesSchema.default(EMPTY_TABLES),
});

export const SyncPushResponseSchema = z.object({
  serverTime: IsoTimestamp,
  accepted: z.number().int().nonnegative(),
});

/** Server → device: rows changed since `?since=`; `serverTime` becomes the next `since`. */
export const SyncPullResponseSchema = z.object({
  serverTime: IsoTimestamp,
  tables: SyncTablesSchema.default(EMPTY_TABLES),
});

export type MedForm = z.infer<typeof MedFormSchema>;
export type DoseSource = z.infer<typeof DoseSourceSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type TimesSchedule = z.infer<typeof TimesScheduleSchema>;
export type IntervalSchedule = z.infer<typeof IntervalScheduleSchema>;
export type AsNeededSchedule = z.infer<typeof AsNeededScheduleSchema>;
export type Schedule = z.infer<typeof ScheduleSchema>;
export type Medication = z.infer<typeof MedicationSchema>;
export type Dose = z.infer<typeof DoseSchema>;
export type QuietHours = z.infer<typeof QuietHoursSchema>;
export type Appearance = z.infer<typeof AppearanceSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Circle = z.infer<typeof CircleSchema>;
export type CircleMember = z.infer<typeof CircleMemberSchema>;
export type Device = z.infer<typeof DeviceSchema>;
export type EscalationReport = z.infer<typeof EscalationReportSchema>;
export type SyncTables = z.infer<typeof SyncTablesSchema>;
export type SyncPushRequest = z.infer<typeof SyncPushRequestSchema>;
export type SyncPushResponse = z.infer<typeof SyncPushResponseSchema>;
export type SyncPullResponse = z.infer<typeof SyncPullResponseSchema>;
