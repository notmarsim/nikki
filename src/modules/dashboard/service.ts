import { and, desc, eq, isNull } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import { activityLogs, inboxItems, notes, projects, tasks } from "@/db/schema";

export async function getDashboardData(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    const [allTasks, activeProjectRows, recentNoteRows, pendingInboxRows, activityRows] =
      await Promise.all([
        tx
          .select()
          .from(tasks)
          .where(and(eq(tasks.userId, userId), eq(tasks.workspaceId, workspaceId)))
          .orderBy(desc(tasks.updatedAt)),
        tx
          .select()
          .from(projects)
          .where(
            and(
              eq(projects.userId, userId),
              eq(projects.workspaceId, workspaceId),
              eq(projects.status, "active")
            )
          )
          .orderBy(desc(projects.updatedAt))
          .limit(6),
        tx
          .select({
            id: notes.id,
            title: notes.title,
            icon: notes.icon,
            updatedAt: notes.updatedAt,
            projectId: notes.projectId,
          })
          .from(notes)
          .where(
            and(
              eq(notes.userId, userId),
              eq(notes.workspaceId, workspaceId),
              eq(notes.isArchived, false),
              isNull(notes.deletedAt)
            )
          )
          .orderBy(desc(notes.updatedAt))
          .limit(6),
        tx
          .select({ id: inboxItems.id })
          .from(inboxItems)
          .where(
            and(
              eq(inboxItems.userId, userId),
              eq(inboxItems.workspaceId, workspaceId),
              eq(inboxItems.status, "pending")
            )
          ),
        tx
          .select()
          .from(activityLogs)
          .where(
            and(
              eq(activityLogs.userId, userId),
              eq(activityLogs.workspaceId, workspaceId)
            )
          )
          .orderBy(desc(activityLogs.createdAt))
          .limit(10),
      ]);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const tasksToday = allTasks.filter((t) => {
      if (!t.dueAt) return false;
      const due = new Date(t.dueAt);
      return due >= startOfToday && due <= endOfToday;
    });

    const overdueTasks = allTasks.filter((t) => {
      if (!t.dueAt) return false;
      if (t.status === "done" || t.status === "cancelled") return false;
      return new Date(t.dueAt) < startOfToday;
    });

    const completedTodayCount = tasksToday.filter((t) => t.status === "done").length;
    const pendingTodayCount = tasksToday.filter(
      (t) => t.status !== "done" && t.status !== "cancelled"
    ).length;

    const activeProjectsWithCounts = activeProjectRows.map((p) => {
      const projTasks = allTasks.filter(
        (t) => t.projectId === p.id && t.parentTaskId === null && t.status !== "cancelled"
      );
      return {
        ...p,
        totalTasks: projTasks.length,
        completedTasks: projTasks.filter((t) => t.status === "done").length,
      };
    });

    return {
      overview: {
        totalNotes: recentNoteRows.length,
        totalTasks: allTasks.length,
        openTasks: allTasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length,
        activeProjects: activeProjectRows.length,
        pendingInbox: pendingInboxRows.length,
      },
      tasksToday: {
        total: tasksToday.length,
        completed: completedTodayCount,
        pending: pendingTodayCount,
        overdue: overdueTasks.length,
        items: [...overdueTasks, ...tasksToday].slice(0, 8),
      },
      activeProjects: activeProjectsWithCounts,
      recentNotes: recentNoteRows,
      recentActivity: activityRows,
    };
  });
}
