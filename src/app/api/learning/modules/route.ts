import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createModuleSchema } from "@/modules/learning/schemas";
import { createCourseModule, LearningServiceError } from "@/modules/learning/service";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createModuleSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid module", parsed.error.flatten().fieldErrors);
  }

  try {
    const courseModule = await createCourseModule(session.user.id, parsed.data);
    return apiOk({ module: courseModule }, 201);
  } catch (error) {
    if (error instanceof LearningServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to create module");
  }
}
