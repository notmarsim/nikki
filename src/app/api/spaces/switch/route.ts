import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { SpaceServiceError, switchActiveSpace } from "@/modules/spaces/service";

const schema = z.object({
  workspaceId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Valid workspaceId required");
  }

  try {
    const res = await switchActiveSpace(session.user.id, parsed.data.workspaceId);
    return apiOk(res);
  } catch (error) {
    if (error instanceof SpaceServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to switch space");
  }
}
