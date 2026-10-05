import { errorResponse } from "@/app/api/_lib/respond";
import { requireUser } from "@/app/api/_lib/session";
import { getDb } from "@/lib/db/client";
import { deleteCircle } from "@/lib/services/circles";

/**
 * Owner only: stop sharing. Deletes the circle, its memberships and every
 * profile, medication, dose and escalation the owner synced. 403 for a
 * caregiver (who leaves via DELETE /members/:userId), 404 for anyone else.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    await deleteCircle(await getDb(), user.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "circles delete");
  }
}
