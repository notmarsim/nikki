import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { deleteHabitEntry } from "@/modules/habits/service";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ entryId: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { entryId } = await context.params;
  await deleteHabitEntry(session.user.id, entryId);
  return apiOk({ deleted: true });
}
