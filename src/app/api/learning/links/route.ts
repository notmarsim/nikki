import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  getNoteDeletionImpact,
  getNoteLinkedLearning,
  linkNoteToLearning,
  unlinkLearningResource,
} from "@/modules/learning/integration-service";
import { LearningServiceError, linkLearningResource } from "@/modules/learning/service";

const linkSchema = z.object({
  pathId: z.string().uuid().nullable().optional(),
  courseId: z.string().uuid().nullable().optional(),
  moduleId: z.string().uuid().nullable().optional(),
  lessonId: z.string().uuid().nullable().optional(),
  noteId: z.string().uuid().nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  purpose: z
    .enum([
      "main_content",
      "supplementary",
      "reference",
      "exercise",
      "summary",
      "personal_annotation",
    ])
    .optional(),
  isRequired: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { searchParams } = new URL(request.url);
  const noteId = searchParams.get("noteId");
  if (!noteId) return apiError(400, "VALIDATION_ERROR", "noteId is required");

  if (searchParams.get("impact") === "1") {
    const impact = await getNoteDeletionImpact(session.user.id, noteId);
    return apiOk(impact);
  }

  const links = await getNoteLinkedLearning(session.user.id, noteId);
  return apiOk({ links });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid resource link");
  }

  try {
    if (parsed.data.noteId) {
      const link = await linkNoteToLearning(session.user.id, {
        noteId: parsed.data.noteId,
        pathId: parsed.data.pathId,
        courseId: parsed.data.courseId,
        moduleId: parsed.data.moduleId,
        lessonId: parsed.data.lessonId,
        purpose: parsed.data.purpose,
        isRequired: parsed.data.isRequired,
      });
      return apiOk({ link }, 201);
    }

    const link = await linkLearningResource(session.user.id, parsed.data);
    return apiOk({ link }, 201);
  } catch (err) {
    if (err instanceof LearningServiceError) {
      return apiError(err.status, err.code, err.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to link resource");
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError(400, "VALIDATION_ERROR", "id is required");

  try {
    const res = await unlinkLearningResource(session.user.id, id);
    return apiOk(res);
  } catch (err) {
    if (err instanceof LearningServiceError) {
      return apiError(err.status, err.code, err.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to unlink resource");
  }
}
