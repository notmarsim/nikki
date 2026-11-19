import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { updateTaskSchema } from "@/modules/tasks/schemas";
import {
  deleteTask,
  TaskServiceError,
  updateTask,
} from "@/modules/tasks/service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid task update", parsed.error.flatten().fieldErrors);
  }

  try {
    const task = await updateTask(session.user.id, id, parsed.data);
    return apiOk({ task });
  } catch (error) {
    if (error instanceof TaskServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to update task");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const permanent = new URL(request.url).searchParams.get("permanent") === "true";
  try {
    await deleteTask(session.user.id, id, permanent);
    return apiOk({ deleted: true, permanent });
  } catch (error) {
    if (error instanceof TaskServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to delete task");
  }
}
