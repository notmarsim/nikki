import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  analyticsSavedReports,
  courses,
  flashcardReviews,
  flashcards,
  focusSessions,
  habitEntries,
  habits,
  learningResourceLinks,
  learningReviews,
  lessons,
  noteLinks,
  notes,
  projects,
  quizAttempts,
  studySessions,
  tasks,
} from "@/db/schema";
import { getFinanceOverview } from "@/modules/finances/service";
import {
  computeDeltaPercent,
  computePeriodRange,
  type AnalyticsPeriod,
} from "./utils";

export const ALLOWED_REPORT_MODULES = [
  "tasks",
  "focus",
  "learning",
  "flashcards",
  "habits",
  "finances",
] as const;

export async function getAnalyticsOverview(params: {
  userId: string;
  workspaceId: string;
  period?: AnalyticsPeriod;
  includeFinances?: boolean;
}) {
  const period = params.period ?? "30d";
  const { start, end, prevStart, prevEnd, daysCount } = computePeriodRange(period);
  const startDateStr = start.toISOString().slice(0, 10);
  const endDateStr = end.toISOString().slice(0, 10);

  const core = await withUserRls(params.userId, async (tx) => {
    const [
      allTasks,
      allProjects,
      allCourses,
      allLessons,
      allCards,
      reviewRows,
      focusRows,
      habitRows,
      habitEntryRows,
      savedReports,
      allNotes,
      learningLinks,
      learningReviewRows,
      noteLinkRows,
      studySessionRows,
      quizAttemptRows,
    ] = await Promise.all([
      tx
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, params.userId),
            eq(tasks.workspaceId, params.workspaceId),
            isNull(tasks.deletedAt)
          )
        ),
      tx
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.userId, params.userId),
            eq(projects.workspaceId, params.workspaceId),
            isNull(projects.deletedAt)
          )
        ),
      tx
        .select()
        .from(courses)
        .where(
          and(eq(courses.userId, params.userId), eq(courses.workspaceId, params.workspaceId))
        ),
      tx.select().from(lessons).where(eq(lessons.userId, params.userId)),
      tx.select().from(flashcards).where(eq(flashcards.userId, params.userId)),
      tx
        .select()
        .from(flashcardReviews)
        .where(
          and(
            eq(flashcardReviews.userId, params.userId),
            gte(flashcardReviews.reviewedAt, prevStart),
            lte(flashcardReviews.reviewedAt, end)
          )
        ),
      tx
        .select()
        .from(focusSessions)
        .where(
          and(
            eq(focusSessions.userId, params.userId),
            eq(focusSessions.workspaceId, params.workspaceId),
            gte(focusSessions.startedAt, prevStart),
            lte(focusSessions.startedAt, end)
          )
        ),
      tx
        .select()
        .from(habits)
        .where(and(eq(habits.userId, params.userId), eq(habits.workspaceId, params.workspaceId))),
      tx
        .select()
        .from(habitEntries)
        .where(
          and(
            eq(habitEntries.userId, params.userId),
            gte(habitEntries.entryDate, startDateStr),
            lte(habitEntries.entryDate, endDateStr)
          )
        ),
      tx
        .select()
        .from(analyticsSavedReports)
        .where(
          and(
            eq(analyticsSavedReports.userId, params.userId),
            eq(analyticsSavedReports.workspaceId, params.workspaceId)
          )
        )
        .orderBy(desc(analyticsSavedReports.isFavorite), desc(analyticsSavedReports.updatedAt)),
      tx
        .select({ id: notes.id })
        .from(notes)
        .where(
          and(
            eq(notes.userId, params.userId),
            eq(notes.workspaceId, params.workspaceId),
            isNull(notes.deletedAt)
          )
        ),
      tx
        .select({ noteId: learningResourceLinks.noteId })
        .from(learningResourceLinks)
        .where(eq(learningResourceLinks.userId, params.userId)),
      tx
        .select({ id: learningReviews.id, lastReviewedAt: learningReviews.lastReviewedAt })
        .from(learningReviews)
        .where(eq(learningReviews.userId, params.userId)),
      tx
        .select({ sourceNoteId: noteLinks.sourceNoteId, targetNoteId: noteLinks.targetNoteId })
        .from(noteLinks)
        .where(eq(noteLinks.userId, params.userId)),
      tx
        .select({ durationSeconds: studySessions.durationSeconds, courseId: studySessions.courseId })
        .from(studySessions)
        .where(and(eq(studySessions.userId, params.userId), eq(studySessions.workspaceId, params.workspaceId))),
      tx
        .select({ scorePercent: quizAttempts.scorePercent, passed: quizAttempts.passed })
        .from(quizAttempts)
        .where(eq(quizAttempts.userId, params.userId)),
    ]);

    // Productivity
    const createdInPeriod = allTasks.filter(
      (t) => t.createdAt >= start && t.createdAt <= end
    ).length;
    const completedInPeriod = allTasks.filter(
      (t) => t.completedAt && t.completedAt >= start && t.completedAt <= end
    ).length;
    const completedPrev = allTasks.filter(
      (t) => t.completedAt && t.completedAt >= prevStart && t.completedAt <= prevEnd
    ).length;
    const overdueTasks = allTasks.filter(
      (t) => t.dueAt && t.dueAt < start && t.status !== "done" && t.status !== "cancelled"
    ).length;

    const priorityCounts: Record<string, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    };
    for (const t of allTasks) {
      priorityCounts[t.priority] = (priorityCounts[t.priority] ?? 0) + 1;
    }

    // Projects & inactivity check (>= 14 days without update)
    const fourteenDaysAgo = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);
    const inactiveProjects = allProjects
      .filter((p) => p.status === "active" && p.updatedAt < fourteenDaysAgo)
      .map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt }));

    // Focus
    const currentFocus = focusRows.filter(
      (f) => f.startedAt >= start && f.startedAt <= end
    );
    const prevFocus = focusRows.filter(
      (f) => f.startedAt >= prevStart && f.startedAt <= prevEnd
    );
    const focusMinutes = Math.round(
      currentFocus.reduce((s, f) => s + f.actualDurationSeconds, 0) / 60
    );
    const prevFocusMinutes = Math.round(
      prevFocus.reduce((s, f) => s + f.actualDurationSeconds, 0) / 60
    );

    const focusByDayMap = new Map<string, number>();
    for (const f of currentFocus) {
      const day = f.startedAt.toISOString().slice(0, 10);
      focusByDayMap.set(
        day,
        (focusByDayMap.get(day) ?? 0) + Math.round(f.actualDurationSeconds / 60)
      );
    }

    // Learning
    const completedLessonsInPeriod = allLessons.filter(
      (l) => l.completedAt && l.completedAt >= start && l.completedAt <= end
    ).length;

    // Flashcards (FSRS real states: 0=New, 1=Learning, 2=Review, 3=Relearning)
    const currentReviews = reviewRows.filter(
      (r) => r.reviewedAt >= start && r.reviewedAt <= end
    );
    const passedReviews = currentReviews.filter((r) => r.rating >= 2).length;
    const retentionRate =
      currentReviews.length > 0
        ? Math.round((passedReviews / currentReviews.length) * 1000) / 10
        : null;

    const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const r of currentReviews) {
      ratingDist[r.rating] = (ratingDist[r.rating] ?? 0) + 1;
    }

    // Habits consistency respecting frequency
    const activeHabits = habitRows.filter((h) => h.status === "active");
    const entriesByHabit = new Map<string, number>();
    for (const e of habitEntryRows) {
      entriesByHabit.set(e.habitId, (entriesByHabit.get(e.habitId) ?? 0) + e.value);
    }
    const habitRates = activeHabits.map((h) => {
      const expectedPerPeriod =
        h.frequency === "weekly_count"
          ? Math.max(1, Math.round((daysCount / 7) * h.targetValue))
          : h.frequency === "monthly_count"
            ? Math.max(1, Math.round((daysCount / 30) * h.targetValue))
            : daysCount * h.targetValue;
      const done = entriesByHabit.get(h.id) ?? 0;
      return Math.min(100, Math.round((done / expectedPerPeriod) * 100));
    });
    const avgHabitConsistency =
      habitRates.length > 0
        ? Math.round(habitRates.reduce((a, b) => a + b, 0) / habitRates.length)
        : 0;

    return {
      period,
      range: { start: startDateStr, end: endDateStr, daysCount },
      kpis: {
        tasksCompleted: completedInPeriod,
        tasksCompletedDelta: computeDeltaPercent(completedInPeriod, completedPrev),
        tasksCreated: createdInPeriod,
        overdueTasks,
        focusMinutes,
        focusMinutesDelta: computeDeltaPercent(focusMinutes, prevFocusMinutes),
        focusSessionsCount: currentFocus.length,
        activeCourses: allCourses.filter((c) => c.status === "active").length,
        completedLessons: completedLessonsInPeriod,
        flashcardReviews: currentReviews.length,
        flashcardRetention: retentionRate,
        activeHabits: activeHabits.length,
        habitConsistency: avgHabitConsistency,
      },
      productivity: {
        totalTasks: allTasks.length,
        priorityCounts,
        activeProjects: allProjects.filter((p) => p.status === "active").length,
        inactiveProjects,
      },
      flashcards: {
        totalCards: allCards.length,
        newCards: allCards.filter((c) => c.fsrsState === 0).length,
        learningCards: allCards.filter((c) => c.fsrsState === 1 || c.fsrsState === 3).length,
        reviewCards: allCards.filter((c) => c.fsrsState === 2).length,
        dueNow: allCards.filter((c) => c.dueAt <= end).length,
        ratingDistribution: ratingDist,
      },
      focusByDay: Array.from(focusByDayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, minutes]) => ({ date, minutes })),
      knowledgeStats: {
        totalNotes: allNotes.length,
        linkedToLearningCount: new Set(learningLinks.map((l) => l.noteId).filter(Boolean)).size,
        reviewedNotesCount: learningReviewRows.filter((r) => Boolean(r.lastReviewedAt)).length,
        isolatedNotesCount: (() => {
          const connected = new Set<string>();
          for (const nl of noteLinkRows) {
            connected.add(nl.sourceNoteId);
            connected.add(nl.targetNoteId);
          }
          for (const ll of learningLinks) {
            if (ll.noteId) connected.add(ll.noteId);
          }
          return allNotes.filter((n) => !connected.has(n.id)).length;
        })(),
        studySessionsCount: studySessionRows.length,
        studySessionMinutes: Math.round(
          studySessionRows.reduce((acc, s) => acc + s.durationSeconds, 0) / 60
        ),
        quizAttemptsCount: quizAttemptRows.length,
        avgQuizScorePercent:
          quizAttemptRows.length > 0
            ? Math.round(
                quizAttemptRows.reduce((acc, a) => acc + a.scorePercent, 0) /
                  quizAttemptRows.length
              )
            : null,
      },
      savedReports,
    };
  });

  const finances =
    params.includeFinances !== false
      ? await getFinanceOverview({
          userId: params.userId,
          workspaceId: params.workspaceId,
        })
      : null;

  return {
    ...core,
    finances: finances
      ? {
          month: finances.month,
          summary: finances.summary,
          expensesByCategory: finances.expensesByCategory,
        }
      : null,
  };
}

export async function createSavedReport(
  userId: string,
  workspaceId: string,
  input: {
    name: string;
    module: string;
    metric: string;
    groupBy: string;
    chartType: string;
    period: string;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(analyticsSavedReports)
      .values({
        userId,
        workspaceId,
        name: input.name,
        module: input.module,
        metric: input.metric,
        groupBy: input.groupBy,
        chartType: input.chartType,
        period: input.period,
      })
      .returning();
    return created!;
  });
}

export async function deleteSavedReport(userId: string, reportId: string) {
  return withUserRls(userId, async (tx) => {
    await tx
      .delete(analyticsSavedReports)
      .where(
        and(eq(analyticsSavedReports.id, reportId), eq(analyticsSavedReports.userId, userId))
      );
    return { deleted: true };
  });
}
