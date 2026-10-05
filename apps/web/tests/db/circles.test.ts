import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { eq } from "drizzle-orm";
import { GET as listCircles, POST as createCircle } from "@/app/api/circles/route";
import { POST as joinCircle } from "@/app/api/circles/join/route";
import { DELETE as deleteCircle } from "@/app/api/circles/[id]/route";
import { DELETE as removeMember } from "@/app/api/circles/[id]/members/[userId]/route";
import type { DbHandle } from "@/lib/db/client";
import { circleMembers, doses, escalations, medications, profiles } from "@/lib/db/schema";
import {
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  MAX_CAREGIVERS,
  generateInviteCode,
  normalizeInviteCode,
} from "@/lib/services/circles";
import { jsonRequest, signUpTestUser, startTestDb, stopTestDb, type TestUser } from "./helpers";

let handle: DbHandle;

beforeAll(async () => {
  handle = await startTestDb();
}, 60_000);

afterAll(async () => {
  await stopTestDb(handle);
});

async function create(who: TestUser | null, body: unknown = {}) {
  const response = await createCircle(jsonRequest("/api/circles", { body, cookie: who?.cookie }));
  return { status: response.status, json: await response.json() };
}

async function join(who: TestUser | null, body: unknown) {
  const response = await joinCircle(jsonRequest("/api/circles/join", { body, cookie: who?.cookie }));
  return { status: response.status, json: await response.json() };
}

async function list(who: TestUser | null) {
  const response = await listCircles(jsonRequest("/api/circles", { cookie: who?.cookie }));
  return { status: response.status, json: await response.json() };
}

async function remove(who: TestUser | null, circleId: string, userId: string) {
  const response = await removeMember(
    jsonRequest(`/api/circles/${circleId}/members/${userId}`, { method: "DELETE", cookie: who?.cookie }),
    { params: Promise.resolve({ id: circleId, userId }) },
  );
  return { status: response.status, json: await response.json() };
}

describe("invite codes", () => {
  it("are 8 characters from an alphabet without 0/O/1/I/L", () => {
    expect(INVITE_CODE_LENGTH).toBe(8);
    expect(INVITE_ALPHABET).not.toMatch(/[01OIL]/);
    for (let i = 0; i < 50; i += 1) {
      const code = generateInviteCode();
      expect(code).toHaveLength(8);
      for (const char of code) expect(INVITE_ALPHABET).toContain(char);
    }
  });

  it("are generated from the random source given", () => {
    const zeros = () => new Uint8Array(8);
    expect(generateInviteCode(zeros)).toBe(INVITE_ALPHABET[0]!.repeat(8));
  });

  it("normalise what people type: case, spaces and dashes", () => {
    expect(normalizeInviteCode(" abcd-2345 ")).toBe("ABCD2345");
    expect(normalizeInviteCode("ab cd 23 45")).toBe("ABCD2345");
  });
});

describe("POST /api/circles", () => {
  it("requires a session", async () => {
    expect((await create(null)).status).toBe(401);
  });

  it("creates the caller's circle with an invite code and the caller as member", async () => {
    const owner = await signUpTestUser("Rosa Diaz");
    const { status, json } = await create(owner, { profileName: "Mum" });
    expect(status).toBe(201);
    expect(json.circle).toMatchObject({ isOwner: true, role: "member", inviteCode: expect.stringMatching(/^[A-Z2-9]{8}$/) });
    expect(json.circle.members).toEqual([
      { userId: owner.id, name: "Mum", role: "member", joinedAt: expect.any(String) },
    ]);
  });

  it("defaults the profile name to the account name", async () => {
    const owner = await signUpTestUser("Priya Shah");
    const { json } = await create(owner);
    expect(json.circle.members[0].name).toBe("Priya Shah");
  });

  it("returns the existing circle instead of creating a second one", async () => {
    const owner = await signUpTestUser();
    const first = await create(owner);
    const second = await create(owner);
    expect(second.status).toBe(200);
    expect(second.json.circle.id).toBe(first.json.circle.id);
    expect(second.json.circle.inviteCode).toBe(first.json.circle.inviteCode);
  });

  it("rejects an over-long profile name", async () => {
    const owner = await signUpTestUser();
    expect((await create(owner, { profileName: "x".repeat(81) })).status).toBe(400);
  });
});

