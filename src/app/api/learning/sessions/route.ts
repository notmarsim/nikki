import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { listStudySessions, recordStudySession } from "@/modules/learning/integration-service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const postSchema = z.object({
  courseId: z.string().uuid().nullable().optional(),
  moduleId: z.string().uuid().nullable().optional(),
  lessonId: z.string().uuid().nullable().optional(),
  noteId: z.string().uuid().nullable().optional(),
  durationSeconds: z.number().int().min(0).max(86400),
  lessonsCompleted: z.number().int().min(0).optional(),
  flashcardsReviewed: z.number().int().min(0).optional(),
  quizScorePercent: z.number().int().min(0).max(100).nullable().optional(),
  difficultyRating: z.enum(["easy", "medium", "hard"]).nullable().optional(),
  flaggedForReview: z.boolean().optional(),
  notesText: z.string().max(4000).nullable().optional(),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const sessions = await listStudySessions(session.user.id, workspace.id);
  return apiOk({ sessions });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid study session payload");
  }

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const studySession = await recordStudySession(session.user.id, workspace.id, parsed.data);
  return apiOk({ session: studySession }, 201);
}
