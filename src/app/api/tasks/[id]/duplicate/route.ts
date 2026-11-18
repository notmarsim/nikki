import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { duplicateTask, TaskServiceError } from "@/modules/tasks/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const task = await duplicateTask(session.user.id, workspace.id, id);
    return apiOk({ task }, 201);
  } catch (error) {
    if (error instanceof TaskServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to duplicate task");
  }
}
