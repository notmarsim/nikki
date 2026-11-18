import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createLessonSchema } from "@/modules/learning/schemas";
import { createLesson, LearningServiceError } from "@/modules/learning/service";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createLessonSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid lesson", parsed.error.flatten().fieldErrors);
  }

  try {
    const lesson = await createLesson(session.user.id, parsed.data);
    return apiOk({ lesson }, 201);
  } catch (error) {
    if (error instanceof LearningServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to create lesson");
  }
}
