import { and, desc, eq, gte } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  flashcardReviews,
  focusSessions,
  habitActivityLinks,
  habitEntries,
  habits,
  lessons,
  type HabitScheduleConfig,
} from "@/db/schema";
import { computeHabitStreaks, isDateScheduledForHabit } from "./utils";

export class HabitServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export async function getHabitsOverview(
  userId: string,
  workspaceId: string,
  todayStr: string
) {
  return withUserRls(userId, async (tx) => {
    const [habitRows, entryRows, linkRows] = await Promise.all([
      tx
        .select()
        .from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.workspaceId, workspaceId)))
        .orderBy(desc(habits.createdAt)),
      tx.select().from(habitEntries).where(eq(habitEntries.userId, userId)),
      tx.select().from(habitActivityLinks).where(eq(habitActivityLinks.userId, userId)),
    ]);

    const hasFocusLink = linkRows.some((l) => l.activityType === "focus_minutes");
    const hasLessonsLink = linkRows.some((l) => l.activityType === "lessons_completed");
    const hasReviewsLink = linkRows.some((l) => l.activityType === "flashcards_reviewed");

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 120);

    const [focusRows, completedLessons, reviewRows] = await Promise.all([
      hasFocusLink
        ? tx
            .select()
            .from(focusSessions)
            .where(
              and(
                eq(focusSessions.userId, userId),
                eq(focusSessions.status, "completed"),
                gte(focusSessions.startedAt, sinceDate)
              )
            )
        : Promise.resolve([]),
      hasLessonsLink
        ? tx
            .select()
            .from(lessons)
            .where(and(eq(lessons.userId, userId), eq(lessons.status, "completed")))
        : Promise.resolve([]),
      hasReviewsLink
        ? tx
            .select()
            .from(flashcardReviews)
            .where(
              and(
                eq(flashcardReviews.userId, userId),
                gte(flashcardReviews.reviewedAt, sinceDate)
              )
            )
        : Promise.resolve([]),
    ]);

    const linkByHabit = new Map(linkRows.map((l) => [l.habitId, l]));

    // Build 90-day heatmap dates
    const heatmapDates: string[] = [];
    const baseToday = new Date(`${todayStr}T12:00:00Z`);
    for (let i = 89; i >= 0; i -= 1) {
      const d = new Date(baseToday);
      d.setUTCDate(baseToday.getUTCDate() - i);
      heatmapDates.push(d.toISOString().slice(0, 10));
    }

    const enriched = habitRows.map((h) => {
      const totalsByDate = new Map<string, number>();

      // Manual entries aggregated by day
      for (const entry of entryRows) {
        if (entry.habitId !== h.id) continue;
        totalsByDate.set(
          entry.entryDate,
          (totalsByDate.get(entry.entryDate) ?? 0) + entry.value
        );
      }

      // Derived activity links (Focus / Learning / Flashcards) without double-counting
      const link = linkByHabit.get(h.id);
      if (link) {
        if (link.activityType === "focus_minutes") {
          for (const fs of focusRows) {
            if (link.projectId && fs.projectId !== link.projectId) continue;
            if (link.courseId && fs.courseId !== link.courseId) continue;
            if (link.category && fs.category !== link.category) continue;
            const ds = fs.startedAt.toISOString().slice(0, 10);
            const mins = Math.round(fs.actualDurationSeconds / 60);
            totalsByDate.set(ds, (totalsByDate.get(ds) ?? 0) + mins);
          }
        } else if (link.activityType === "lessons_completed") {
          for (const l of completedLessons) {
            if (!l.completedAt) continue;
            const ds = l.completedAt.toISOString().slice(0, 10);
            totalsByDate.set(ds, (totalsByDate.get(ds) ?? 0) + 1);
          }
        } else if (link.activityType === "flashcards_reviewed") {
          for (const r of reviewRows) {
            const ds = r.reviewedAt.toISOString().slice(0, 10);
            totalsByDate.set(ds, (totalsByDate.get(ds) ?? 0) + 1);
          }
        }
      }

      const todayValue = totalsByDate.get(todayStr) ?? 0;
      const streaks = computeHabitStreaks(
        {
          frequency: h.frequency,
          scheduleConfig: h.scheduleConfig,
          targetValue: h.targetValue,
          startDate: h.startDate,
        },
        totalsByDate,
        todayStr
      );

      const heatmap = heatmapDates.map((date) => {
        const value = totalsByDate.get(date) ?? 0;
        const ratio = Math.min(1, value / Math.max(1, h.targetValue));
        return { date, value, ratio };
      });

      const manualTodayEntries = entryRows.filter(
        (e) => e.habitId === h.id && e.entryDate === todayStr
      );

      return {
        ...h,
        activityLink: link ?? null,
        todayValue,
        scheduledToday: isDateScheduledForHabit(
          todayStr,
          h.frequency,
          h.scheduleConfig
        ),
        completedToday: todayValue >= h.targetValue,
        currentStreak: streaks.currentStreak,
        bestStreak: streaks.bestStreak,
        consistencyRate: streaks.consistencyRate,
        heatmap,
        manualTodayEntries,
      };
    });

    return { habits: enriched, todayStr };
  });
}

