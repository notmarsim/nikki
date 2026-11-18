import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { saveNodePositionSchema } from "@/modules/graph/schemas";
import {
  resetNodePositions,
  saveNodePosition,
  type GraphEntityType,
} from "@/modules/graph/service";

export async function PUT(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = saveNodePositionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid position", parsed.error.flatten().fieldErrors);
  }

  const saved = await saveNodePosition(session.user.id, {
    ...parsed.data,
    entityType: parsed.data.entityType as GraphEntityType,
  });
  return apiOk({ position: saved });
}

export async function DELETE() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const result = await resetNodePositions(session.user.id);
  return apiOk(result);
}
