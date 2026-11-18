import { and, asc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { withUserRls } from "@/db/rls";
import { taskComments, tasks } from "@/db/schema";
import { apiError, apiOk } from "@/lib/api-response";
import { recordActivity } from "@/modules/activity/service";
import { getCurrentSession } from "@/modules/auth/session";

const createCommentSchema = z.object({
  content: z.string().trim().min(1, "Comment cannot be empty").max(5000),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id: taskId } = await context.params;

  const comments = await withUserRls(session.user.id, async (tx) => {
    const ownedTask = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id)))
      .limit(1);

    if (!ownedTask[0]) return null;

    return tx
      .select()
      .from(taskComments)
      .where(
        and(eq(taskComments.taskId, taskId), eq(taskComments.userId, session.user.id))
      )
      .orderBy(asc(taskComments.createdAt));
  });

  if (comments === null) {
    return apiError(404, "TASK_NOT_FOUND", "Task not found");
  }

  return apiOk({ comments });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id: taskId } = await context.params;
  const body: unknown = await request.json();
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid comment", parsed.error.flatten().fieldErrors);
  }

  const result = await withUserRls(session.user.id, async (tx) => {
    const ownedTask = await tx
      .select({ id: tasks.id, title: tasks.title, workspaceId: tasks.workspaceId })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id)))
      .limit(1);

    const task = ownedTask[0];
    if (!task) return null;

    const [created] = await tx
      .insert(taskComments)
      .values({
        userId: session.user.id,
        workspaceId: task.workspaceId,
        taskId,
        content: parsed.data.content,
      })
      .returning();

    return { created, task };
  });

  if (!result || !result.created) {
    return apiError(404, "TASK_NOT_FOUND", "Task not found");
  }

  await recordActivity({
    userId: session.user.id,
    workspaceId: result.task.workspaceId,
    entityType: "task",
    entityId: taskId,
    action: "task.commented",
    payload: { title: result.task.title },
  });

  return apiOk({ comment: result.created }, 201);
}
