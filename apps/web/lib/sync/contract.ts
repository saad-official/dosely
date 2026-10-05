import { z } from "zod";

/**
 * Wire contract for `POST /api/sync/push` and `GET /api/sync/pull` (the Expo
 * app's `src/data` sync client speaks exactly this). Only people who share
 * with a caregiver circle sync; everyone else stays device-only.
 *
 * Push body: `{ deviceId?, tables: { profiles?, medications?, doses? } }`,
 * each row with its device UUID, ISO `createdAt` / `updatedAt` and a
 * `deletedAt` tombstone (null when live). Every stored copy of the same
 * (account, id) is merged last-write-wins (lib/sync/merge.ts). Rows whose
 * version is more than a day ahead of the server clock are refused (a wrong
 * device clock must not win every future conflict). Answer:
 * `{ serverTime, accepted }`.
 *
 * Pull (`?since=<serverTime>`): the caller's rows written on the server after
 * `since` (all when omitted), tombstones included, as `{ serverTime, tables }`.
 * `serverTime` is the next `since`; it lags the clock by a few seconds so a
 * push committing during a pull is re-sent next time instead of being missed.
 */

export const SYNC_TABLES = ["profiles", "medications", "doses"] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

/** Max rows per table in one push. */
export const MAX_PUSH_ROWS = 2000;
/** How far the pull cursor (`serverTime`) lags the server clock. */
export const PULL_OVERLAP_MS = 5_000;
/** Row versions further than this ahead of the server clock are refused. */
export const MAX_CLOCK_SKEW_MS = 86_400_000;

export const IsoTimestamp = z.iso.datetime({ offset: true });
const nullableTimestamp = IsoTimestamp.nullable().default(null);
const nullableText = (max: number) => z.string().max(max).nullable().default(null);
const nullableCount = z.number().int().min(0).max(100_000).nullable().default(null);
const id = z.uuid();

const syncColumns = {
  id,
  createdAt: IsoTimestamp,
  updatedAt: IsoTimestamp,
  deletedAt: nullableTimestamp,
};

export const ProfileRowSchema = z.object({
  ...syncColumns,
  name: z.string().min(1).max(80),
  color: z.string().min(1).max(32),
  avatarInitial: nullableText(2),
});

export const MedicationRowSchema = z.object({
  ...syncColumns,
  profileId: id,
  name: z.string().min(1).max(120),
  strength: nullableText(60),
  form: nullableText(40),
  instructions: nullableText(500),
  color: nullableText(32),
  /** The device's schedule JSON (expanded on the device; stored as-is). */
  schedule: z.json(),
  windowMinutes: z.number().int().min(5).max(720).default(60),
  inventoryCount: nullableCount,
  refillThreshold: nullableCount,
});

export const DoseRowSchema = z.object({
  ...syncColumns,
  medicationId: id,
  dueAt: IsoTimestamp,
  takenAt: nullableTimestamp,
  skippedAt: nullableTimestamp,
  snoozedUntil: nullableTimestamp,
  source: z.string().min(1).max(32).default("schedule"),
});

export const ROW_SCHEMAS = {
  profiles: ProfileRowSchema,
  medications: MedicationRowSchema,
  doses: DoseRowSchema,
} as const;

export type ProfileRow = z.infer<typeof ProfileRowSchema>;
export type MedicationRow = z.infer<typeof MedicationRowSchema>;
export type DoseRow = z.infer<typeof DoseRowSchema>;
export type SyncTables = { profiles: ProfileRow[]; medications: MedicationRow[]; doses: DoseRow[] };

const rows = <T extends z.ZodType>(schema: T) =>
  z.array(schema).max(MAX_PUSH_ROWS, `At most ${MAX_PUSH_ROWS} rows per table per push.`).default([]);

export const SyncPushRequestSchema = z.object({
  deviceId: z.string().max(128).optional(),
  tables: z
    .object({
      profiles: rows(ProfileRowSchema),
      medications: rows(MedicationRowSchema),
      doses: rows(DoseRowSchema),
    })
    .default({ profiles: [], medications: [], doses: [] }),
});
export type SyncPushRequest = z.infer<typeof SyncPushRequestSchema>;
export type SyncPushResponse = { serverTime: string; accepted: number };
export type SyncPullResponse = { serverTime: string; tables: SyncTables };
