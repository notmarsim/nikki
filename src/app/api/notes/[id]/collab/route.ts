import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  applyCollabUpdate,
  CollabServiceError,
  createCollabSnapshot,
  getCollabDocumentState,
  restoreCollabSnapshot,
} from "@/modules/collab/service";

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    updateBase64: z.string().min(1).max(1_000_000),
  }),
  z.object({
    action: z.literal("snapshot"),
    label: z.string().trim().max(100).optional(),
  }),
  z.object({
    action: z.literal("restore"),
    snapshotId: z.string().uuid(),
  }),
]);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  try {
    const data = await getCollabDocumentState(session.user.id, id);
    return apiOk(data);
  } catch (error) {
    if (error instanceof CollabServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to load collaborative state");
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid collaborative operation");
  }

  try {
    if (parsed.data.action === "update") {
      const res = await applyCollabUpdate(session.user.id, id, parsed.data.updateBase64);
      return apiOk(res);
    }
    if (parsed.data.action === "snapshot") {
      const snapshot = await createCollabSnapshot(session.user.id, id, parsed.data.label);
      return apiOk({ snapshot }, 201);
    }
    const restored = await restoreCollabSnapshot(
      session.user.id,
      id,
      parsed.data.snapshotId
    );
    return apiOk(restored);
  } catch (error) {
    if (error instanceof CollabServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Collaborative operation failed");
  }
}
