/**
 * Postgres schema (docs/spec.md section 3). Every table, including Better
 * Auth's, lives in the `dosely` Postgres schema so the database can be
 * dedicated or shared with sibling apps.
 *
 * The device is the source of truth (local-first SQLite with SQLCipher).
 * Nothing about a person's medication reaches this database unless they
 * create a caregiver circle; then `profiles`, `medications` and `doses`
 * mirror the device tables for the caregivers' read-only "today" view and the
 * missed-dose sweep:
 * - ids are UUID strings generated on the device; the primary key is
 *   `(user_id, id)` so one account can never collide with (or overwrite)
 *   another account's rows, whatever ids a client sends;
 * - `updated_at` / `deleted_at` are device times; the later of the two is the
 *   row version that decides last-write-wins (lib/sync/merge.ts);
 * - `deleted_at` is a soft delete (tombstone) that sync propagates;
 * - `server_updated_at` is set by the server on every accepted write and is
 *   the cursor for `GET /api/sync/pull?since=`.
 * There are no foreign keys between mirror tables: devices push in any order.
 *
 * Circles: the owner is the person whose doses are shared (role `member`);
 * people who join with the invite code are `caregiver`s and only ever read.
 * `escalations` has one row per (member, dose) alert, which makes caregiver
 * pushes idempotent across device reports and the daily sweep.
 */
import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgSchema, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const dosely = pgSchema("dosely");

const tz = (name: string) => timestamp(name, { withTimezone: true });

// ---------------------------------------------------------------------------
// Enums (value lists exported for zod schemas)
// ---------------------------------------------------------------------------

export const PLATFORMS = ["ios", "android"] as const;
export const CIRCLE_ROLES = ["member", "caregiver"] as const;
export type CircleRole = (typeof CIRCLE_ROLES)[number];

export const platformEnum = dosely.enum("platform", PLATFORMS);
export const circleRoleEnum = dosely.enum("circle_role", CIRCLE_ROLES);

// ---------------------------------------------------------------------------
// Better Auth core schema (v1.7). JS keys are Better Auth's field names (the
// drizzle adapter looks columns up by them); column names are snake_case.
// ---------------------------------------------------------------------------

export const user = dosely.table("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: tz("created_at").notNull().defaultNow(),
  updatedAt: tz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = dosely.table(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: tz("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: tz("created_at").notNull().defaultNow(),
    updatedAt: tz("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = dosely.table(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: tz("access_token_expires_at"),
    refreshTokenExpiresAt: tz("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: tz("created_at").notNull().defaultNow(),
    updatedAt: tz("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = dosely.table(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: tz("expires_at").notNull(),
    createdAt: tz("created_at").notNull().defaultNow(),
    updatedAt: tz("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------
// Push devices
// ---------------------------------------------------------------------------

const userId = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

/** One row per Expo push token. Re-registering a token from another account moves it. */
export const devices = dosely.table(
  "devices",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: userId(),
    expoPushToken: text("expo_push_token").notNull().unique(),
    platform: platformEnum("platform").notNull(),
    lastSeenAt: tz("last_seen_at").notNull().defaultNow(),
    createdAt: tz("created_at").notNull().defaultNow(),
  },
  (t) => [index("devices_user_id_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Caregiver circles
// ---------------------------------------------------------------------------

export const circles = dosely.table(
  "circles",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ownerUserId: userId(),
    /** 8 characters from an unambiguous alphabet (lib/services/circles.ts). */
    inviteCode: text("invite_code").notNull().unique(),
    createdAt: tz("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("circles_owner_user_id_idx").on(t.ownerUserId)],
);

export const circleMembers = dosely.table(
  "circle_members",
  {
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    userId: userId(),
    role: circleRoleEnum("role").notNull(),
    /** What the circle calls this person ("Mum", "Sam"). */
    profileName: text("profile_name").notNull(),
    joinedAt: tz("joined_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.circleId, t.userId] }), index("circle_members_user_id_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Sync mirrors of the device tables (circle members only)
// ---------------------------------------------------------------------------

/** Columns every mirror table shares. */
const mirrorColumns = () => ({
  id: text("id").notNull(),
  userId: userId(),
  createdAt: tz("created_at").notNull(),
  updatedAt: tz("updated_at").notNull(),
  deletedAt: tz("deleted_at"),
  serverUpdatedAt: tz("server_updated_at").notNull().defaultNow(),
});

export const profiles = dosely.table(
  "profiles",
  {
    ...mirrorColumns(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    avatarInitial: text("avatar_initial"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    index("profiles_user_server_updated_idx").on(t.userId, t.serverUpdatedAt),
  ],
);

export const medications = dosely.table(
  "medications",
  {
    ...mirrorColumns(),
    profileId: text("profile_id").notNull(),
    name: text("name").notNull(),
    strength: text("strength"),
    form: text("form"),
    instructions: text("instructions"),
    color: text("color"),
    /** The device's schedule JSON, stored as-is (expanded on the device, not here). */
    schedule: jsonb("schedule").$type<unknown>().notNull(),
    windowMinutes: integer("window_minutes").notNull().default(60),
    inventoryCount: integer("inventory_count"),
    refillThreshold: integer("refill_threshold"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    index("medications_user_server_updated_idx").on(t.userId, t.serverUpdatedAt),
  ],
);

export const doses = dosely.table(
  "doses",
  {
    ...mirrorColumns(),
    medicationId: text("medication_id").notNull(),
    dueAt: tz("due_at").notNull(),
    takenAt: tz("taken_at"),
    skippedAt: tz("skipped_at"),
    snoozedUntil: tz("snoozed_until"),
    source: text("source").notNull().default("schedule"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    index("doses_user_server_updated_idx").on(t.userId, t.serverUpdatedAt),
    index("doses_user_due_idx").on(t.userId, t.dueAt),
    // The sweep scans recent unmarked doses across users.
    index("doses_unmarked_due_idx")
      .on(t.dueAt)
      .where(sql`${t.takenAt} is null and ${t.skippedAt} is null and ${t.deletedAt} is null`),
  ],
);

// ---------------------------------------------------------------------------
// Caregiver alerts
// ---------------------------------------------------------------------------

/** One row per (member, dose) alert: the idempotency key for caregiver pushes. */
export const escalations = dosely.table(
  "escalations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    doseId: text("dose_id").notNull(),
    userId: userId(),
    notifiedAt: tz("notified_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("escalations_user_dose_idx").on(t.userId, t.doseId)],
);
