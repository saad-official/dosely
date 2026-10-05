import "server-only";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { ApiError } from "@/app/api/_lib/respond";
import type { Db } from "@/lib/db/client";
import { doses, medications, profiles } from "@/lib/db/schema";
import {
  MAX_CLOCK_SKEW_MS,
  PULL_OVERLAP_MS,
  ROW_SCHEMAS,
  SYNC_TABLES,
  type SyncPullResponse,
  type SyncPushRequest,
  type SyncPushResponse,
  type SyncTable,
  type SyncTables,
} from "@/lib/sync/contract";
import { pickWinner, rowVersion, type Versioned } from "@/lib/sync/merge";
import { findOwnedCircle } from "./circles";

/** Merge rules and wire shape: lib/sync/contract.ts. */

/**
 * The three mirror tables share their sync columns (`id`, `userId`,
 * `updatedAt`, `deletedAt`, `serverUpdatedAt`) and their remaining columns
 * are exactly the wire schema's keys, so one table type stands in for all.
 */
type MirrorTable = typeof profiles;
const TABLES: Record<SyncTable, MirrorTable> = {
  profiles,
  medications: medications as unknown as MirrorTable,
  doses: doses as unknown as MirrorTable,
};

const WIRE_KEYS: Record<SyncTable, string[]> = {
  profiles: Object.keys(ROW_SCHEMAS.profiles.shape),
  medications: Object.keys(ROW_SCHEMAS.medications.shape),
  doses: Object.keys(ROW_SCHEMAS.doses.shape),
};

const TIMESTAMP_KEYS = new Set(["createdAt", "updatedAt", "deletedAt", "dueAt", "takenAt", "skippedAt", "snoozedUntil"]);

type WireRow = Versioned & { id: string } & Record<string, unknown>;

/** Wire row -> column values (ISO strings become Dates, absent optionals become null). */
export function wireToColumns(table: SyncTable, row: WireRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of WIRE_KEYS[table]) {
    const value = row[key];
    if (TIMESTAMP_KEYS.has(key)) out[key] = typeof value === "string" ? new Date(value) : null;
    else out[key] = value ?? null;
  }
  return out;
}

/** Stored row -> wire row (Dates become ISO strings; server-only columns dropped). */
export function columnsToWire(table: SyncTable, row: Record<string, unknown>): WireRow {
  const out: Record<string, unknown> = {};
  for (const key of WIRE_KEYS[table]) {
    const value = row[key];
    out[key] = value instanceof Date ? value.toISOString() : (value ?? null);
  }
  return out as WireRow;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function applyTable(tx: Tx, name: SyncTable, userId: string, rows: WireRow[], now: Date): Promise<number> {
  if (rows.length === 0) return 0;
  const table = TABLES[name];
  const ids = [...new Set(rows.map((row) => row.id))];
  const existing = await tx
    .select()
    .from(table)
    .where(and(eq(table.userId, userId), inArray(table.id, ids)));
  const stored = new Map<string, WireRow>(existing.map((row) => [row.id, columnsToWire(name, row)]));
  const limit = now.getTime() + MAX_CLOCK_SKEW_MS;

  let accepted = 0;
  for (const incoming of rows) {
    if (rowVersion(incoming) > limit) continue;
    const current = stored.get(incoming.id);
    if (current && pickWinner(current, incoming) !== incoming) continue;
    const values = { ...wireToColumns(name, incoming), serverUpdatedAt: now } as Partial<typeof table.$inferInsert>;
    await tx
      .insert(table)
      .values({ ...values, userId } as typeof table.$inferInsert)
      .onConflictDoUpdate({ target: [table.userId, table.id], set: values });
    stored.set(incoming.id, incoming);
    accepted += 1;
  }
  return accepted;
}

/**
 * Health data leaves the device only for a circle: pushing requires owning one
 * (being the `member` whose doses caregivers see).
 */
async function requireSharing(db: Db, userId: string): Promise<void> {
  if (!(await findOwnedCircle(db, userId))) {
    throw new ApiError(403, "Create a caregiver circle before syncing.", "no_circle");
  }
}

export async function pushChanges(db: Db, userId: string, body: SyncPushRequest, now = new Date()): Promise<SyncPushResponse> {
  await requireSharing(db, userId);
  return db.transaction(async (tx) => {
    let accepted = 0;
    for (const name of SYNC_TABLES) {
      accepted += await applyTable(tx, name, userId, body.tables[name] as WireRow[], now);
    }
    return { serverTime: now.toISOString(), accepted };
  });
}

export async function pullChanges(db: Db, userId: string, since: Date | undefined, now = new Date()): Promise<SyncPullResponse> {
  const after = since ?? new Date(0);
  const tables = {} as Record<SyncTable, WireRow[]>;
  for (const name of SYNC_TABLES) {
    const table = TABLES[name];
    const rows = await db
      .select()
      .from(table)
      .where(and(eq(table.userId, userId), gt(table.serverUpdatedAt, after)))
      .orderBy(asc(table.serverUpdatedAt), asc(table.id));
    tables[name] = rows.map((row) => columnsToWire(name, row));
  }
  // The cursor lags the clock (never moving backwards) so a push committing
  // during this pull is re-sent next time rather than skipped.
  const cursor = Math.max(after.getTime(), now.getTime() - PULL_OVERLAP_MS);
  return { serverTime: new Date(cursor).toISOString(), tables: tables as unknown as SyncTables };
}
