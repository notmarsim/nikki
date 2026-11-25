import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  addLessonContent,
  deleteLessonContent,
  getLessonRichDetail,
  reorderCurriculum,
  updateLessonContent,
} from "@/modules/learning/integration-service";
import { LearningServiceError } from "@/modules/learning/service";

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add_content"),
    lessonId: z.string().uuid(),
    contentType: z.enum([
      "note",
      "text",
      "video",
      "external_link",
      "document",
      "image",
      "code_snippet",
      "exercise",
      "flashcard_deck",
      "quiz",
      "checklist",
    ]),
    title: z.string().trim().min(1).max(200),
    body: z.string().max(10000).nullable().optional(),
    url: z.string().max(2000).nullable().optional(),
    noteId: z.string().uuid().nullable().optional(),
    deckId: z.string().uuid().nullable().optional(),
    quizId: z.string().uuid().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    isRequired: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("reorder"),
    kind: z.enum(["modules", "lessons"]),
    orderedIds: z.array(z.string().uuid()).min(1),
  }),
]);

const patchSchema = z.object({
  id: z.string().uuid(),
  isCompleted: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().max(10000).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const lessonId = new URL(request.url).searchParams.get("lessonId");
  if (!lessonId) return apiError(400, "VALIDATION_ERROR", "lessonId is required");

  try {
    const detail = await getLessonRichDetail(session.user.id, lessonId);
    return apiOk(detail);
  } catch (err) {
    if (err instanceof LearningServiceError) {
      return apiError(err.status, err.code, err.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to load lesson detail");
  }
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid lesson content payload");
  }

  try {
    if (parsed.data.action === "reorder") {
      const res = await reorderCurriculum(session.user.id, parsed.data);
      return apiOk(res);
    }
    const content = await addLessonContent(session.user.id, parsed.data);
    return apiOk({ content }, 201);
  } catch (err) {
    if (err instanceof LearningServiceError) {
      return apiError(err.status, err.code, err.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to save lesson content");
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid content update");
  }

  try {
    const content = await updateLessonContent(session.user.id, parsed.data.id, parsed.data);
    return apiOk({ content });
  } catch (err) {
    if (err instanceof LearningServiceError) {
      return apiError(err.status, err.code, err.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to update lesson content");
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError(400, "VALIDATION_ERROR", "id is required");

  return apiOk(await deleteLessonContent(session.user.id, id));
}