export async function createHabit(
  userId: string,
  workspaceId: string,
  input: {
    title: string;
    description?: string | null;
    color: string;
    category?: string | null;
    habitType: "boolean" | "quantitative";
    frequency: "daily" | "specific_days" | "weekly_count" | "monthly_count";
    scheduleConfig: HabitScheduleConfig;
    targetValue: number;
    unit: string;
    startDate?: string;
    activityLink?: {
      activityType: "focus_minutes" | "lessons_completed" | "flashcards_reviewed";
      projectId?: string | null;
      courseId?: string | null;
      category?: string | null;
    } | null;
  }
) {
  return withUserRls(userId, async (tx) => {
    const startDate = input.startDate ?? new Date().toISOString().slice(0, 10);
    const [created] = await tx
      .insert(habits)
      .values({
        userId,
        workspaceId,
        title: input.title,
        description: input.description ?? null,
        color: input.color,
        category: input.category ?? null,
        habitType: input.habitType,
        frequency: input.frequency,
        scheduleConfig: input.scheduleConfig,
        targetValue: input.habitType === "boolean" ? 1 : input.targetValue,
        unit: input.habitType === "boolean" ? "times" : input.unit,
        startDate,
      })
      .returning();

    if (created && input.activityLink) {
      await tx.insert(habitActivityLinks).values({
        userId,
        habitId: created.id,
        activityType: input.activityLink.activityType,
        projectId: input.activityLink.projectId ?? null,
        courseId: input.activityLink.courseId ?? null,
        category: input.activityLink.category ?? null,
      });
    }

    return created!;
  });
}

export async function logHabitEntry(
  userId: string,
  habitId: string,
  input: { entryDate: string; value: number }
) {
  return withUserRls(userId, async (tx) => {
    const hRow = await tx
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .limit(1);
    if (!hRow[0]) {
      throw new HabitServiceError(404, "HABIT_NOT_FOUND", "Habit not found");
    }

    const [entry] = await tx
      .insert(habitEntries)
      .values({
        userId,
        habitId,
        entryDate: input.entryDate,
        value: input.value,
        source: "manual",
      })
      .returning();

    return entry!;
  });
}

export async function deleteHabit(userId: string, habitId: string) {
  await withUserRls(userId, async (tx) => {
    const hRow = await tx
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .limit(1);
    if (!hRow[0]) {
      throw new HabitServiceError(404, "HABIT_NOT_FOUND", "Habit not found");
    }
    await tx
      .delete(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));
  });
}

export async function deleteHabitEntry(userId: string, entryId: string) {
  await withUserRls(userId, async (tx) => {
    await tx
      .delete(habitEntries)
      .where(and(eq(habitEntries.id, entryId), eq(habitEntries.userId, userId)));
  });
}
