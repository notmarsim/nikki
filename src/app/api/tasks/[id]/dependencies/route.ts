import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  addTaskDependency,
  DependencyCycleError,
  getTaskDependencies,
  removeTaskDependency,
} from "@/modules/dependencies/service";

const postSchema = z.object({
  dependsOnTaskId: z.string().uuid(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const data = await getTaskDependencies(session.user.id, id);
  return apiOk(data);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Valid dependsOnTaskId required");

  try {
    const created = await addTaskDependency(session.user.id, id, parsed.data.dependsOnTaskId);
    return apiOk({ dependency: created }, 201);
  } catch (err) {
    if (err instanceof DependencyCycleError) {
      return apiError(400, "DEPENDENCY_CYCLE", err.message);
    }
    return apiError(400, "DEPENDENCY_ERROR", err instanceof Error ? err.message : "Failed to add dependency");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const dependsOnTaskId = new URL(request.url).searchParams.get("dependsOnTaskId");
  if (!dependsOnTaskId) return apiError(400, "VALIDATION_ERROR", "dependsOnTaskId required");

  const res = await removeTaskDependency(session.user.id, id, dependsOnTaskId);
  return apiOk(res);
}
