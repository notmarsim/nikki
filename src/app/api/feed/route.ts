import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  addAndFetchFeedSource,
  deleteFeedSource,
  listFeedOverview,
  updateFeedEntryState,
} from "@/modules/feed/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const addSchema = z.object({
  url: z.string().trim().url(),
  category: z.string().trim().max(40).default("Tech"),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await listFeedOverview(session.user.id, workspace.id);
  return apiOk(data);
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Valid feed URL required");
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const source = await addAndFetchFeedSource(
      session.user.id,
      workspace.id,
      parsed.data.url,
      parsed.data.category
    );
    return apiOk({ source }, 201);
  } catch (error) {
    return apiError(
      400,
      "FEED_FETCH_ERROR",
      error instanceof Error ? error.message : "Failed to fetch feed"
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body = (await request.json()) as {
    entryId?: string;
    isRead?: boolean;
    isFavorite?: boolean;
  };
  if (!body.entryId) return apiError(400, "VALIDATION_ERROR", "entryId required");

  const entry = await updateFeedEntryState(session.user.id, body.entryId, {
    isRead: body.isRead,
    isFavorite: body.isFavorite,
  });
  return apiOk({ entry });
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError(400, "VALIDATION_ERROR", "id required");

  const res = await deleteFeedSource(session.user.id, id);
  return apiOk(res);
}
