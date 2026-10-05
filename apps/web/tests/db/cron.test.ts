import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ExpoPushMessage } from "expo-server-sdk";
import { GET as daily } from "@/app/api/cron/daily/route";
import { POST as joinCircle } from "@/app/api/circles/join/route";
import { POST as createCircle } from "@/app/api/circles/route";
import type { DbHandle } from "@/lib/db/client";
import { devices, doses, escalations, medications, profiles } from "@/lib/db/schema";
import { runDailyJob, SWEEP_LOOKBACK_HOURS } from "@/lib/services/daily";
import { setPushSenderForTests, type PushSender } from "@/lib/services/push";
import { jsonRequest, signUpTestUser, startTestDb, stopTestDb, type TestUser } from "./helpers";

const SECRET = "cron-test-secret";
const NOW = new Date("2026-10-05T18:00:00.000Z");
const T0 = new Date("2026-10-01T00:00:00.000Z");
const base = { createdAt: T0, updatedAt: T0 };
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

let handle: DbHandle;

beforeAll(async () => {
  process.env.CRON_SECRET = SECRET;
  handle = await startTestDb();
}, 60_000);

afterEach(() => setPushSenderForTests(null));

afterAll(async () => {
  delete process.env.CRON_SECRET;
  await stopTestDb(handle);
});

function cronRequest(authorization?: string) {
  return jsonRequest("/api/cron/daily", { headers: authorization ? { authorization } : {} });
}

function recorder() {
  const sent: ExpoPushMessage[] = [];
  const send = vi.fn<PushSender>(async (messages) => {
    sent.push(...messages);
    return messages.map(() => ({ status: "ok" as const, id: "t" }));
  });
  return { sent, send };
}

let seq = 0;
async function memberWithCaregiver(name: string) {
  seq += 1;
  const member = await signUpTestUser(name);
  const caregiver = await signUpTestUser(`${name}'s carer`);
  const created = await createCircle(jsonRequest("/api/circles", { body: { profileName: name }, cookie: member.cookie }));
  const { circle } = await created.json();
  await joinCircle(jsonRequest("/api/circles/join", { body: { code: circle.inviteCode }, cookie: caregiver.cookie }));
  const token = `ExponentPushToken[carer-${seq}]`;
  await handle.db.insert(devices).values({ userId: caregiver.id, expoPushToken: token, platform: "android" });
  return { member, caregiver, token };
}

async function seedMeds(who: TestUser, prefix: string) {
  await handle.db.insert(profiles).values({ ...base, id: `${prefix}-p`, userId: who.id, name: "Maria", color: "teal" });
  await handle.db.insert(medications).values([
    { ...base, id: `${prefix}-met`, userId: who.id, profileId: `${prefix}-p`, name: "Metformin", strength: "500 mg", schedule: {}, windowMinutes: 60 },
    { ...base, id: `${prefix}-statin`, userId: who.id, profileId: `${prefix}-p`, name: "Atorvastatin", schedule: {}, windowMinutes: 60 },
  ]);
}

function dose(who: TestUser, id: string, medicationId: string, dueAt: Date, extra: Partial<typeof doses.$inferInsert> = {}) {
  return { ...base, id, userId: who.id, medicationId, dueAt, ...extra };
}

