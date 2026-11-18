import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { updateCommandSchema } from "@/modules/developer-hub/schemas";
import {
  deleteCommand,
  DeveloperHubError,
  updateCommand,
} from "@/modules/developer-hub/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = updateCommandSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid command", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const command = await updateCommand(session.user.id, workspace.id, id, parsed.data);
    return apiOk({ command });
  } catch (error) {
    if (error instanceof DeveloperHubError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to update command");
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
    const deleted = await deleteCommand(session.user.id, id);
    return apiOk({ deleted });
  } catch (error) {
    if (error instanceof DeveloperHubError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to delete command");
  }
}
