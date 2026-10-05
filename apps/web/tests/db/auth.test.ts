import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { eq } from "drizzle-orm";
import { isApiError } from "@/app/api/_lib/respond";
import { requireUser } from "@/app/api/_lib/session";
import { GET as health } from "@/app/api/health/route";
import { AUTH_COOKIE_PREFIX, getAuth, trustedOrigins } from "@/lib/auth/server";
import type { DbHandle } from "@/lib/db/client";
import { account, circleMembers, circles, devices, doses, user } from "@/lib/db/schema";
import { jsonRequest, signUpTestUser, startTestDb, stopTestDb } from "./helpers";

let handle: DbHandle;

beforeAll(async () => {
  handle = await startTestDb();
}, 60_000);

afterAll(async () => {
  await stopTestDb(handle);
});

describe("Better Auth on PGlite", () => {
  it("signs up with email + password into the dosely schema with a hashed password", async () => {
    const created = await signUpTestUser("Ana Ortiz");
    const [stored] = await handle.db.select().from(user).where(eq(user.id, created.id));
    expect(stored).toMatchObject({ name: "Ana Ortiz", email: created.email, emailVerified: false });
    const [credential] = await handle.db.select().from(account).where(eq(account.userId, created.id));
    expect(credential?.providerId).toBe("credential");
    expect(credential?.password).not.toContain("correct horse");
  });

  it("issues session cookies with the dosely prefix", async () => {
    const created = await signUpTestUser();
    expect(AUTH_COOKIE_PREFIX).toBe("dosely");
    expect(created.cookie).toContain("dosely.session_token=");
  });

  it("deleting the account removes the circle, mirrored doses and devices", async () => {
    const created = await signUpTestUser("Leaving");
    const now = new Date();
    const [circle] = await handle.db.insert(circles).values({ ownerUserId: created.id, inviteCode: "LEAVE234" }).returning();
    await handle.db.insert(circleMembers).values({ circleId: circle!.id, userId: created.id, role: "member", profileName: "Me" });
    await handle.db.insert(doses).values({
      id: "d-1",
      userId: created.id,
      medicationId: "m-1",
      dueAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await handle.db.insert(devices).values({ userId: created.id, expoPushToken: "ExponentPushToken[leaving]", platform: "ios" });

    const auth = await getAuth();
    await auth.api.deleteUser({ body: { password: "correct horse battery" }, headers: new Headers({ cookie: created.cookie }) });

    expect(await handle.db.select().from(user).where(eq(user.id, created.id))).toEqual([]);
    expect(await handle.db.select().from(circles).where(eq(circles.id, circle!.id))).toEqual([]);
    expect(await handle.db.select().from(circleMembers).where(eq(circleMembers.userId, created.id))).toEqual([]);
    expect(await handle.db.select().from(doses).where(eq(doses.userId, created.id))).toEqual([]);
    expect(await handle.db.select().from(devices).where(eq(devices.userId, created.id))).toEqual([]);
  });

  it("trusts the dosely:// app scheme and localhost:3700", () => {
    const origins = trustedOrigins();
    expect(origins).toContain("dosely://");
    expect(origins).toContain("http://localhost:3700");
  });
});

describe("requireUser", () => {
  it("returns the session user for a valid session cookie", async () => {
    const created = await signUpTestUser();
    const sessionUser = await requireUser(jsonRequest("/api/circles", { cookie: created.cookie }));
    expect(sessionUser.id).toBe(created.id);
  });

  it("throws a 401 ApiError without a session", async () => {
    const error = await requireUser(jsonRequest("/api/circles")).catch((e: unknown) => e);
    expect(isApiError(error) && error.status).toBe(401);
  });

  it("throws a 401 ApiError for a forged cookie", async () => {
    const error = await requireUser(
      jsonRequest("/api/circles", { cookie: `${AUTH_COOKIE_PREFIX}.session_token=forged.value` }),
    ).catch((e: unknown) => e);
    expect(isApiError(error) && error.status).toBe(401);
  });
});

describe("GET /api/health", () => {
  it("answers ok with the version and no database", async () => {
    const response = health();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, service: "dosely", version: expect.any(String) });
  });
});
