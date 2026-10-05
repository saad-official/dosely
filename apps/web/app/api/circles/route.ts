import { errorResponse, readJson } from "@/app/api/_lib/respond";
import { requireUser } from "@/app/api/_lib/session";
import { getDb } from "@/lib/db/client";
import { createCircle, createCircleSchema, listCircles } from "@/lib/services/circles";

/**
 * POST: create the caller's caregiver circle (`{ profileName? }`). 201 with
 * `{ circle }` (including the invite code to share), or 200 with the circle
 * the caller already owns.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const input = await readJson(request, createCircleSchema);
    const { circle, created } = await createCircle(await getDb(), user, input);
    return Response.json({ circle }, { status: created ? 201 : 200 });
  } catch (error) {
    return errorResponse(error, "circles create");
  }
}

/** GET: `{ circles }`, every circle the caller owns or cares for, with members. */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return Response.json({ circles: await listCircles(await getDb(), user.id) });
  } catch (error) {
    return errorResponse(error, "circles list");
  }
}
