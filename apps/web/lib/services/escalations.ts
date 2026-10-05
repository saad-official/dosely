import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { ExpoPushMessage } from "expo-server-sdk";
import { z } from "zod";
import { ApiError } from "@/app/api/_lib/respond";
import type { Db } from "@/lib/db/client";
import { circleMembers, devices, escalations } from "@/lib/db/schema";
import { IsoTimestamp } from "@/lib/sync/contract";
import { findOwnedCircle } from "./circles";
import { CAREGIVER_CHANNEL_ID, getPushSender, missedDoseMessage, pruneDeadTokens, type PushSender } from "./push";

/** A device may report a dose a few minutes early (clock skew), not more. */
const MAX_EARLY_MS = 5 * 60_000;

export const reportMissedSchema = z.object({
  doseIds: z.array(z.uuid()).min(1).max(50),
  profileName: z.string().trim().min(1).max(80),
  medNames: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  dueAt: IsoTimestamp,
});
export type ReportMissed = z.infer<typeof reportMissedSchema>;

export type EscalationResult = { escalated: string[]; alreadyEscalated: string[]; notified: number };

/**
 * Fans a missed-dose alert out to the caregivers of the reporter's own circle.
 * Idempotent per (member, dose): `escalations` gets one row per dose, and only
 * doses without a row are pushed. If the push fails the new rows are removed
 * again, so the next device report (or the daily sweep) can retry.
 * No circle or no caregivers: nothing is stored or sent.
 */
export async function escalateMissedDoses(
  db: Db,
  userId: string,
  input: ReportMissed,
  options: { send?: PushSender; now?: Date } = {},
): Promise<EscalationResult> {
  const now = options.now ?? new Date();
  const doseIds = [...new Set(input.doseIds)];
  const nothing: EscalationResult = { escalated: [], alreadyEscalated: [], notified: 0 };
  if (Date.parse(input.dueAt) > now.getTime() + MAX_EARLY_MS) {
    throw new ApiError(400, "That dose is not due yet.", "not_due");
  }

  const circle = await findOwnedCircle(db, userId);
  if (!circle) return nothing;
  const caregivers = await db
    .select({ userId: circleMembers.userId })
    .from(circleMembers)
    .where(and(eq(circleMembers.circleId, circle.id), eq(circleMembers.role, "caregiver")));
  if (caregivers.length === 0) return nothing;

  const inserted = await db
    .insert(escalations)
    .values(doseIds.map((doseId) => ({ doseId, userId, notifiedAt: now })))
    .onConflictDoNothing()
    .returning({ doseId: escalations.doseId });
  const insertedIds = new Set(inserted.map((row) => row.doseId));
  const fresh = doseIds.filter((id) => insertedIds.has(id));
  const alreadyEscalated = doseIds.filter((id) => !insertedIds.has(id));
  if (fresh.length === 0) return { escalated: [], alreadyEscalated, notified: 0 };

  const targets = await db
    .select({ token: devices.expoPushToken })
    .from(devices)
    .where(
      inArray(
        devices.userId,
        caregivers.map((c) => c.userId),
      ),
    );
  const { title, body } = missedDoseMessage(input, now);
  const messages: ExpoPushMessage[] = targets.map(({ token }) => ({
    to: token,
    title,
    body,
    sound: "default",
    priority: "high",
    interruptionLevel: "time-sensitive",
    channelId: CAREGIVER_CHANNEL_ID,
    data: { kind: "dose_missed", circleId: circle.id, memberUserId: userId, doseIds: fresh, url: `dosely://circle/${circle.id}` },
  }));
  if (messages.length > 0) {
    try {
      const tickets = await (options.send ?? getPushSender())(messages);
      await pruneDeadTokens(db, messages, tickets);
    } catch (error) {
      await db.delete(escalations).where(and(eq(escalations.userId, userId), inArray(escalations.doseId, fresh)));
      console.error("[escalations] push failed", error instanceof Error ? error.message : error);
      throw new ApiError(502, "Could not reach the push service. Try again shortly.", "push_failed");
    }
  }
  return { escalated: fresh, alreadyEscalated, notified: messages.length };
}
