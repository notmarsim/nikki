import { and, eq, inArray, isNull } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import { taskDependencies, tasks } from "@/db/schema";

export class DependencyCycleError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function detectDependencyCycle(
  edges: Array<{ taskId: string; dependsOnTaskId: string }>,
  newTaskId: string,
  newDependsOnTaskId: string
): boolean {
  if (newTaskId === newDependsOnTaskId) return true;
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.taskId) ?? [];
    list.push(e.dependsOnTaskId);
    adj.set(e.taskId, list);
  }
  const existing = adj.get(newTaskId) ?? [];
  adj.set(newTaskId, [...existing, newDependsOnTaskId]);

  // If newDependsOnTaskId can reach newTaskId, adding newTaskId -> newDependsOnTaskId creates a cycle
  const visited = new Set<string>();
  const stack = [newDependsOnTaskId];
  while (stack.length > 0) {
    const curr = stack.pop()!;
    if (curr === newTaskId) return true;
    if (visited.has(curr)) continue;
    visited.add(curr);
    for (const next of adj.get(curr) ?? []) {
      stack.push(next);
    }
  }
  return false;
}

export async function getTaskDependencies(userId: string, taskId: string) {
  return withUserRls(userId, async (tx) => {
    const [predecessorLinks, dependentLinks] = await Promise.all([
      tx
        .select({
          linkId: taskDependencies.id,
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          dueAt: tasks.dueAt,
          archivedAt: tasks.archivedAt,
        })
        .from(taskDependencies)
        .innerJoin(tasks, eq(taskDependencies.dependsOnTaskId, tasks.id))
        .where(and(eq(taskDependencies.userId, userId), eq(taskDependencies.taskId, taskId), isNull(tasks.deletedAt))),
      tx
        .select({
          linkId: taskDependencies.id,
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
        })
        .from(taskDependencies)
        .innerJoin(tasks, eq(taskDependencies.taskId, tasks.id))
        .where(and(eq(taskDependencies.userId, userId), eq(taskDependencies.dependsOnTaskId, taskId), isNull(tasks.deletedAt))),
    ]);

    // Archived tasks that were completed (status === 'done') continue to count as fulfilled predecessors
    const unfinishedPredecessors = predecessorLinks.filter((p) => p.status !== "done");
    return {
      predecessors: predecessorLinks,
      dependents: dependentLinks,
      isBlocked: unfinishedPredecessors.length > 0,
      blockingReason:
        unfinishedPredecessors.length > 0
          ? `Waiting on: ${unfinishedPredecessors.map((p) => p.title).join(", ")}`
          : null,
    };
  });
}

export async function addTaskDependency(
  userId: string,
  taskId: string,
  dependsOnTaskId: string
) {
  return withUserRls(userId, async (tx) => {
    const existingTasks = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), inArray(tasks.id, [taskId, dependsOnTaskId]), isNull(tasks.deletedAt)));

    if (existingTasks.length < 2 && taskId !== dependsOnTaskId) {
      throw new Error("Both tasks must exist in your workspace.");
    }

    const allEdges = await tx
      .select({
        taskId: taskDependencies.taskId,
        dependsOnTaskId: taskDependencies.dependsOnTaskId,
      })
      .from(taskDependencies)
      .where(eq(taskDependencies.userId, userId));

    if (detectDependencyCycle(allEdges, taskId, dependsOnTaskId)) {
      throw new DependencyCycleError(
        "Cannot add dependency: this would create a circular dependency cycle."
      );
    }

    const [created] = await tx
      .insert(taskDependencies)
      .values({ userId, taskId, dependsOnTaskId })
      .onConflictDoNothing()
      .returning();

    return created ?? null;
  });
}

export async function removeTaskDependency(userId: string, taskId: string, dependsOnTaskId: string) {
  return withUserRls(userId, async (tx) => {
    await tx
      .delete(taskDependencies)
      .where(
        and(
          eq(taskDependencies.userId, userId),
          eq(taskDependencies.taskId, taskId),
          eq(taskDependencies.dependsOnTaskId, dependsOnTaskId)
        )
      );
    return { removed: true };
  });
}
