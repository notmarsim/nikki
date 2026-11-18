import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { updateLessonSchema } from "@/modules/learning/schemas";
import { LearningServiceError, updateLesson } from "@/modules/learning/service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = updateLessonSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid lesson update", parsed.error.flatten().fieldErrors);
  }

  try {
    const lesson = await updateLesson(session.user.id, id, parsed.data);
    return apiOk({ lesson });
  } catch (error) {
    if (error instanceof LearningServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to update lesson");
  }
}
