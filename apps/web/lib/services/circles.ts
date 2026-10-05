import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/app/api/_lib/respond";
import type { Db } from "@/lib/db/client";
import { circleMembers, circles, doses, escalations, medications, profiles, user, type CircleRole } from "@/lib/db/schema";

/**
 * Caregiver circles. The owner is the person whose doses are shared (role
 * `member`, one circle per account); people who join with the invite code are
 * caregivers, who only ever read. Rules:
 * - create is idempotent: a second call returns the existing circle;
 * - join normalises the code, refuses your own circle, caps caregivers, and is
 *   idempotent for someone already in;
 * - the owner removes anyone but themselves; a caregiver can only leave;
 * - a circle the caller is not in is a 404, so ids are never confirmed.
 */

/** No 0/O, 1/I/L: codes get read aloud and typed from a screen. 31 symbols, ~39.6 bits per code. */
export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;
export const MAX_CAREGIVERS = 10;
const MAX_CODE_ATTEMPTS = 5;
/** Largest multiple of the alphabet size below 256: bytes at or above it are redrawn (no modulo bias). */
const UNBIASED_LIMIT = 256 - (256 % INVITE_ALPHABET.length);

export type RandomBytes = (length: number) => Uint8Array;
const cryptoBytes: RandomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

export function generateInviteCode(random: RandomBytes = cryptoBytes): string {
  let code = "";
  while (code.length < INVITE_CODE_LENGTH) {
    for (const byte of random(INVITE_CODE_LENGTH)) {
      if (byte >= UNBIASED_LIMIT) continue;
      code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
      if (code.length === INVITE_CODE_LENGTH) break;
    }
  }
  return code;
}

/** Upper-cases and drops spaces and dashes ("abcd-2345" -> "ABCD2345"). */
export function normalizeInviteCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

const profileName = z.string().trim().min(1).max(80);

export const createCircleSchema = z.object({ profileName: profileName.optional() });

export const joinCircleSchema = z.object({
  code: z
    .string()
    .max(32)
    .transform(normalizeInviteCode)
    .pipe(z.string().length(INVITE_CODE_LENGTH).regex(new RegExp(`^[${INVITE_ALPHABET}]+$`), "Not an invite code.")),
  profileName: profileName.optional(),
});

export type CircleMemberView = { userId: string; name: string; role: CircleRole; joinedAt: string };
export type CircleView = {
  id: string;
  /** The owner's account name (Better Auth `user.name`), whoever is asking. */
  ownerName: string;
  isOwner: boolean;
  role: CircleRole;
  /** Only the owner sees (and shares) the code. */
  inviteCode: string | null;
  createdAt: string;
  members: CircleMemberView[];
};

type CircleRow = typeof circles.$inferSelect;

async function membersOf(db: Db, circleIds: string[]): Promise<Map<string, CircleMemberView[]>> {
  const out = new Map<string, CircleMemberView[]>();
  if (circleIds.length === 0) return out;
  const rows = await db
    .select()
    .from(circleMembers)
    .where(inArray(circleMembers.circleId, circleIds))
    .orderBy(asc(circleMembers.role), asc(circleMembers.joinedAt), asc(circleMembers.userId));
  for (const row of rows) {
    const list = out.get(row.circleId) ?? [];
    list.push({ userId: row.userId, name: row.profileName, role: row.role, joinedAt: row.joinedAt.toISOString() });
    out.set(row.circleId, list);
  }
  return out;
}

/** Account names (Better Auth `user.name`) by user id. */
export async function accountNames(db: Db, userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(inArray(user.id, [...new Set(userIds)]));
  return new Map(rows.map((row) => [row.id, row.name]));
}

function toView(circle: CircleRow, viewerId: string, members: CircleMemberView[], ownerName: string): CircleView {
  const isOwner = circle.ownerUserId === viewerId;
  const role = members.find((m) => m.userId === viewerId)?.role ?? (isOwner ? "member" : "caregiver");
  return {
    id: circle.id,
    ownerName,
    isOwner,
    role,
    inviteCode: isOwner ? circle.inviteCode : null,
    createdAt: circle.createdAt.toISOString(),
    members,
  };
}

async function viewOf(db: Db, circle: CircleRow, viewerId: string): Promise<CircleView> {
  const [members, names] = await Promise.all([membersOf(db, [circle.id]), accountNames(db, [circle.ownerUserId])]);
  return toView(circle, viewerId, members.get(circle.id) ?? [], names.get(circle.ownerUserId) ?? "");
}

export async function findOwnedCircle(db: Db, userId: string): Promise<CircleRow | undefined> {
  const [row] = await db.select().from(circles).where(eq(circles.ownerUserId, userId));
  return row;
}

export type SessionPerson = { id: string; name: string };

