import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { updateCollectionSchema } from "@/modules/bookmarks/schemas";
import {
  BookmarkServiceError,
  deleteCollection,
  updateCollection,
} from "@/modules/bookmarks/service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = updateCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid collection update", parsed.error.flatten().fieldErrors);
  }

  try {
    const collection = await updateCollection(session.user.id, id, parsed.data);
    return apiOk({ collection });
  } catch (error) {
    if (error instanceof BookmarkServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to update collection");
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
    const deleted = await deleteCollection(session.user.id, id);
    return apiOk({ deleted });
  } catch (error) {
    if (error instanceof BookmarkServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to delete collection");
  }
}
