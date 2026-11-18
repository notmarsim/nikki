import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { updateBookmarkSchema } from "@/modules/bookmarks/schemas";
import {
  BookmarkServiceError,
  deleteBookmark,
  updateBookmark,
} from "@/modules/bookmarks/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = updateBookmarkSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid bookmark update", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const bookmark = await updateBookmark(session.user.id, workspace.id, id, parsed.data);
    return apiOk({ bookmark });
  } catch (error) {
    if (error instanceof BookmarkServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to update bookmark");
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
    const deleted = await deleteBookmark(session.user.id, id);
    return apiOk({ deleted });
  } catch (error) {
    if (error instanceof BookmarkServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to delete bookmark");
  }
}