describe("GET /api/cron/daily", () => {
  it("rejects a missing or wrong bearer secret", async () => {
    expect((await daily(cronRequest())).status).toBe(401);
    expect((await daily(cronRequest("Bearer wrong"))).status).toBe(401);
  });

  it("rejects everything when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    try {
      expect((await daily(cronRequest("Bearer "))).status).toBe(401);
      expect((await daily(cronRequest("Bearer undefined"))).status).toBe(401);
    } finally {
      process.env.CRON_SECRET = SECRET;
    }
  });

  it("runs the keep-alive and the sweep with the right secret", async () => {
    setPushSenderForTests(recorder().send);
    const response = await daily(cronRequest(`Bearer ${SECRET}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, keepAlive: true, sweep: { escalated: expect.any(Number) } });
  });
});

describe("missed-dose sweep", () => {
  it("alerts caregivers once per profile for doses unmarked 30 min past their window", async () => {
    const { member, token } = await memberWithCaregiver("Maria");
    await seedMeds(member, "a");
    await handle.db.insert(doses).values([
      dose(member, "a-missed-1", "a-met", hoursAgo(3)),
      dose(member, "a-missed-2", "a-statin", hoursAgo(2)),
      dose(member, "a-taken", "a-met", hoursAgo(4), { takenAt: hoursAgo(3.9) }),
      dose(member, "a-skipped", "a-met", hoursAgo(5), { skippedAt: hoursAgo(5) }),
      dose(member, "a-late", "a-met", hoursAgo(1.25)), // window ended 15 min ago: not yet missed
      dose(member, "a-snoozed", "a-met", hoursAgo(1.75), { snoozedUntil: hoursAgo(0.25) }),
      dose(member, "a-deleted", "a-met", hoursAgo(3), { deletedAt: hoursAgo(2) }),
      dose(member, "a-ancient", "a-met", hoursAgo(SWEEP_LOOKBACK_HOURS + 1)),
      dose(member, "a-future", "a-met", hoursAgo(-2)),
    ]);
    const { sent, send } = recorder();
    const result = await runDailyJob({ now: NOW, send });
    const mine = sent.filter((m) => m.to === token);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      title: "Maria hasn't marked a dose",
      body: "Metformin 500 mg and Atorvastatin were due about 3 hours ago. You may want to check in.",
    });
    expect((mine[0]!.data as { doseIds: string[] }).doseIds.sort()).toEqual(["a-missed-1", "a-missed-2"]);
    expect(result.sweep.escalated).toBeGreaterThanOrEqual(2);
  });

  it("does not alert twice, whether the device reported first or the sweep ran before", async () => {
    const { member, token } = await memberWithCaregiver("Rosa");
    await seedMeds(member, "b");
    await handle.db.insert(doses).values([
      dose(member, "b-reported", "b-met", hoursAgo(3)),
      dose(member, "b-swept", "b-met", hoursAgo(2)),
    ]);
    await handle.db.insert(escalations).values({ userId: member.id, doseId: "b-reported", notifiedAt: hoursAgo(1) });

    const first = recorder();
    await runDailyJob({ now: NOW, send: first.send });
    const firstMine = first.sent.filter((m) => m.to === token);
    expect(firstMine).toHaveLength(1);
    expect((firstMine[0]!.data as { doseIds: string[] }).doseIds).toEqual(["b-swept"]);

    const second = recorder();
    await runDailyJob({ now: NOW, send: second.send });
    expect(second.sent.filter((m) => m.to === token)).toEqual([]);
  });

  it("ignores mirrored doses of someone who no longer has a circle", async () => {
    const orphan = await signUpTestUser("No circle");
    await seedMeds(orphan, "c");
    await handle.db.insert(doses).values(dose(orphan, "c-missed", "c-met", hoursAgo(3)));
    const { send } = recorder();
    await runDailyJob({ now: NOW, send });
    const rows = await handle.db.select().from(escalations);
    expect(rows.find((r) => r.doseId === "c-missed")).toBeUndefined();
  });

  it("keeps going when one push batch fails", async () => {
    const { member } = await memberWithCaregiver("Ines");
    await seedMeds(member, "d");
    await handle.db.insert(doses).values(dose(member, "d-missed", "d-met", hoursAgo(3)));
    const send = vi.fn<PushSender>(async () => {
      throw new Error("Expo down");
    });
    const result = await runDailyJob({ now: NOW, send });
    expect(result.sweep.errors).toBeGreaterThanOrEqual(1);
    const rows = await handle.db.select().from(escalations);
    expect(rows.find((r) => r.doseId === "d-missed")).toBeUndefined();
  });
});
