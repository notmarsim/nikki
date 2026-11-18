import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { updateFocusPreferencesSchema } from "@/modules/focus/schemas";
import { updateFocusPreferences } from "@/modules/focus/service";

export async function PATCH(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = updateFocusPreferencesSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid preferences");
  }

  const preferences = await updateFocusPreferences(session.user.id, parsed.data);
  return apiOk({ preferences });
}
