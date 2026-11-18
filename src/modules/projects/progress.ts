import { and, eq } from "drizzle-orm";
import type { DbTransaction } from "@/db/rls";
import { projects, tasks } from "@/db/schema";

export function computeProjectProgress(
  projectTasks: Array<{ status: string; parentTaskId: string | null }>
): number {
  const topLevelActive = projectTasks.filter(
    (t) => t.parentTaskId === null && t.status !== "cancelled"
  );

  if (topLevelActive.length === 0) return 0;

  const completed = topLevelActive.filter((t) => t.status === "done").length;
  return Math.round((completed / topLevelActive.length) * 100);
}

export async function recalculateProjectProgressTx(
  tx: DbTransaction,
  userId: string,
  projectId: string | null | undefined
): Promise<number | null> {
  if (!projectId) return null;

  const projectTasks = await tx
    .select({ status: tasks.status, parentTaskId: tasks.parentTaskId })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.userId, userId)));

  const progress = computeProjectProgress(projectTasks);

  await tx
    .update(projects)
    .set({ progress, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  return progress;
}
