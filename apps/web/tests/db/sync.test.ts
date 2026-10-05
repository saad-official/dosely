import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { and, eq } from "drizzle-orm";
import { POST as createCircle } from "@/app/api/circles/route";
import { GET as pull } from "@/app/api/sync/pull/route";
import { POST as push } from "@/app/api/sync/push/route";
import type { DbHandle } from "@/lib/db/client";
import { doses, medications, profiles } from "@/lib/db/schema";
import { pickWinner, rowVersion } from "@/lib/sync/merge";
import { jsonRequest, signUpTestUser, startTestDb, stopTestDb, type TestUser } from "./helpers";

let handle: DbHandle;
let sam: TestUser;
let ana: TestUser;

beforeAll(async () => {
  handle = await startTestDb();
  sam = await signUpTestUser("Sam");
  ana = await signUpTestUser("Ana");
  for (const who of [sam, ana]) await createCircle(jsonRequest("/api/circles", { body: {}, cookie: who.cookie }));
}, 60_000);

afterAll(async () => {
  await stopTestDb(handle);
});

const T0 = "2026-10-05T08:00:00.000Z";
const T1 = "2026-10-05T09:00:00.000Z";
const T2 = "2026-10-05T10:00:00.000Z";

let idCounter = 0;
function uuid(): string {
  idCounter += 1;
  return `0199b0c4-0000-7000-8000-${String(idCounter).padStart(12, "0")}`;
}

function profileRow(id: string, overrides: Record<string, unknown> = {}) {
  return { id, name: "Mum", color: "teal", avatarInitial: "M", createdAt: T0, updatedAt: T0, deletedAt: null, ...overrides };
}

function medicationRow(id: string, profileId: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    profileId,
    name: "Metformin",
    strength: "500 mg",
    form: "tablet",
    instructions: "With food",
    color: "blue",
    schedule: { kind: "times", times: ["08:00", "20:00"] },
    windowMinutes: 60,
    inventoryCount: 56,
    refillThreshold: 10,
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    ...overrides,
  };
}

function doseRow(id: string, medicationId: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    medicationId,
    dueAt: "2026-10-05T12:00:00.000Z",
    takenAt: null,
    skippedAt: null,
    snoozedUntil: null,
    source: "schedule",
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    ...overrides,
  };
}

async function pushAs(who: TestUser, tables: Record<string, unknown[]>) {
  const response = await push(jsonRequest("/api/sync/push", { body: { deviceId: "test-device", tables }, cookie: who.cookie }));
  return { status: response.status, json: await response.json() };
}

async function pullAs(who: TestUser, since?: string) {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  const response = await pull(jsonRequest(`/api/sync/pull${query}`, { cookie: who.cookie }));
  return { status: response.status, json: await response.json() };
}

async function storedProfile(who: TestUser, id: string) {
  const [row] = await handle.db
    .select()
    .from(profiles)
    .where(and(eq(profiles.userId, who.id), eq(profiles.id, id)));
  return row;
}

describe("merge rules", () => {
  it("row version is the later of updatedAt and deletedAt", () => {
    expect(rowVersion({ updatedAt: T1, deletedAt: null })).toBe(Date.parse(T1));
    expect(rowVersion({ updatedAt: T1, deletedAt: T2 })).toBe(Date.parse(T2));
  });

  it("the later version wins and ties go to the incoming row", () => {
    const stored = { updatedAt: T1, deletedAt: null, v: "stored" };
    expect(pickWinner(stored, { updatedAt: T2, deletedAt: null, v: "in" }).v).toBe("in");
    expect(pickWinner(stored, { updatedAt: T0, deletedAt: null, v: "in" }).v).toBe("stored");
    expect(pickWinner(stored, { updatedAt: T1, deletedAt: null, v: "in" }).v).toBe("in");
  });
});

