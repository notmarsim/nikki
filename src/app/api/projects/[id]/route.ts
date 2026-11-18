import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { updateProjectSchema } from "@/modules/projects/schemas";
import {
  deleteProject,
  getProjectDetails,
  ProjectServiceError,
  updateProject,
} from "@/modules/projects/service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  try {
    const details = await getProjectDetails(session.user.id, id);
    return apiOk(details);
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to load project");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid project update", parsed.error.flatten().fieldErrors);
  }

  try {
    const project = await updateProject(session.user.id, id, parsed.data);
    return apiOk({ project });
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to update project");
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  try {
    await deleteProject(session.user.id, id);
    return apiOk({ deleted: true });
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to delete project");
  }
}
