import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createMilestoneSchema } from "@/modules/projects/schemas";
import { createMilestone, ProjectServiceError } from "@/modules/projects/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id: projectId } = await context.params;
  const body: unknown = await request.json();
  const parsed = createMilestoneSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid milestone payload", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const milestone = await createMilestone(
      session.user.id,
      workspace.id,
      projectId,
      parsed.data
    );
    return apiOk({ milestone }, 201);
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to create milestone");
  }
}
