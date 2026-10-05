import { errorResponse, readJson } from "@/app/api/_lib/respond";
import { requireUser } from "@/app/api/_lib/session";
import { getDb } from "@/lib/db/client";
import { escalateMissedDoses, reportMissedSchema } from "@/lib/services/escalations";

/**
 * The member's device reports doses still unmarked 30 minutes after their
 * window: `{ doseIds, profileName, medNames, dueAt }`. Caregivers of the
 * caller's circle get one push per device; repeats for the same dose are
 * ignored. Answer: `{ escalated, alreadyEscalated, notified }`.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const input = await readJson(request, reportMissedSchema);
    return Response.json(await escalateMissedDoses(await getDb(), user.id, input));
  } catch (error) {
    return errorResponse(error, "escalations");
  }
}
