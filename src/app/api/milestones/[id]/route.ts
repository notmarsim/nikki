import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { updateMilestoneSchema } from "@/modules/projects/schemas";
import {
  deleteMilestone,
  ProjectServiceError,
  updateMilestone,
} from "@/modules/projects/service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = updateMilestoneSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid milestone update", parsed.error.flatten().fieldErrors);
  }

  try {
    const milestone = await updateMilestone(session.user.id, id, parsed.data);
    return apiOk({ milestone });
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to update milestone");
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
    await deleteMilestone(session.user.id, id);
    return apiOk({ deleted: true });
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to delete milestone");
  }
}
