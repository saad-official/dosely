import type { IsoString } from "./tz";

/** Any synced row: UUID id, `updatedAt`, optional soft-delete tombstone. */
export interface SyncRow {
  id: string;
  updatedAt: IsoString;
  deletedAt?: IsoString | null;
}

export interface PullResult<T extends SyncRow> {
  rows: T[];
  /** Ids where the remote row replaced (or added to) local data. */
  applied: string[];
  /** Ids where the local row was newer and still needs pushing. */
  kept: string[];
}

/** A row's effective version in ms: the later of `updatedAt` and `deletedAt`. */
export function rowVersion(row: SyncRow): number {
  const updated = Date.parse(row.updatedAt);
  return row.deletedAt ? Math.max(updated, Date.parse(row.deletedAt)) : updated;
}

/** Last-write-wins on `rowVersion` (so a newer delete beats an older edit); ties go to remote. */
export function pickWinner<T extends SyncRow>(local: T, remote: T): T {
  return rowVersion(local) > rowVersion(remote) ? local : remote;
}

/** Union of both sides by id, each id resolved by `pickWinner`. Local order first, then remote-only rows. */
export function mergeRows<T extends SyncRow>(local: readonly T[], remote: readonly T[]): T[] {
  return applyPull(local, remote).rows;
}

/** Rows changed (edited or soft-deleted) strictly after `since`; all rows when `since` is unset. */
export function diffDirty<T extends SyncRow>(rows: readonly T[], since: IsoString | null | undefined): T[] {
  if (!since) return [...rows];
  const floor = Date.parse(since);
  return rows.filter((r) => rowVersion(r) > floor);
}

function sameRow(a: SyncRow, b: SyncRow): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const av = (a as unknown as Record<string, unknown>)[k];
    const bv = (b as unknown as Record<string, unknown>)[k];
    if (av !== bv && JSON.stringify(av) !== JSON.stringify(bv)) return false;
  }
  return true;
}

/** Merge a pull into local rows and report which ids changed locally and which local rows won. */
export function applyPull<T extends SyncRow>(localRows: readonly T[], pulled: readonly T[]): PullResult<T> {
  const byId = new Map<string, T>();
  for (const r of localRows) byId.set(r.id, r);
  const applied: string[] = [];
  const kept: string[] = [];
  for (const remote of pulled) {
    const local = byId.get(remote.id);
    if (!local) {
      byId.set(remote.id, remote);
      applied.push(remote.id);
      continue;
    }
    const winner = pickWinner(local, remote);
    if (winner === local) kept.push(local.id);
    else if (!sameRow(local, remote)) {
      byId.set(remote.id, remote);
      applied.push(remote.id);
    }
  }
  return { rows: [...byId.values()], applied, kept };
}
