import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { startFocusSchema } from "@/modules/focus/schemas";
import {
  FocusServiceError,
  getFocusOverview,
  startFocusSession,
} from "@/modules/focus/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const overview = await getFocusOverview(session.user.id);
  return apiOk(overview);
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = startFocusSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid focus session payload", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const created = await startFocusSession(session.user.id, workspace.id, parsed.data);
    return apiOk({ session: created }, 201);
  } catch (error) {
    if (error instanceof FocusServiceError) {
      return apiError(error.status, error.code, error.message, error.data);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to start focus session");
  }
}
