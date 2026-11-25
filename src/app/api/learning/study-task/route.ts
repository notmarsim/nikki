import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  createStudyTaskFromLearning,
  scheduleStudyOnCalendar,
} from "@/modules/learning/integration-service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("task"),
    title: z.string().trim().min(1).max(200),
    courseId: z.string().uuid().nullable().optional(),
    lessonId: z.string().uuid().nullable().optional(),
    noteId: z.string().uuid().nullable().optional(),
    dueAt: z.string().nullable().optional(),
    estimatedMinutes: z.number().int().min(5).max(480).nullable().optional(),
    autoCompleteLesson: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("calendar"),
    title: z.string().trim().min(1).max(200),
    startsAt: z.string().min(10),
    endsAt: z.string().min(10),
    recurrenceRule: z.string().max(120).nullable().optional(),
    courseId: z.string().uuid().nullable().optional(),
    lessonId: z.string().uuid().nullable().optional(),
    noteId: z.string().uuid().nullable().optional(),
  }),
]);

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid study integration payload");
  }

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  if (parsed.data.action === "task") {
    const task = await createStudyTaskFromLearning(session.user.id, workspace.id, parsed.data);
    return apiOk({ task }, 201);
  }
  const event = await scheduleStudyOnCalendar(session.user.id, workspace.id, parsed.data);
  return apiOk({ event }, 201);
}