/** Creates the caller's circle, or returns the one they already own (`created: false`). */
export async function createCircle(
  db: Db,
  owner: SessionPerson,
  input: z.infer<typeof createCircleSchema>,
  random: RandomBytes = cryptoBytes,
): Promise<{ circle: CircleView; created: boolean }> {
  const existing = await findOwnedCircle(db, owner.id);
  if (existing) return { circle: await viewOf(db, existing, owner.id), created: false };

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const inserted = await db.transaction(async (tx) => {
      const [circle] = await tx
        .insert(circles)
        .values({ ownerUserId: owner.id, inviteCode: generateInviteCode(random) })
        .onConflictDoNothing()
        .returning();
      if (!circle) return undefined;
      await tx.insert(circleMembers).values({
        circleId: circle.id,
        userId: owner.id,
        role: "member",
        profileName: input.profileName ?? owner.name,
      });
      return circle;
    });
    if (inserted) return { circle: await viewOf(db, inserted, owner.id), created: true };
    // Conflict: a concurrent request created this owner's circle, or the code was taken.
    const raced = await findOwnedCircle(db, owner.id);
    if (raced) return { circle: await viewOf(db, raced, owner.id), created: false };
  }
  throw new Error("Could not allocate a unique invite code.");
}

export async function joinCircle(
  db: Db,
  person: SessionPerson,
  input: z.infer<typeof joinCircleSchema>,
): Promise<CircleView> {
  const [circle] = await db.select().from(circles).where(eq(circles.inviteCode, input.code));
  if (!circle) throw new ApiError(404, "No circle has that invite code.", "circle_not_found");
  if (circle.ownerUserId === person.id) {
    throw new ApiError(409, "This is your own circle. Share the code with your caregiver instead.", "own_circle");
  }
  const [already] = await db
    .select()
    .from(circleMembers)
    .where(and(eq(circleMembers.circleId, circle.id), eq(circleMembers.userId, person.id)));
  if (!already) {
    const [{ caregivers } = { caregivers: 0 }] = await db
      .select({ caregivers: count() })
      .from(circleMembers)
      .where(and(eq(circleMembers.circleId, circle.id), eq(circleMembers.role, "caregiver")));
    if (caregivers >= MAX_CAREGIVERS) {
      throw new ApiError(409, `A circle can have up to ${MAX_CAREGIVERS} caregivers.`, "circle_full");
    }
    await db
      .insert(circleMembers)
      .values({ circleId: circle.id, userId: person.id, role: "caregiver", profileName: input.profileName ?? person.name })
      .onConflictDoNothing();
  }
  return viewOf(db, circle, person.id);
}

/** Every circle the user is in (owned or caring for), with members. */
export async function listCircles(db: Db, userId: string): Promise<CircleView[]> {
  const rows = await db
    .select({ circle: circles })
    .from(circleMembers)
    .innerJoin(circles, eq(circles.id, circleMembers.circleId))
    .where(eq(circleMembers.userId, userId))
    .orderBy(asc(circleMembers.joinedAt));
  const [members, names] = await Promise.all([
    membersOf(
      db,
      rows.map((row) => row.circle.id),
    ),
    accountNames(
      db,
      rows.map((row) => row.circle.ownerUserId),
    ),
  ]);
  return rows.map(({ circle }) =>
    toView(circle, userId, members.get(circle.id) ?? [], names.get(circle.ownerUserId) ?? ""),
  );
}

/**
 * The caller's membership of `circleId`, or a 404 `circle_not_found` (also for
 * circles that exist but the caller is not in).
 */
export async function requireMembership(db: Db, circleId: string, userId: string) {
  const [row] = await db
    .select({ circle: circles, role: circleMembers.role })
    .from(circleMembers)
    .innerJoin(circles, eq(circles.id, circleMembers.circleId))
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, userId)));
  if (!row) throw new ApiError(404, "Circle not found.", "circle_not_found");
  return row;
}

export async function removeMember(db: Db, actorId: string, circleId: string, targetUserId: string): Promise<void> {
  const { circle } = await requireMembership(db, circleId, actorId);
  const isOwner = circle.ownerUserId === actorId;
  if (!isOwner && targetUserId !== actorId) {
    throw new ApiError(403, "Only the circle owner can remove other people.", "forbidden");
  }
  if (targetUserId === circle.ownerUserId) {
    if (!isOwner) throw new ApiError(403, "Only the circle owner can remove other people.", "forbidden");
    throw new ApiError(409, "The owner cannot leave their own circle.", "owner_cannot_leave");
  }
  const removed = await db
    .delete(circleMembers)
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, targetUserId)))
    .returning({ userId: circleMembers.userId });
  if (removed.length === 0) throw new ApiError(404, "That person is not in this circle.", "member_not_found");
}

/**
 * The owner stops sharing: the circle (memberships cascade) and every row the
 * owner's devices mirrored here are deleted in one transaction. The data on
 * their phone is untouched.
 */
export async function deleteCircle(db: Db, actorId: string, circleId: string): Promise<void> {
  const { circle } = await requireMembership(db, circleId, actorId);
  if (circle.ownerUserId !== actorId) {
    throw new ApiError(403, "Only the circle owner can delete the circle.", "forbidden");
  }
  await db.transaction(async (tx) => {
    await tx.delete(circles).where(eq(circles.id, circle.id));
    for (const table of [doses, medications, profiles, escalations]) {
      await tx.delete(table).where(eq(table.userId, actorId));
    }
  });
}
