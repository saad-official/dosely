import "server-only";
import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { circles, doses, escalations, medications, profiles } from "@/lib/db/schema";
import { escalationDueAt } from "@/lib/domain/dose-state";
import { escalateMissedDoses } from "./escalations";
import { getPushSender, type PushSender } from "./push";

/** Doses older than this are history, not something to alert about. */
export const SWEEP_LOOKBACK_HOURS = 24;

export type SweepResult = { candidates: number; escalated: number; notified: number; errors: number };
export type DailyResult = { keepAlive: true; sweep: SweepResult };

/**
 * Daily cron (vercel.json, 06:00 UTC). A trivial query keeps the database
 * warm (Neon's free tier suspends idle computes). Then the straggler sweep:
 * the member's device normally reports missed doses itself (POST
 * /api/escalations), but a phone that is off or out of battery cannot, so any
 * mirrored dose of a circle owner that is still unmarked 30 minutes after its
 * window, from the last day, with no escalation row yet, is escalated here.
 * One alert per (member, profile), through the same idempotent fan-out.
 */
export async function runDailyJob(options: { now?: Date; send?: PushSender; db?: Db } = {}): Promise<DailyResult> {
  const now = options.now ?? new Date();
  const db = options.db ?? (await getDb());
  await db.execute(sql`select 1`);
  const sweep = await sweepMissedDoses(db, now, options.send ?? getPushSender());
  return { keepAlive: true, sweep };
}

export async function sweepMissedDoses(db: Db, now: Date, send: PushSender): Promise<SweepResult> {
  const since = new Date(now.getTime() - SWEEP_LOOKBACK_HOURS * 3_600_000);
  const rows = await db
    .select({
      userId: doses.userId,
      doseId: doses.id,
      dueAt: doses.dueAt,
      takenAt: doses.takenAt,
      skippedAt: doses.skippedAt,
      snoozedUntil: doses.snoozedUntil,
      windowMinutes: medications.windowMinutes,
      medName: medications.name,
      strength: medications.strength,
      profileId: profiles.id,
      profileName: profiles.name,
    })
    .from(doses)
    // Only people who still share with a circle.
    .innerJoin(circles, eq(circles.ownerUserId, doses.userId))
    .innerJoin(
      medications,
      and(eq(medications.userId, doses.userId), eq(medications.id, doses.medicationId), isNull(medications.deletedAt)),
    )
    .innerJoin(
      profiles,
      and(eq(profiles.userId, medications.userId), eq(profiles.id, medications.profileId), isNull(profiles.deletedAt)),
    )
    .leftJoin(escalations, and(eq(escalations.userId, doses.userId), eq(escalations.doseId, doses.id)))
    .where(
      and(
        isNull(escalations.id),
        isNull(doses.takenAt),
        isNull(doses.skippedAt),
        isNull(doses.deletedAt),
        gte(doses.dueAt, since),
        lte(doses.dueAt, now),
      ),
    )
    .orderBy(asc(doses.dueAt), asc(doses.id));

  const missed = rows.filter((row) => escalationDueAt(row, row.windowMinutes).getTime() <= now.getTime());
  const groups = new Map<string, typeof missed>();
  for (const row of missed) {
    const key = `${row.userId}\u0000${row.profileId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const result: SweepResult = { candidates: missed.length, escalated: 0, notified: 0, errors: 0 };
  for (const group of groups.values()) {
    const first = group[0]!;
    const medNames = [...new Set(group.map((row) => (row.strength ? `${row.medName} ${row.strength}` : row.medName)))];
    try {
      const outcome = await escalateMissedDoses(
        db,
        first.userId,
        { doseIds: group.map((row) => row.doseId), profileName: first.profileName, medNames, dueAt: first.dueAt.toISOString() },
        { send, now },
      );
      result.escalated += outcome.escalated.length;
      result.notified += outcome.notified;
    } catch (error) {
      result.errors += 1;
      console.error("[cron] sweep escalation failed", error instanceof Error ? error.message : error);
    }
  }
  return result;
}
