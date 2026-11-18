import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { convertInboxItemSchema } from "@/modules/inbox/schemas";
import { convertInboxItem, InboxServiceError } from "@/modules/inbox/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = convertInboxItemSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid conversion payload", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const result = await convertInboxItem(
      session.user.id,
      workspace.id,
      id,
      parsed.data
    );
    return apiOk(result);
  } catch (error) {
    if (error instanceof InboxServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to convert inbox item");
  }
}
