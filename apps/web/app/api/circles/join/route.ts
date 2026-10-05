import { errorResponse, readJson } from "@/app/api/_lib/respond";
import { requireUser } from "@/app/api/_lib/session";
import { getDb } from "@/lib/db/client";
import { joinCircle, joinCircleSchema } from "@/lib/services/circles";

/**
 * Joins a circle as a caregiver: `{ code: "ABCD-2345", profileName? }`.
 * 200 `{ circle }`; 404 `circle_not_found`, 409 `own_circle` / `circle_full`.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const input = await readJson(request, joinCircleSchema);
    return Response.json({ circle: await joinCircle(await getDb(), user, input) });
  } catch (error) {
    return errorResponse(error, "circles join");
  }
}