describe("POST /api/sync/push", () => {
  it("rejects requests without a session", async () => {
    const response = await push(jsonRequest("/api/sync/push", { body: { tables: {} } }));
    expect(response.status).toBe(401);
  });

  it("refuses to store health data for someone who is not sharing with a circle", async () => {
    const loner = await signUpTestUser("Not sharing");
    const { status, json } = await pushAs(loner, { profiles: [profileRow(uuid())] });
    expect(status).toBe(403);
    expect(json.code).toBe("no_circle");
  });

  it("rejects rows that fail the schema with 400", async () => {
    expect((await pushAs(sam, { profiles: [{ id: uuid(), name: "No timestamps" }] })).status).toBe(400);
    expect((await pushAs(sam, { profiles: [profileRow("not-a-uuid")] })).status).toBe(400);
    expect((await pushAs(sam, { medications: [medicationRow(uuid(), uuid(), { windowMinutes: 0 })] })).status).toBe(400);
    expect((await pushAs(sam, { doses: [doseRow(uuid(), uuid(), { dueAt: "tomorrow" })] })).status).toBe(400);
  });

  it("inserts profiles, medications and doses in one push", async () => {
    const profileId = uuid();
    const medId = uuid();
    const doseId = uuid();
    const { status, json } = await pushAs(sam, {
      profiles: [profileRow(profileId)],
      medications: [medicationRow(medId, profileId)],
      doses: [doseRow(doseId, medId, { takenAt: "2026-10-05T12:05:00.000Z" })],
    });
    expect(status).toBe(200);
    expect(json).toEqual({ serverTime: expect.any(String), accepted: 3 });
    const [med] = await handle.db
      .select()
      .from(medications)
      .where(and(eq(medications.userId, sam.id), eq(medications.id, medId)));
    expect(med).toMatchObject({ name: "Metformin", windowMinutes: 60, schedule: { kind: "times", times: ["08:00", "20:00"] } });
    const [dose] = await handle.db
      .select()
      .from(doses)
      .where(and(eq(doses.userId, sam.id), eq(doses.id, doseId)));
    expect(dose?.takenAt?.toISOString()).toBe("2026-10-05T12:05:00.000Z");
  });

  it("applies a newer edit (last write wins)", async () => {
    const id = uuid();
    await pushAs(sam, { profiles: [profileRow(id)] });
    const { json } = await pushAs(sam, { profiles: [profileRow(id, { name: "Mother", updatedAt: T1 })] });
    expect(json.accepted).toBe(1);
    expect((await storedProfile(sam, id))?.name).toBe("Mother");
  });

  it("ignores an older edit", async () => {
    const id = uuid();
    await pushAs(sam, { profiles: [profileRow(id, { name: "Newest", updatedAt: T2 })] });
    const { json } = await pushAs(sam, { profiles: [profileRow(id, { name: "Older", updatedAt: T1 })] });
    expect(json.accepted).toBe(0);
    expect((await storedProfile(sam, id))?.name).toBe("Newest");
  });

  it("a newer delete beats an older edit, an older delete loses to a newer edit", async () => {
    const deleted = uuid();
    await pushAs(sam, { profiles: [profileRow(deleted, { updatedAt: T1 })] });
    expect((await pushAs(sam, { profiles: [profileRow(deleted, { deletedAt: T2 })] })).json.accepted).toBe(1);
    expect((await storedProfile(sam, deleted))?.deletedAt?.toISOString()).toBe(T2);

    const kept = uuid();
    await pushAs(sam, { profiles: [profileRow(kept, { updatedAt: T2, name: "Edited later" })] });
    expect((await pushAs(sam, { profiles: [profileRow(kept, { deletedAt: T1 })] })).json.accepted).toBe(0);
    expect((await storedProfile(sam, kept))?.deletedAt).toBeNull();
  });

  it("refuses rows stamped more than a day in the future", async () => {
    const id = uuid();
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const { json } = await pushAs(sam, { profiles: [profileRow(id, { updatedAt: future })] });
    expect(json.accepted).toBe(0);
    expect(await storedProfile(sam, id)).toBeUndefined();
  });

  it("keeps accounts apart even when ids collide", async () => {
    const id = uuid();
    await pushAs(sam, { profiles: [profileRow(id, { name: "Sam's mum" })] });
    await pushAs(ana, { profiles: [profileRow(id, { name: "Ana's dad", updatedAt: T2 })] });
    expect((await storedProfile(sam, id))?.name).toBe("Sam's mum");
    expect((await storedProfile(ana, id))?.name).toBe("Ana's dad");
  });

  it("caps rows per table", async () => {
    const rows = Array.from({ length: 2001 }, () => profileRow(uuid()));
    expect((await pushAs(sam, { profiles: rows })).status).toBe(400);
  });
});

describe("GET /api/sync/pull", () => {
  it("rejects requests without a session", async () => {
    expect((await pull(jsonRequest("/api/sync/pull"))).status).toBe(401);
  });

  it("rejects an unparseable since", async () => {
    expect((await pullAs(sam, "yesterday")).status).toBe(400);
  });

  it("returns only the caller's rows, tombstones included, in the wire shape", async () => {
    const fresh = await signUpTestUser("Puller");
    await createCircle(jsonRequest("/api/circles", { body: {}, cookie: fresh.cookie }));
    const liveId = uuid();
    const goneId = uuid();
    const medId = uuid();
    const doseId = uuid();
    await pushAs(fresh, {
      profiles: [profileRow(liveId), profileRow(goneId, { deletedAt: T1, updatedAt: T1 })],
      medications: [medicationRow(medId, liveId, { strength: null })],
      doses: [doseRow(doseId, medId)],
    });
    await pushAs(ana, { profiles: [profileRow(uuid(), { name: "Not yours" })] });

    const { status, json } = await pullAs(fresh);
    expect(status).toBe(200);
    expect(json.tables.profiles.map((r: { id: string }) => r.id).sort()).toEqual([liveId, goneId].sort());
    expect(json.tables.profiles.find((r: { id: string }) => r.id === goneId)).toEqual(
      profileRow(goneId, { deletedAt: T1, updatedAt: T1 }),
    );
    expect(json.tables.medications).toEqual([medicationRow(medId, liveId, { strength: null })]);
    expect(json.tables.doses).toEqual([doseRow(doseId, medId)]);
    expect(json.tables.profiles[0]).not.toHaveProperty("userId");
  });

  it("returns rows changed after since, using the previous serverTime as the cursor", async () => {
    const fresh = await signUpTestUser("Incremental");
    await createCircle(jsonRequest("/api/circles", { body: {}, cookie: fresh.cookie }));
    const oldId = uuid();
    await pushAs(fresh, { profiles: [profileRow(oldId)] });
    await handle.db
      .update(profiles)
      .set({ serverUpdatedAt: new Date(Date.now() - 60_000) })
      .where(eq(profiles.userId, fresh.id));
    const first = await pullAs(fresh);
    expect(first.json.tables.profiles.map((r: { id: string }) => r.id)).toEqual([oldId]);

    const newId = uuid();
    await pushAs(fresh, { profiles: [profileRow(newId)] });
    const second = await pullAs(fresh, first.json.serverTime);
    expect(second.json.tables.profiles.map((r: { id: string }) => r.id)).toEqual([newId]);
  });
});
