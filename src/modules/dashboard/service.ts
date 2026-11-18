import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  activityLogs,
  bookmarks,
  calendarEvents,
  developerSnippets,
  flashcardDecks,
  flashcards,
  focusSessions,
  habitEntries,
  habits,
  inboxItems,
  notes,
  projects,
  tasks,
} from "@/db/schema";

export async function getDashboardData(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const sevenDaysAhead = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
    const todayDateStr = now.toISOString().slice(0, 10);

    const [
      allTasks,
      activeProjectRows,
      recentNoteRows,
      pendingInboxRows,
      activityRows,
      upcomingEventRows,
      activeFocusRows,
      todayFocusRows,
      dueFlashcardRows,
      activeHabitRows,
      todayHabitEntryRows,
      recentBookmarkRows,
      favoriteSnippetRows,
    ] = await Promise.all([
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
      tx
        .select({
          id: calendarEvents.id,
          title: calendarEvents.title,
          startAt: calendarEvents.startsAt,
          endAt: calendarEvents.endsAt,
          allDay: calendarEvents.isAllDay,
          color: calendarEvents.color,
        })
        .from(calendarEvents)
        .where(
          and(
            eq(calendarEvents.userId, userId),
            eq(calendarEvents.workspaceId, workspaceId),
            gte(calendarEvents.endsAt, startOfToday),
            lte(calendarEvents.startsAt, sevenDaysAhead)
          )
        )
        .orderBy(asc(calendarEvents.startsAt))
        .limit(5),
      tx
        .select({
          id: focusSessions.id,
          mode: focusSessions.mode,
          status: focusSessions.status,
          startedAt: focusSessions.startedAt,
          elapsedSeconds: focusSessions.actualDurationSeconds,
        })
        .from(focusSessions)
        .where(
          and(
            eq(focusSessions.userId, userId),
            eq(focusSessions.workspaceId, workspaceId),
            inArray(focusSessions.status, ["running", "paused"])
          )
        )
        .limit(1),
      tx
        .select({
          elapsedSeconds: focusSessions.actualDurationSeconds,
        })
        .from(focusSessions)
        .where(
          and(
            eq(focusSessions.userId, userId),
            eq(focusSessions.workspaceId, workspaceId),
            gte(focusSessions.startedAt, startOfToday),
            lte(focusSessions.startedAt, endOfToday)
          )
        ),
      tx
        .select({ id: flashcards.id })
        .from(flashcards)
        .innerJoin(flashcardDecks, eq(flashcards.deckId, flashcardDecks.id))
        .where(
          and(
            eq(flashcards.userId, userId),
            eq(flashcardDecks.workspaceId, workspaceId),
            lte(flashcards.dueAt, now)
          )
        ),
      tx
        .select({
          id: habits.id,
          title: habits.title,
          targetValue: habits.targetValue,
        })
        .from(habits)
        .where(
          and(
            eq(habits.userId, userId),
            eq(habits.workspaceId, workspaceId),
            eq(habits.status, "active")
          )
        ),
      tx
        .select({
          habitId: habitEntries.habitId,
          value: habitEntries.value,
        })
        .from(habitEntries)
        .where(
          and(
            eq(habitEntries.userId, userId),
            eq(habitEntries.entryDate, todayDateStr)
          )
        ),
      tx
        .select({
          id: bookmarks.id,
          title: bookmarks.title,
          url: bookmarks.url,
          domain: bookmarks.domain,
          readingStatus: bookmarks.readingStatus,
        })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, userId),
            eq(bookmarks.workspaceId, workspaceId),
            isNull(bookmarks.archivedAt)
          )
        )
        .orderBy(desc(bookmarks.updatedAt))
        .limit(5),
      tx
        .select({
          id: developerSnippets.id,
          title: developerSnippets.title,
          language: developerSnippets.language,
          isFavorite: developerSnippets.isFavorite,
        })
        .from(developerSnippets)
        .where(
          and(
            eq(developerSnippets.userId, userId),
            eq(developerSnippets.workspaceId, workspaceId)
          )
        )
        .orderBy(desc(developerSnippets.isFavorite), desc(developerSnippets.updatedAt))
        .limit(5),
    ]);

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

    const studySecondsToday = todayFocusRows.reduce(
      (sum, row) => sum + (row.elapsedSeconds ?? 0),
      0
    );
    const habitTotals = new Map<string, number>();
    for (const entry of todayHabitEntryRows) {
      habitTotals.set(entry.habitId, (habitTotals.get(entry.habitId) ?? 0) + entry.value);
    }
    const habitsCompletedToday = activeHabitRows.filter(
      (h) => (habitTotals.get(h.id) ?? 0) >= h.targetValue
    ).length;

    return {
      overview: {
        totalNotes: recentNoteRows.length,
        totalTasks: allTasks.length,
        openTasks: allTasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length,
        activeProjects: activeProjectRows.length,
        pendingInbox: pendingInboxRows.length,
        flashcardsDue: dueFlashcardRows.length,
        studyMinutesToday: Math.round(studySecondsToday / 60),
        habitsCompletedToday,
        habitsTotal: activeHabitRows.length,
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
      upcomingEvents: upcomingEventRows,
      activeFocus: activeFocusRows[0] ?? null,
      recentBookmarks: recentBookmarkRows,
      favoriteSnippets: favoriteSnippetRows,
    };
  });
}
