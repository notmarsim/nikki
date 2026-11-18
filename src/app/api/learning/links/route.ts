import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { linkLearningResourceSchema } from "@/modules/learning/schemas";
import { linkLearningResource } from "@/modules/learning/service";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = linkLearningResourceSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid resource link");
  }

  const link = await linkLearningResource(session.user.id, parsed.data);
  return apiOk({ link }, 201);
}
