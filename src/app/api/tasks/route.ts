import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createTaskSchema } from "@/modules/tasks/schemas";
import {
  createTask,
  listTasks,
  TaskServiceError,
} from "@/modules/tasks/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const { searchParams } = new URL(request.url);

  const items = await listTasks(session.user.id, workspace.id, {
    projectId: searchParams.get("projectId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
  });

  return apiOk({ tasks: items });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid task payload", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const task = await createTask(session.user.id, workspace.id, parsed.data);
    return apiOk({ task }, 201);
  } catch (error) {
    if (error instanceof TaskServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to create task");
  }
}
