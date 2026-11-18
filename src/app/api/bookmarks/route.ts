import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createBookmarkSchema } from "@/modules/bookmarks/schemas";
import {
  BookmarkServiceError,
  createBookmark,
  listBookmarks,
} from "@/modules/bookmarks/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { searchParams } = new URL(request.url);
  const workspace = await getOrCreateDefaultWorkspace(session.user.id);

  const data = await listBookmarks({
    userId: session.user.id,
    workspaceId: workspace.id,
    collectionId: searchParams.get("collectionId") ?? undefined,
    readingStatus: searchParams.get("readingStatus") ?? undefined,
    resourceType: searchParams.get("resourceType") ?? undefined,
    favoritesOnly: searchParams.get("favoritesOnly") === "true",
    readLater: searchParams.get("readLater") === "true",
    tag: searchParams.get("tag") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    sortBy: (searchParams.get("sortBy") as "created" | "updated" | "title" | "domain") ?? "updated",
    limit: Number(searchParams.get("limit") ?? "40"),
    offset: Number(searchParams.get("offset") ?? "0"),
  });

  return apiOk(data);
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createBookmarkSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid bookmark", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const bookmark = await createBookmark(session.user.id, workspace.id, parsed.data);
    return apiOk({ bookmark }, 201);
  } catch (error) {
    if (error instanceof BookmarkServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to create bookmark");
  }
}