describe("POST /api/circles/join", () => {
  it("requires a session", async () => {
    expect((await join(null, { code: "ABCD2345" })).status).toBe(401);
  });

  it("joins as caregiver with a code typed in any case, with dashes", async () => {
    const owner = await signUpTestUser("Owner");
    const caregiver = await signUpTestUser("Daughter");
    const { json: created } = await create(owner, { profileName: "Dad" });
    const code: string = created.circle.inviteCode;
    const typed = `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`;

    const { status, json } = await join(caregiver, { code: typed, profileName: "Lena" });
    expect(status).toBe(200);
    expect(json.circle).toMatchObject({ id: created.circle.id, isOwner: false, role: "caregiver", inviteCode: null });
    expect(json.circle.members.map((m: { name: string; role: string }) => [m.name, m.role])).toEqual([
      ["Dad", "member"],
      ["Lena", "caregiver"],
    ]);
  });

  it("is idempotent for someone already in the circle", async () => {
    const owner = await signUpTestUser();
    const caregiver = await signUpTestUser();
    const { json: created } = await create(owner);
    await join(caregiver, { code: created.circle.inviteCode });
    const again = await join(caregiver, { code: created.circle.inviteCode });
    expect(again.status).toBe(200);
    const rows = await handle.db.select().from(circleMembers).where(eq(circleMembers.circleId, created.circle.id));
    expect(rows).toHaveLength(2);
  });

  it("404s an unknown code", async () => {
    const caregiver = await signUpTestUser();
    const { status, json } = await join(caregiver, { code: "ZZZZ9999" });
    expect(status).toBe(404);
    expect(json.code).toBe("circle_not_found");
  });

  it("rejects malformed codes with 400", async () => {
    const caregiver = await signUpTestUser();
    expect((await join(caregiver, { code: "short" })).status).toBe(400);
    expect((await join(caregiver, {})).status).toBe(400);
  });

  it("refuses to join your own circle as a caregiver", async () => {
    const owner = await signUpTestUser();
    const { json: created } = await create(owner);
    const { status, json } = await join(owner, { code: created.circle.inviteCode });
    expect(status).toBe(409);
    expect(json.code).toBe("own_circle");
  });

  it(`caps a circle at ${MAX_CAREGIVERS} caregivers`, async () => {
    const owner = await signUpTestUser();
    const { json: created } = await create(owner);
    for (let i = 0; i < MAX_CAREGIVERS; i += 1) {
      const caregiver = await signUpTestUser();
      expect((await join(caregiver, { code: created.circle.inviteCode })).status).toBe(200);
    }
    const late = await signUpTestUser();
    const { status, json } = await join(late, { code: created.circle.inviteCode });
    expect(status).toBe(409);
    expect(json.code).toBe("circle_full");
  }, 30_000);
});

describe("GET /api/circles", () => {
  it("requires a session", async () => {
    expect((await list(null)).status).toBe(401);
  });

  it("lists the circles I own and the ones I care for, with members", async () => {
    const me = await signUpTestUser("Me");
    const mum = await signUpTestUser("Mum");
    const stranger = await signUpTestUser("Stranger");
    const { json: mine } = await create(me, { profileName: "Me" });
    const { json: hers } = await create(mum, { profileName: "Mum" });
    await create(stranger);
    await join(me, { code: hers.circle.inviteCode, profileName: "Son" });

    const { status, json } = await list(me);
    expect(status).toBe(200);
    const byId = new Map(json.circles.map((c: { id: string }) => [c.id, c]));
    expect([...byId.keys()].sort()).toEqual([mine.circle.id, hers.circle.id].sort());
    expect(byId.get(mine.circle.id)).toMatchObject({ isOwner: true, inviteCode: mine.circle.inviteCode });
    expect(byId.get(hers.circle.id)).toMatchObject({ isOwner: false, role: "caregiver", inviteCode: null });
  });

  it("returns an empty list for someone with no circle", async () => {
    const loner = await signUpTestUser();
    expect((await list(loner)).json).toEqual({ circles: [] });
  });
});

