import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { linkProjectRepoSchema } from "@/modules/developer-hub/schemas";
import {
  DeveloperHubError,
  linkRepositoryToProject,
  unlinkRepositoryFromProject,
} from "@/modules/developer-hub/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = linkProjectRepoSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid repository link", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const link = await linkRepositoryToProject(session.user.id, workspace.id, parsed.data);
    return apiOk({ link }, 201);
  } catch (error) {
    if (error instanceof DeveloperHubError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to link repository");
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError(400, "VALIDATION_ERROR", "Link id required");

  try {
    const deleted = await unlinkRepositoryFromProject(session.user.id, id);
    return apiOk({ deleted });
  } catch (error) {
    if (error instanceof DeveloperHubError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to unlink repository");
  }
}
