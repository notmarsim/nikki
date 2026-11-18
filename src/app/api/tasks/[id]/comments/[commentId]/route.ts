import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { withUserRls } from "@/db/rls";
import { taskComments } from "@/db/schema";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id: taskId, commentId } = await context.params;

  const deleted = await withUserRls(session.user.id, async (tx) => {
    const existing = await tx
      .select({ id: taskComments.id })
      .from(taskComments)
      .where(
        and(
          eq(taskComments.id, commentId),
          eq(taskComments.taskId, taskId),
          eq(taskComments.userId, session.user.id)
        )
      )
      .limit(1);

    if (!existing[0]) return false;

    await tx
      .delete(taskComments)
      .where(
        and(eq(taskComments.id, commentId), eq(taskComments.userId, session.user.id))
      );
    return true;
  });

  if (!deleted) {
    return apiError(404, "COMMENT_NOT_FOUND", "Comment not found");
  }

  return apiOk({ deleted: true });
}
