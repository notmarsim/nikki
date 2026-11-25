import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  createCourseFromNotes,
  createLessonFromNote,
} from "@/modules/learning/integration-service";
import { LearningServiceError } from "@/modules/learning/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const payloadSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("lesson"),
    noteId: z.string().uuid(),
    courseId: z.string().uuid().nullable().optional(),
    newCourseTitle: z.string().trim().max(160).optional(),
    moduleId: z.string().uuid().nullable().optional(),
    newModuleTitle: z.string().trim().max(160).optional(),
    lessonTitle: z.string().trim().min(1).max(200),
    description: z.string().max(1000).nullable().optional(),
    estimatedMinutes: z.number().int().min(1).max(1200).nullable().optional(),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    objectives: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
    prerequisites: z.array(z.string().trim().min(1).max(240)).max(20).optional(),
    resources: z
      .array(z.object({ title: z.string().trim().min(1), url: z.string().url() }))
      .max(20)
      .optional(),
  }),
  z.object({
    mode: z.literal("course"),
    title: z.string().trim().min(1).max(160),
    description: z.string().max(1000).nullable().optional(),
    category: z.string().max(80).nullable().optional(),
    modules: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(160),
          lessons: z
            .array(
              z.object({
                title: z.string().trim().min(1).max(200),
                noteIds: z.array(z.string().uuid()).default([]),
              })
            )
            .min(1),
        })
      )
      .min(1),
  }),
]);

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid payload", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    if (parsed.data.mode === "lesson") {
      const result = await createLessonFromNote(session.user.id, workspace.id, parsed.data);
      return apiOk(result, 201);
    }
    const course = await createCourseFromNotes(session.user.id, workspace.id, parsed.data);
    return apiOk({ course }, 201);
  } catch (err) {
    if (err instanceof LearningServiceError) {
      return apiError(err.status, err.code, err.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to create from note(s)");
  }
}
