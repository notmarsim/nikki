import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import { activityLogs, onboardingStates, taskDependencies, tasks } from "@/db/schema";

export async function getRecoveryAnalysis(userId: string, workspaceId: string, inactivityThresholdDays = 3) {
  const now = new Date();
  return withUserRls(userId, async (tx) => {
    const [openTasks, deps, allTasks, recentActivity, onboarding] = await Promise.all([
      tx
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.workspaceId, workspaceId),
            isNull(tasks.archivedAt),
            isNull(tasks.deletedAt),
            ne(tasks.status, "done"),
            ne(tasks.status, "cancelled")
          )
        ),
      tx.select().from(taskDependencies).where(eq(taskDependencies.userId, userId)),
      tx
        .select({ id: tasks.id, title: tasks.title, status: tasks.status })
        .from(tasks)
        .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt))),
      tx
        .select({ createdAt: activityLogs.createdAt })
        .from(activityLogs)
        .where(eq(activityLogs.userId, userId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(1),
      tx
        .select({ recoveryDismissedUntil: onboardingStates.recoveryDismissedUntil })
        .from(onboardingStates)
        .where(eq(onboardingStates.userId, userId))
        .limit(1),
    ]);

    const taskMap = new Map(allTasks.map((t) => [t.id, t]));
    const overdue = openTasks.filter((t) => t.dueAt && t.dueAt.getTime() < now.getTime());

    const lastActivityAt = recentActivity[0]?.createdAt ?? null;
    const daysInactive = lastActivityAt
      ? Math.floor((now.getTime() - lastActivityAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const dismissedUntil = onboarding[0]?.recoveryDismissedUntil;
    const isDismissed = Boolean(dismissedUntil && dismissedUntil.getTime() > now.getTime());

    const enrichedOverdue = overdue.map((t) => {
      const blockedBy = deps
        .filter((d) => d.taskId === t.id)
        .map((d) => taskMap.get(d.dependsOnTaskId))
        .filter((p) => p && p.status !== "done")
        .map((p) => p!.title);
      return {
        id: t.id,
        title: t.title,
        priority: t.priority,
        dueAt: t.dueAt,
        isUrgent: t.priority === "urgent" || t.priority === "high",
        isBlocked: blockedBy.length > 0,
        blockedBy,
      };
    });

    const needsRecovery =
      !isDismissed && (overdue.length >= 2 || daysInactive >= inactivityThresholdDays);

    return {
      needsRecovery,
      isDismissed,
      daysInactive,
      overdueCount: enrichedOverdue.length,
      urgentTasks: enrichedOverdue.filter((t) => t.isUrgent && !t.isBlocked),
      blockedTasks: enrichedOverdue.filter((t) => t.isBlocked),
      otherOverdueTasks: enrichedOverdue.filter((t) => !t.isUrgent && !t.isBlocked),
    };
  });
}

export async function applyRecoveryBatch(
  userId: string,
  actions: Array<{
    taskId: string;
    decision: "reschedule" | "complete" | "cancel" | "keep";
    newDueAt?: string;
  }>
) {
  const now = new Date();
  return withUserRls(userId, async (tx) => {
    let updatedCount = 0;
    for (const act of actions) {
      if (act.decision === "keep") continue;
      if (act.decision === "complete") {
        await tx
          .update(tasks)
          .set({ status: "done", completedAt: now, updatedAt: now })
          .where(and(eq(tasks.id, act.taskId), eq(tasks.userId, userId), isNull(tasks.archivedAt)));
        updatedCount++;
      } else if (act.decision === "cancel") {
        await tx
          .update(tasks)
          .set({ status: "cancelled", updatedAt: now })
          .where(and(eq(tasks.id, act.taskId), eq(tasks.userId, userId), isNull(tasks.archivedAt)));
        updatedCount++;
      } else if (act.decision === "reschedule" && act.newDueAt) {
        await tx
          .update(tasks)
          .set({ dueAt: new Date(act.newDueAt), updatedAt: now })
          .where(and(eq(tasks.id, act.taskId), eq(tasks.userId, userId), isNull(tasks.archivedAt)));
        updatedCount++;
      }
    }
    return { updatedCount };
  });
}

export async function dismissRecoveryPrompt(userId: string, hours = 24) {
  const until = new Date(Date.now() + hours * 60 * 60 * 1000);
  return withUserRls(userId, async (tx) => {
    await tx
      .insert(onboardingStates)
      .values({ userId, recoveryDismissedUntil: until })
      .onConflictDoUpdate({
        target: onboardingStates.userId,
        set: { recoveryDismissedUntil: until, updatedAt: new Date() },
      });
    return { dismissedUntil: until.toISOString() };
  });
}
