import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  createSharedSpace,
  getSpaceDetails,
  listUserSpaces,
  moveResourceToSpace,
  removeSpaceMember,
  SpaceServiceError,
} from "@/modules/spaces/service";

const createSpaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const moveSchema = z.object({
  action: z.literal("move"),
  entityType: z.enum(["note", "task", "project"]),
  entityId: z.string().uuid(),
  targetWorkspaceId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const spaceId = new URL(request.url).searchParams.get("spaceId");
  try {
    if (spaceId) {
      const details = await getSpaceDetails(session.user.id, spaceId);
      return apiOk(details);
    }
    const data = await listUserSpaces(session.user.id);
    return apiOk(data);
  } catch (error) {
    if (error instanceof SpaceServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to load spaces");
  }
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  if (typeof body === "object" && body !== null && "action" in body && (body as { action?: string }).action === "move") {
    const parsedMove = moveSchema.safeParse(body);
    if (!parsedMove.success) {
      return apiError(400, "VALIDATION_ERROR", "Invalid move payload");
    }
    try {
      const moved = await moveResourceToSpace(session.user.id, parsedMove.data);
      return apiOk({ moved });
    } catch (error) {
      if (error instanceof SpaceServiceError) {
        return apiError(error.status, error.code, error.message);
      }
      return apiError(500, "INTERNAL_ERROR", "Failed to move resource");
    }
  }

  const parsed = createSpaceSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid space", parsed.error.flatten().fieldErrors);
  }

  const space = await createSharedSpace(session.user.id, parsed.data);
  return apiOk({ space }, 201);
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { searchParams } = new URL(request.url);
  const spaceId = searchParams.get("spaceId");
  const userId = searchParams.get("userId");
  if (!spaceId || !userId) {
    return apiError(400, "VALIDATION_ERROR", "spaceId and userId are required");
  }

  try {
    const res = await removeSpaceMember(session.user.id, spaceId, userId);
    return apiOk(res);
  } catch (error) {
    if (error instanceof SpaceServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to remove member");
  }
}
