import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { updateInboxItemSchema } from "@/modules/inbox/schemas";
import {
  deleteInboxItem,
  InboxServiceError,
  updateInboxItem,
} from "@/modules/inbox/service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = updateInboxItemSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid inbox update", parsed.error.flatten().fieldErrors);
  }

  try {
    const item = await updateInboxItem(session.user.id, id, parsed.data);
    return apiOk({ item });
  } catch (error) {
    if (error instanceof InboxServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to update inbox item");
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
    await deleteInboxItem(session.user.id, id);
    return apiOk({ deleted: true });
  } catch (error) {
    if (error instanceof InboxServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to delete inbox item");
  }
}
