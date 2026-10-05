import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { eq } from "drizzle-orm";
import type { ExpoPushMessage } from "expo-server-sdk";
import { POST as joinCircle } from "@/app/api/circles/join/route";
import { POST as createCircle } from "@/app/api/circles/route";
import { POST as registerDevice } from "@/app/api/devices/route";
import { POST as escalate } from "@/app/api/escalations/route";
import type { DbHandle } from "@/lib/db/client";
import { devices, escalations } from "@/lib/db/schema";
import { missedDoseMessage, setPushSenderForTests, type PushSender } from "@/lib/services/push";
import { jsonRequest, signUpTestUser, startTestDb, stopTestDb, type TestUser } from "./helpers";

let handle: DbHandle;

beforeAll(async () => {
  handle = await startTestDb();
}, 60_000);

afterEach(() => {
  setPushSenderForTests(null);
});

afterAll(async () => {
  await stopTestDb(handle);
});

let counter = 0;
function uuid(): string {
  counter += 1;
  return `0199b0c4-1111-7000-8000-${String(counter).padStart(12, "0")}`;
}
function token(label: string): string {
  counter += 1;
  return `ExponentPushToken[${label}-${counter}]`;
}

/** Records every message and answers with ok tickets (or the given ticket per token). */
function recordingSender(errors: Record<string, string> = {}) {
  const sent: ExpoPushMessage[] = [];
  const send = vi.fn<PushSender>(async (messages) => {
    sent.push(...messages);
    return messages.map((m) =>
      errors[m.to as string]
        ? { status: "error" as const, message: "gone", details: { error: errors[m.to as string] as "DeviceNotRegistered" } }
        : { status: "ok" as const, id: `ticket-${m.to}` },
    );
  });
  setPushSenderForTests(send);
  return { sent, send };
}

async function addDevice(who: TestUser, expoPushToken: string) {
  const response = await registerDevice(jsonRequest("/api/devices", { body: { token: expoPushToken, platform: "ios" }, cookie: who.cookie }));
  expect(response.status).toBe(200);
}

/** A member with a circle, two caregivers (one with two phones, one with one) and the member's own phone. */
async function circleWithCaregivers() {
  const member = await signUpTestUser("Maria");
  const lena = await signUpTestUser("Lena");
  const tom = await signUpTestUser("Tom");
  const created = await createCircle(jsonRequest("/api/circles", { body: { profileName: "Mum" }, cookie: member.cookie }));
  const { circle } = await created.json();
  for (const who of [lena, tom]) {
    await joinCircle(jsonRequest("/api/circles/join", { body: { code: circle.inviteCode }, cookie: who.cookie }));
  }
  const tokens = { lenaPhone: token("lena-phone"), lenaTablet: token("lena-tablet"), tom: token("tom"), member: token("maria") };
  await addDevice(lena, tokens.lenaPhone);
  await addDevice(lena, tokens.lenaTablet);
  await addDevice(tom, tokens.tom);
  await addDevice(member, tokens.member);
  return { member, lena, tom, circleId: circle.id as string, tokens };
}

const dueAt = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

async function report(who: TestUser | null, body: unknown) {
  const response = await escalate(jsonRequest("/api/escalations", { body, cookie: who?.cookie }));
  return { status: response.status, json: await response.json() };
}

describe("missedDoseMessage", () => {
  const now = new Date("2026-10-05T13:35:00.000Z");
  const due = "2026-10-05T12:00:00.000Z";

  it("names the person and the medication", () => {
    expect(missedDoseMessage({ profileName: "Mum", medNames: ["Metformin 500 mg"], dueAt: due }, now)).toEqual({
      title: "Mum hasn't marked a dose",
      body: "Metformin 500 mg was due 95 min ago. You may want to check in.",
    });
  });

  it("lists two medications and summarises more", () => {
    expect(missedDoseMessage({ profileName: "Dad", medNames: ["A", "B"], dueAt: due }, now).body).toMatch(/^A and B were due/);
    expect(missedDoseMessage({ profileName: "Dad", medNames: ["A", "B", "C", "D"], dueAt: due }, now).body).toMatch(
      /^A, B and 2 more were due/,
    );
  });

  it("switches to hours after three hours", () => {
    const later = new Date("2026-10-05T17:10:00.000Z");
    expect(missedDoseMessage({ profileName: "Mum", medNames: ["A"], dueAt: due }, later).body).toMatch(/due about 5 hours ago/);
  });
});

