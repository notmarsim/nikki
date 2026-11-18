import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { focusActionSchema } from "@/modules/focus/schemas";
import {
  FocusServiceError,
  transitionFocusSession,
} from "@/modules/focus/service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = focusActionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid focus action");
  }

  try {
    const updated = await transitionFocusSession(
      session.user.id,
      id,
      parsed.data.action
    );
    return apiOk({ session: updated });
  } catch (error) {
    if (error instanceof FocusServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to update focus session");
  }
}
