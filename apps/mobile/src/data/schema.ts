// Device SQLite schema (SQLCipher-encrypted, see db.ts). Timestamps are ISO-8601 UTC strings
// (`Date#toISOString()`), so lexical comparison in SQL equals chronological order.
// Regenerate migrations after editing: `pnpm --filter mobile db:generate`.
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const syncColumns = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
};

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  initial: text('initial').notNull(),
  isSelf: integer('is_self', { mode: 'boolean' }).notNull().default(false),
  ...syncColumns,
});

export const medications = sqliteTable(
  'medications',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id').notNull(),
    name: text('name').notNull(),
    strength: text('strength'),
    form: text('form').notNull(),
    instructions: text('instructions'),
    color: text('color').notNull(),
    icon: text('icon').notNull(),
    /** `Schedule` JSON, validated with `ScheduleSchema` on read and write. */
    scheduleJson: text('schedule_json').notNull(),
    windowMinutes: integer('window_minutes').notNull().default(60),
    inventoryCount: real('inventory_count'),
    refillThreshold: real('refill_threshold'),
    archivedAt: text('archived_at'),
    ...syncColumns,
  },
  (t) => [index('medications_profile_idx').on(t.profileId)],
);

export const doses = sqliteTable(
  'doses',
  {
    /** Deterministic (`doseIdFor`) for scheduled doses, so re-expansion is insert-or-ignore. */
    id: text('id').primaryKey(),
    medicationId: text('medication_id').notNull(),
    profileId: text('profile_id').notNull(),
    dueAt: text('due_at').notNull(),
    windowEndsAt: text('window_ends_at').notNull(),
    takenAt: text('taken_at'),
    skippedAt: text('skipped_at'),
    snoozedUntil: text('snoozed_until'),
    source: text('source', { enum: ['scheduled', 'as-needed'] }).notNull(),
    ...syncColumns,
  },
  (t) => [
    index('doses_due_idx').on(t.dueAt),
    index('doses_med_due_idx').on(t.medicationId, t.dueAt),
    index('doses_updated_idx').on(t.updatedAt),
  ],
);

/** Key/value settings. Values are JSON; keys of `Settings` plus app-local keys (see settings-repo). */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Sync bookkeeping, one row per synced table (`profiles`, `medications`, `doses`):
 * `pushed_up_to` = highest row version (max of updated/deleted) the server has accepted,
 * `pulled_at` = the server's `serverTime` cursor from the last pull (`?since=`).
 */
export const syncState = sqliteTable('sync_state', {
  tableName: text('table_name').primaryKey(),
  pushedUpTo: text('pushed_up_to'),
  pulledAt: text('pulled_at'),
  updatedAt: text('updated_at').notNull(),
});

/** Doses already reported to caregivers (so a dose is escalated at most once per device). */
export const escalationsSent = sqliteTable('escalations_sent', {
  doseId: text('dose_id').primaryKey(),
  notifiedAt: text('notified_at').notNull(),
});

export type ProfileRow = typeof profiles.$inferSelect;
export type MedicationRow = typeof medications.$inferSelect;
export type DoseRow = typeof doses.$inferSelect;
export type SettingRow = typeof settings.$inferSelect;
export type SyncStateRow = typeof syncState.$inferSelect;
