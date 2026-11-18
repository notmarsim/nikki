import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createCollectionSchema } from "@/modules/bookmarks/schemas";
import {
  BookmarkServiceError,
  createCollection,
  listBookmarks,
} from "@/modules/bookmarks/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await listBookmarks({
    userId: session.user.id,
    workspaceId: workspace.id,
    limit: 1,
  });
  return apiOk({ collections: data.collections });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid collection", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const collection = await createCollection(session.user.id, workspace.id, parsed.data);
    return apiOk({ collection }, 201);
  } catch (error) {
    if (error instanceof BookmarkServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to create collection");
  }
}