describe("DELETE /api/circles/:id/members/:userId", () => {
  async function circleWithCaregivers(count: number) {
    const owner = await signUpTestUser("Owner");
    const { json } = await create(owner);
    const caregivers: TestUser[] = [];
    for (let i = 0; i < count; i += 1) {
      const caregiver = await signUpTestUser(`Caregiver ${i}`);
      await join(caregiver, { code: json.circle.inviteCode });
      caregivers.push(caregiver);
    }
    return { owner, circleId: json.circle.id as string, caregivers };
  }

  it("requires a session", async () => {
    const { circleId, caregivers } = await circleWithCaregivers(1);
    expect((await remove(null, circleId, caregivers[0]!.id)).status).toBe(401);
  });

  it("lets the owner remove a caregiver", async () => {
    const { owner, circleId, caregivers } = await circleWithCaregivers(1);
    const { status, json } = await remove(owner, circleId, caregivers[0]!.id);
    expect(status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect((await list(caregivers[0]!)).json.circles).toEqual([]);
  });

  it("lets a caregiver leave", async () => {
    const { circleId, caregivers } = await circleWithCaregivers(1);
    expect((await remove(caregivers[0]!, circleId, caregivers[0]!.id)).status).toBe(200);
    expect((await list(caregivers[0]!)).json.circles).toEqual([]);
  });

  it("does not let a caregiver remove someone else", async () => {
    const { circleId, caregivers } = await circleWithCaregivers(2);
    const { status } = await remove(caregivers[0]!, circleId, caregivers[1]!.id);
    expect(status).toBe(403);
    expect((await list(caregivers[1]!)).json.circles).toHaveLength(1);
  });

  it("does not remove the owner", async () => {
    const { owner, circleId, caregivers } = await circleWithCaregivers(1);
    expect((await remove(owner, circleId, owner.id)).json.code).toBe("owner_cannot_leave");
    expect((await remove(caregivers[0]!, circleId, owner.id)).status).toBe(403);
  });

  it("404s a circle the caller is not in, without revealing it", async () => {
    const { circleId, caregivers } = await circleWithCaregivers(1);
    const outsider = await signUpTestUser();
    const { status, json } = await remove(outsider, circleId, caregivers[0]!.id);
    expect(status).toBe(404);
    expect(json.code).toBe("circle_not_found");
  });

  it("404s someone who is not a member", async () => {
    const { owner, circleId } = await circleWithCaregivers(0);
    const outsider = await signUpTestUser();
    expect((await remove(owner, circleId, outsider.id)).json.code).toBe("member_not_found");
  });
});

describe("DELETE /api/circles/:id", () => {
  async function removeCircle(who: TestUser | null, circleId: string) {
    const response = await deleteCircle(jsonRequest(`/api/circles/${circleId}`, { method: "DELETE", cookie: who?.cookie }), {
      params: Promise.resolve({ id: circleId }),
    });
    return { status: response.status, json: await response.json() };
  }

  it("requires a session", async () => {
    const owner = await signUpTestUser();
    const { json } = await create(owner);
    expect((await removeCircle(null, json.circle.id)).status).toBe(401);
  });

  it("lets the owner stop sharing: the circle, memberships and every mirrored row are deleted", async () => {
    const owner = await signUpTestUser("Owner");
    const caregiver = await signUpTestUser("Caregiver");
    const { json } = await create(owner);
    await join(caregiver, { code: json.circle.inviteCode });
    const now = new Date();
    const base = { userId: owner.id, createdAt: now, updatedAt: now };
    await handle.db.insert(profiles).values({ ...base, id: "p-1", name: "Me", color: "teal" });
    await handle.db.insert(medications).values({ ...base, id: "m-1", profileId: "p-1", name: "Med", schedule: {} });
    await handle.db.insert(doses).values({ ...base, id: "d-1", medicationId: "m-1", dueAt: now });
    await handle.db.insert(escalations).values({ userId: owner.id, doseId: "d-1" });

    const { status, json: body } = await removeCircle(owner, json.circle.id);
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect((await list(owner)).json.circles).toEqual([]);
    expect((await list(caregiver)).json.circles).toEqual([]);
    for (const table of [profiles, medications, doses, escalations]) {
      expect(await handle.db.select().from(table).where(eq(table.userId, owner.id))).toEqual([]);
    }
  });

  it("is forbidden for a caregiver and a 404 for outsiders", async () => {
    const owner = await signUpTestUser();
    const caregiver = await signUpTestUser();
    const outsider = await signUpTestUser();
    const { json } = await create(owner);
    await join(caregiver, { code: json.circle.inviteCode });
    expect((await removeCircle(caregiver, json.circle.id)).status).toBe(403);
    expect((await removeCircle(outsider, json.circle.id)).status).toBe(404);
    expect((await list(owner)).json.circles).toHaveLength(1);
  });
});
