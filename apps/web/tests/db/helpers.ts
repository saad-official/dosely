/**
 * Shared PGlite setup for database tests. Each test file calls
 * `vi.mock("server-only")` itself (vi.mock is hoisted per file), then
 * `startTestDb()` in beforeAll.
 */
import { createPgliteDb, setDbHandle, type DbHandle } from "@/lib/db/client";
import { getAuth, resetAuthForTests } from "@/lib/auth/server";

export const TEST_AUTH_SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";

/** Fresh in-memory PGlite with every migration in drizzle/ applied, wired into getDb() and Better Auth. */
export async function startTestDb(): Promise<DbHandle> {
  process.env.BETTER_AUTH_SECRET = TEST_AUTH_SECRET;
  const handle = await createPgliteDb(undefined);
  setDbHandle(handle);
  resetAuthForTests();
  return handle;
}

export async function stopTestDb(handle: DbHandle | undefined): Promise<void> {
  resetAuthForTests();
  setDbHandle(null);
  await handle?.close();
}

let userCounter = 0;

export type TestUser = { id: string; email: string; cookie: string };

/**
 * Signs a user up through Better Auth and returns the session cookie the
 * Expo client would send (`Cookie: dosely.session_token=...`).
 */
export async function signUpTestUser(name = "Sam Rivera"): Promise<TestUser> {
  userCounter += 1;
  const email = `person${userCounter}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const auth = await getAuth();
  const { headers, response } = await auth.api.signUpEmail({
    body: { name, email, password: "correct horse battery" },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
  return { id: response.user.id, email, cookie };
}

/** A JSON request against a route handler, optionally signed in. */
export function jsonRequest(
  url: string,
  init: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {},
): Request {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (init.cookie) headers.set("cookie", init.cookie);
  return new Request(new URL(url, "http://localhost:3700"), {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
