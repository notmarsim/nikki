import { and, asc, eq, gte, ne } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import { calendarEvents, focusSessions, habits, tasks } from "@/db/schema";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const now = new Date();

  const snapshot = await withUserRls(session.user.id, async (tx) => {
    const [openTasks, activeHabits, upcomingEvents, activeFocus] = await Promise.all([
      tx
        .select({ id: tasks.id, title: tasks.title, status: tasks.status })
        .from(tasks)
        .where(
          and(
            eq(tasks.workspaceId, workspace.id),
            ne(tasks.status, "done")
          )
        )
        .limit(5),
      tx
        .select({ id: habits.id, title: habits.title })
        .from(habits)
        .where(and(eq(habits.workspaceId, workspace.id), eq(habits.status, "active")))
        .limit(5),
      tx
        .select({
          id: calendarEvents.id,
          title: calendarEvents.title,
          startsAt: calendarEvents.startsAt,
        })
        .from(calendarEvents)
        .where(
          and(
            eq(calendarEvents.workspaceId, workspace.id),
            gte(calendarEvents.startsAt, now)
          )
        )
        .orderBy(asc(calendarEvents.startsAt))
        .limit(3),
      tx
        .select({
          id: focusSessions.id,
          mode: focusSessions.mode,
          startedAt: focusSessions.startedAt,
        })
        .from(focusSessions)
        .where(
          and(
            eq(focusSessions.workspaceId, workspace.id),
            eq(focusSessions.status, "running")
          )
        )
        .limit(1),
    ]);

    return {
      generatedAt: now.toISOString(),
      workspaceName: workspace.name,
      openTasksCount: openTasks.length,
      topTasks: openTasks,
      activeHabitsCount: activeHabits.length,
      upcomingEvents: upcomingEvents.map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: e.startsAt.toISOString(),
      })),
      activeFocus: activeFocus[0]
        ? {
            id: activeFocus[0].id,
            mode: activeFocus[0].mode,
            startedAt: activeFocus[0].startedAt.toISOString(),
          }
        : null,
    };
  });

  return apiOk(snapshot);
}