describe("POST /api/escalations", () => {
  it("requires a session", async () => {
    expect((await report(null, { doseIds: [uuid()], profileName: "Mum", medNames: ["A"], dueAt: dueAt(95) })).status).toBe(401);
  });

  it("validates the body", async () => {
    const { member } = await circleWithCaregivers();
    expect((await report(member, { doseIds: [], profileName: "Mum", medNames: ["A"], dueAt: dueAt(95) })).status).toBe(400);
    expect((await report(member, { doseIds: ["nope"], profileName: "Mum", medNames: ["A"], dueAt: dueAt(95) })).status).toBe(400);
    expect((await report(member, { doseIds: [uuid()], profileName: "", medNames: ["A"], dueAt: dueAt(95) })).status).toBe(400);
    expect((await report(member, { doseIds: [uuid()], profileName: "Mum", medNames: [], dueAt: "soon" })).status).toBe(400);
  });

  it("refuses a dose that is not due yet", async () => {
    const { member } = await circleWithCaregivers();
    const { status, json } = await report(member, { doseIds: [uuid()], profileName: "Mum", medNames: ["A"], dueAt: dueAt(-60) });
    expect(status).toBe(400);
    expect(json.code).toBe("not_due");
  });

  it("pushes to every caregiver device, not the member's own phone", async () => {
    const { member, circleId, tokens } = await circleWithCaregivers();
    const { sent } = recordingSender();
    const doseIds = [uuid(), uuid()];
    const { status, json } = await report(member, {
      doseIds,
      profileName: "Mum",
      medNames: ["Metformin 500 mg", "Atorvastatin 20 mg"],
      dueAt: dueAt(95),
    });
    expect(status).toBe(200);
    expect(json).toEqual({ escalated: doseIds, alreadyEscalated: [], notified: 3 });
    expect(sent.map((m) => m.to).sort()).toEqual([tokens.lenaPhone, tokens.lenaTablet, tokens.tom].sort());
    expect(sent[0]).toMatchObject({
      title: "Mum hasn't marked a dose",
      body: expect.stringMatching(/^Metformin 500 mg and Atorvastatin 20 mg were due 9[45] min ago/),
      sound: "default",
      priority: "high",
      interruptionLevel: "time-sensitive",
      channelId: "caregiver-alerts",
      data: { kind: "dose_missed", circleId, memberUserId: member.id, doseIds, url: `dosely://circle/${circleId}` },
    });
  });

  it("is idempotent per dose: a repeat report pushes nothing, a new dose pushes again", async () => {
    const { member } = await circleWithCaregivers();
    const { send } = recordingSender();
    const first = uuid();
    const body = { doseIds: [first], profileName: "Mum", medNames: ["A"], dueAt: dueAt(95) };
    await report(member, body);
    const again = await report(member, body);
    expect(again.json).toEqual({ escalated: [], alreadyEscalated: [first], notified: 0 });
    expect(send).toHaveBeenCalledTimes(1);

    const second = uuid();
    const mixed = await report(member, { ...body, doseIds: [first, second] });
    expect(mixed.json).toEqual({ escalated: [second], alreadyEscalated: [first], notified: 3 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]![0][0]!.data).toMatchObject({ doseIds: [second] });
  });

  it("does nothing for someone without a circle or without caregivers", async () => {
    const { send } = recordingSender();
    const loner = await signUpTestUser();
    const body = { doseIds: [uuid()], profileName: "Me", medNames: ["A"], dueAt: dueAt(95) };
    expect((await report(loner, body)).json).toEqual({ escalated: [], alreadyEscalated: [], notified: 0 });

    const alone = await signUpTestUser();
    await createCircle(jsonRequest("/api/circles", { body: {}, cookie: alone.cookie }));
    expect((await report(alone, body)).json).toEqual({ escalated: [], alreadyEscalated: [], notified: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(await handle.db.select().from(escalations).where(eq(escalations.userId, alone.id))).toEqual([]);
  });

  it("a caregiver reporting their own missed dose does not alert the circles they care for", async () => {
    const { lena } = await circleWithCaregivers();
    const { send } = recordingSender();
    await report(lena, { doseIds: [uuid()], profileName: "Lena", medNames: ["A"], dueAt: dueAt(95) });
    expect(send).not.toHaveBeenCalled();
  });

  it("removes devices Expo reports as no longer registered", async () => {
    const { member, tokens } = await circleWithCaregivers();
    recordingSender({ [tokens.tom]: "DeviceNotRegistered" });
    await report(member, { doseIds: [uuid()], profileName: "Mum", medNames: ["A"], dueAt: dueAt(95) });
    expect(await handle.db.select().from(devices).where(eq(devices.expoPushToken, tokens.tom))).toEqual([]);
    expect(await handle.db.select().from(devices).where(eq(devices.expoPushToken, tokens.lenaPhone))).toHaveLength(1);
  });

  it("forgets the escalation when the push fails, so a retry can alert", async () => {
    const { member } = await circleWithCaregivers();
    setPushSenderForTests(async () => {
      throw new Error("Expo is down");
    });
    const body = { doseIds: [uuid()], profileName: "Mum", medNames: ["A"], dueAt: dueAt(95) };
    const failed = await report(member, body);
    expect(failed.status).toBe(502);
    expect(failed.json.code).toBe("push_failed");

    recordingSender();
    expect((await report(member, body)).json.notified).toBe(3);
  });
});
