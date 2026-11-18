import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createCommandSchema } from "@/modules/developer-hub/schemas";
import {
  createCommand,
  DeveloperHubError,
  getDeveloperHubOverview,
} from "@/modules/developer-hub/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const overview = await getDeveloperHubOverview(session.user.id, workspace.id);
  return apiOk({ commands: overview.commands });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createCommandSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid command", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const command = await createCommand(session.user.id, workspace.id, parsed.data);
    return apiOk({ command }, 201);
  } catch (error) {
    if (error instanceof DeveloperHubError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to create command");
  }
}
