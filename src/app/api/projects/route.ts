import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createProjectSchema } from "@/modules/projects/schemas";
import {
  createProject,
  listProjects,
  ProjectServiceError,
} from "@/modules/projects/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const items = await listProjects(session.user.id, workspace.id);
  return apiOk({ projects: items });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid project payload", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const project = await createProject(session.user.id, workspace.id, parsed.data);
    return apiOk({ project }, 201);
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to create project");
  }
}
