import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET as today } from "@/app/api/circles/[id]/today/route";
import { POST as joinCircle } from "@/app/api/circles/join/route";
import { POST as createCircle } from "@/app/api/circles/route";
import type { DbHandle } from "@/lib/db/client";
import { doses, medications, profiles } from "@/lib/db/schema";
import { circleToday } from "@/lib/services/today";
import { jsonRequest, signUpTestUser, startTestDb, stopTestDb, type TestUser } from "./helpers";

let handle: DbHandle;
let mum: TestUser;
let daughter: TestUser;
let outsider: TestUser;
let circleId: string;

const NOW = new Date("2026-10-05T16:00:00.000Z"); // 12:00 in Toronto
const T0 = new Date("2026-10-01T00:00:00.000Z");
const base = { createdAt: T0, updatedAt: T0 };

beforeAll(async () => {
  handle = await startTestDb();
  mum = await signUpTestUser("Maria");
  daughter = await signUpTestUser("Lena");
  outsider = await signUpTestUser("Outsider");
  const created = await createCircle(jsonRequest("/api/circles", { body: { profileName: "Mum" }, cookie: mum.cookie }));
  const { circle } = await created.json();
  circleId = circle.id;
  await joinCircle(jsonRequest("/api/circles/join", { body: { code: circle.inviteCode }, cookie: daughter.cookie }));

  await handle.db.insert(profiles).values([
    { ...base, id: "p-mum", userId: mum.id, name: "Maria", color: "teal" },
    { ...base, id: "p-gone", userId: mum.id, name: "Old profile", color: "blue", deletedAt: T0 },
  ]);
  await handle.db.insert(medications).values([
    { ...base, id: "m-met", userId: mum.id, profileId: "p-mum", name: "Metformin", strength: "500 mg", schedule: {}, windowMinutes: 60 },
    { ...base, id: "m-statin", userId: mum.id, profileId: "p-mum", name: "Atorvastatin", strength: "20 mg", schedule: {}, windowMinutes: 120 },
    { ...base, id: "m-stopped", userId: mum.id, profileId: "p-mum", name: "Stopped", schedule: {}, deletedAt: T0 },
  ]);
  const dose = (id: string, medicationId: string, dueAt: string, extra: Partial<typeof doses.$inferInsert> = {}) => ({
    ...base,
    id,
    userId: mum.id,
    medicationId,
    dueAt: new Date(dueAt),
    ...extra,
  });
  await handle.db.insert(doses).values([
    dose("d-morning", "m-met", "2026-10-05T12:00:00.000Z", { takenAt: new Date("2026-10-05T12:10:00.000Z") }), // 08:00 local
    dose("d-noon", "m-statin", "2026-10-05T15:30:00.000Z"), // 11:30 local, window 2h -> due
    dose("d-early", "m-met", "2026-10-05T14:00:00.000Z"), // 10:00 local, window 1h -> missed by 12:00
    dose("d-evening", "m-met", "2026-10-06T00:00:00.000Z"), // 20:00 local -> upcoming
    dose("d-yesterday", "m-met", "2026-10-05T00:00:00.000Z"), // 20:00 local on the 4th
    dose("d-deleted", "m-met", "2026-10-05T13:00:00.000Z", { deletedAt: T0 }),
    dose("d-stopped-med", "m-stopped", "2026-10-05T13:00:00.000Z"),
  ]);
}, 60_000);

afterAll(async () => {
  await stopTestDb(handle);
});

function request(who: TestUser | null, id: string, query = "") {
  return today(jsonRequest(`/api/circles/${id}/today${query}`, { cookie: who?.cookie }), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/circles/:id/today", () => {
  it("requires a session", async () => {
    expect((await request(null, circleId)).status).toBe(401);
  });

  it("is a 404 for someone outside the circle", async () => {
    const response = await request(outsider, circleId, "?tz=America/Toronto");
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("circle_not_found");
  });

  it("rejects an unknown time zone or a malformed date", async () => {
    expect((await request(daughter, circleId, "?tz=Mars/Base")).status).toBe(400);
    expect((await request(daughter, circleId, "?tz=UTC&date=05-10-2026")).status).toBe(400);
  });

  it("lets a caregiver read the circle's doses for today", async () => {
    const response = await request(daughter, circleId, "?tz=America/Toronto&date=2026-10-05");
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ circleId, date: "2026-10-05", timeZone: "America/Toronto" });
    expect(json.members).toHaveLength(1);
    expect(json.members[0]).toMatchObject({ userId: mum.id, name: "Mum" });
  });
});

describe("circleToday", () => {
  it("lists live doses due in the local day with their state, in due order", async () => {
    const view = await circleToday(handle.db, daughter.id, circleId, { timeZone: "America/Toronto", date: "2026-10-05" }, NOW);
    const [member] = view.members;
    expect(member?.profiles.map((p) => p.name)).toEqual(["Maria"]);
    const rows = member!.profiles[0]!.doses.map((d) => [d.id, d.medicationName, d.state]);
    expect(rows).toEqual([
      ["d-morning", "Metformin", "taken"],
      ["d-early", "Metformin", "missed"],
      ["d-noon", "Atorvastatin", "due"],
      ["d-evening", "Metformin", "upcoming"],
    ]);
    expect(member!.profiles[0]!.doses[2]).toMatchObject({ strength: "20 mg", dueAt: "2026-10-05T15:30:00.000Z" });
  });

  it("defaults the date to today in the zone", async () => {
    const view = await circleToday(handle.db, daughter.id, circleId, { timeZone: "America/Toronto" }, NOW);
    expect(view.date).toBe("2026-10-05");
  });

  it("the member can see their own circle's view too", async () => {
    const view = await circleToday(handle.db, mum.id, circleId, { timeZone: "America/Toronto", date: "2026-10-05" }, NOW);
    expect(view.members[0]?.profiles[0]?.doses).toHaveLength(4);
  });

  it("does not include caregivers' own data", async () => {
    await handle.db.insert(profiles).values({ ...base, id: "p-lena", userId: daughter.id, name: "Lena", color: "rose" });
    const view = await circleToday(handle.db, daughter.id, circleId, { timeZone: "UTC" }, NOW);
    expect(view.members.map((m) => m.userId)).toEqual([mum.id]);
  });
});
