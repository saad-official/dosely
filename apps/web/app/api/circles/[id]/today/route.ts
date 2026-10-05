import { ApiError, errorResponse } from "@/app/api/_lib/respond";
import { requireUser } from "@/app/api/_lib/session";
import { getDb } from "@/lib/db/client";
import { circleToday, todayQuerySchema } from "@/lib/services/today";

/**
 * Read-only caregiver view: `?tz=<IANA zone>&date=YYYY-MM-DD` (both optional;
 * UTC and today by default). Answer: `{ circleId, ownerName, createdAt,
 * date, timeZone, generatedAt, members: [{ userId, name, profiles: [{ id, name, color,
 * doses: [{ id, medicationName, strength, dueAt, state, ... }] }] }] }`.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const search = new URL(request.url).searchParams;
    const parsed = todayQuerySchema.safeParse({ tz: search.get("tz") ?? undefined, date: search.get("date") ?? undefined });
    if (!parsed.success) {
      throw new ApiError(400, "Query does not match the expected shape.", "invalid_query", parsed.error.issues);
    }
    const view = await circleToday(await getDb(), user.id, id, { timeZone: parsed.data.tz, date: parsed.data.date });
    return Response.json(view, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error, "circle today");
  }
}
