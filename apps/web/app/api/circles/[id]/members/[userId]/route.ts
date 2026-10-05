import { errorResponse } from "@/app/api/_lib/respond";
import { requireUser } from "@/app/api/_lib/session";
import { getDb } from "@/lib/db/client";
import { removeMember } from "@/lib/services/circles";

/**
 * Removes someone from a circle. The owner can remove any caregiver; a
 * caregiver can only remove themselves (leave). The owner cannot be removed.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const user = await requireUser(request);
    const { id, userId } = await params;
    await removeMember(await getDb(), user.id, id, userId);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "circles remove member");
  }
}
