import "server-only";
import { and, asc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { circleMembers, doses, medications, profiles } from "@/lib/db/schema";
import { dayBounds, isTimeZone, localDate } from "@/lib/domain/day";
import { doseState, type DoseState } from "@/lib/domain/dose-state";
import { accountNames, requireMembership } from "./circles";

export const todayQuerySchema = z.object({
  tz: z.string().max(64).refine(isTimeZone, "Unknown time zone.").default("UTC"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
    .optional(),
});

export type TodayDose = {
  id: string;
  medicationId: string;
  medicationName: string;
  strength: string | null;
  dueAt: string;
  state: DoseState;
  takenAt: string | null;
  skippedAt: string | null;
  snoozedUntil: string | null;
};
export type TodayProfile = { id: string; name: string; color: string; doses: TodayDose[] };
export type TodayMember = { userId: string; name: string; profiles: TodayProfile[] };
export type TodayView = {
  circleId: string;
  /** The circle owner's account name (Better Auth `user.name`). */
  ownerName: string;
  /** When the circle was created (ISO). */
  createdAt: string;
  date: string;
  timeZone: string;
  generatedAt: string;
  members: TodayMember[];
};

const iso = (value: Date | null) => (value ? value.toISOString() : null);

/**
 * Read-only "today" for a circle: every `member`'s live doses due in the local
 * calendar day, grouped by profile, with the state at `now`. Any person in the
 * circle may read it; anyone else gets the same 404 as a missing circle.
 * Caregivers' own mirrored data (if any) is never included.
 */
export async function circleToday(
  db: Db,
  viewerId: string,
  circleId: string,
  options: { timeZone: string; date?: string },
  now = new Date(),
): Promise<TodayView> {
  const { circle } = await requireMembership(db, circleId, viewerId);
  const date = options.date ?? localDate(now, options.timeZone);
  const { start, end } = dayBounds(date, options.timeZone);
  const ownerName = (await accountNames(db, [circle.ownerUserId])).get(circle.ownerUserId) ?? "";
  const head = {
    circleId,
    ownerName,
    createdAt: circle.createdAt.toISOString(),
    date,
    timeZone: options.timeZone,
    generatedAt: now.toISOString(),
  };

  const members = await db
    .select({ userId: circleMembers.userId, name: circleMembers.profileName })
    .from(circleMembers)
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.role, "member")))
    .orderBy(asc(circleMembers.joinedAt));
  const userIds = members.map((m) => m.userId);
  if (userIds.length === 0) {
    return { ...head, members: [] };
  }

  const rows = await db
    .select({ dose: doses, medication: medications, profile: profiles })
    .from(doses)
    .innerJoin(
      medications,
      and(eq(medications.userId, doses.userId), eq(medications.id, doses.medicationId), isNull(medications.deletedAt)),
    )
    .innerJoin(
      profiles,
      and(eq(profiles.userId, medications.userId), eq(profiles.id, medications.profileId), isNull(profiles.deletedAt)),
    )
    .where(and(inArray(doses.userId, userIds), isNull(doses.deletedAt), gte(doses.dueAt, start), lt(doses.dueAt, end)))
    .orderBy(asc(doses.dueAt), asc(doses.id));

  const view: TodayMember[] = members.map((m) => ({ userId: m.userId, name: m.name, profiles: [] }));
  const byUser = new Map(view.map((m) => [m.userId, m]));
  for (const { dose, medication, profile } of rows) {
    const member = byUser.get(dose.userId);
    if (!member) continue;
    let entry = member.profiles.find((p) => p.id === profile.id);
    if (!entry) {
      entry = { id: profile.id, name: profile.name, color: profile.color, doses: [] };
      member.profiles.push(entry);
    }
    entry.doses.push({
      id: dose.id,
      medicationId: medication.id,
      medicationName: medication.name,
      strength: medication.strength,
      dueAt: dose.dueAt.toISOString(),
      state: doseState(dose, medication.windowMinutes, now),
      takenAt: iso(dose.takenAt),
      skippedAt: iso(dose.skippedAt),
      snoozedUntil: iso(dose.snoozedUntil),
    });
  }
  return { ...head, members: view };
}
