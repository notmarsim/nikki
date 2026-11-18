import { and, desc, eq, ne } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import { lifeAreas, lifeGoals, tasks } from "@/db/schema";

export async function getGoalsOverview(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    const [areas, goals, userTasks] = await Promise.all([
      tx
        .select()
        .from(lifeAreas)
        .where(and(eq(lifeAreas.userId, userId), eq(lifeAreas.workspaceId, workspaceId))),
      tx
        .select()
        .from(lifeGoals)
        .where(and(eq(lifeGoals.userId, userId), eq(lifeGoals.workspaceId, workspaceId)))
        .orderBy(desc(lifeGoals.updatedAt)),
      tx
        .select({ status: tasks.status })
        .from(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.workspaceId, workspaceId))),
    ]);

    const doneTasks = userTasks.filter((t) => t.status === "done").length;

    const enrichedGoals = goals.map((g) => {
      const effectiveCurrent = g.metricSource === "tasks" ? doneTasks : g.currentValue;
      const progress =
        g.targetValue > 0
          ? Math.min(100, Math.round((effectiveCurrent / g.targetValue) * 100))
          : 0;
      return { ...g, effectiveCurrent, progress };
    });

    return { areas, goals: enrichedGoals };
  });
}

export async function createLifeArea(
  userId: string,
  workspaceId: string,
  input: { name: string; color?: string }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(lifeAreas)
      .values({
        userId,
        workspaceId,
        name: input.name,
        color: input.color ?? "#3b82f6",
      })
      .returning();
    return created!;
  });
}

export async function createLifeGoal(
  userId: string,
  workspaceId: string,
  input: {
    title: string;
    description?: string | null;
    areaId?: string | null;
    parentGoalId?: string | null;
    horizon?: string;
    metricSource?: string;
    targetValue?: number;
    unit?: string;
    targetDate?: string | null;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(lifeGoals)
      .values({
        userId,
        workspaceId,
        areaId: input.areaId ?? null,
        parentGoalId: input.parentGoalId ?? null,
        title: input.title,
        description: input.description ?? null,
        horizon: input.horizon ?? "quarterly",
        metricSource: input.metricSource ?? "manual",
        targetValue: input.targetValue ?? 100,
        unit: input.unit ?? "%",
        targetDate: input.targetDate ?? null,
      })
      .returning();
    return created!;
  });
}

export async function updateLifeGoalProgress(
  userId: string,
  goalId: string,
  currentValue: number
) {
  return withUserRls(userId, async (tx) => {
    const [goal] = await tx
      .select()
      .from(lifeGoals)
      .where(and(eq(lifeGoals.id, goalId), eq(lifeGoals.userId, userId)))
      .limit(1);
    if (!goal) throw new Error("Goal not found");

    const nextStatus = currentValue >= goal.targetValue ? "completed" : "active";
    const [updated] = await tx
      .update(lifeGoals)
      .set({ currentValue, status: nextStatus, updatedAt: new Date() })
      .where(eq(lifeGoals.id, goalId))
      .returning();
    return updated!;
  });
}

export async function deleteLifeGoal(userId: string, goalId: string) {
  return withUserRls(userId, async (tx) => {
    await tx
      .update(lifeGoals)
      .set({ parentGoalId: null })
      .where(and(eq(lifeGoals.parentGoalId, goalId), ne(lifeGoals.id, goalId)));
    await tx
      .delete(lifeGoals)
      .where(and(eq(lifeGoals.id, goalId), eq(lifeGoals.userId, userId)));
    return { deleted: true };
  });
}
