import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  courses,
  focusPreferences,
  focusSessionIntervals,
  focusSessions,
  projects,
  tasks,
} from "@/db/schema";
import { computeElapsedFocusSeconds } from "./utils";

export class FocusServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
  }
}

export async function getFocusOverview(userId: string) {
  return withUserRls(userId, async (tx) => {
    const [activeRows, prefRows, recentSessions] = await Promise.all([
      tx
        .select()
        .from(focusSessions)
        .where(
          and(
            eq(focusSessions.userId, userId),
            inArray(focusSessions.status, ["running", "paused"])
          )
        )
        .limit(1),
      tx
        .select()
        .from(focusPreferences)
        .where(eq(focusPreferences.userId, userId))
        .limit(1),
      tx
        .select()
        .from(focusSessions)
        .where(
          and(eq(focusSessions.userId, userId), eq(focusSessions.status, "completed"))
        )
        .orderBy(desc(focusSessions.startedAt))
        .limit(25),
    ]);

    const active = activeRows[0] ?? null;
    const activeIntervals = active
      ? await tx
          .select()
          .from(focusSessionIntervals)
          .where(eq(focusSessionIntervals.sessionId, active.id))
          .orderBy(asc(focusSessionIntervals.startedAt))
      : [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - 6);

    const todaySeconds = recentSessions
      .filter((s) => s.startedAt >= startOfToday)
      .reduce((acc, s) => acc + s.actualDurationSeconds, 0);
    const weekSeconds = recentSessions
      .filter((s) => s.startedAt >= startOfWeek)
      .reduce((acc, s) => acc + s.actualDurationSeconds, 0);

    const prefs = prefRows[0] ?? {
      userId,
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      cyclesBeforeLongBreak: 4,
      soundEnabled: true,
      updatedAt: now,
    };

    return {
      activeSession: active
        ? {
            ...active,
            intervals: activeIntervals,
            elapsedSeconds: computeElapsedFocusSeconds(activeIntervals, now),
          }
        : null,
      preferences: prefs,
      recentSessions,
      analytics: {
        todayMinutes: Math.round(todaySeconds / 60),
        weekMinutes: Math.round(weekSeconds / 60),
        sessionsCount: recentSessions.length,
        avgMinutes:
          recentSessions.length > 0
            ? Math.round(
                recentSessions.reduce((a, s) => a + s.actualDurationSeconds, 0) /
                  recentSessions.length /
                  60
              )
            : 0,
      },
    };
  });
}

export async function startFocusSession(
  userId: string,
  workspaceId: string,
  input: {
    mode: "pomodoro" | "stopwatch";
    description?: string | null;
    category?: string | null;
    taskId?: string | null;
    projectId?: string | null;
    courseId?: string | null;
    lessonId?: string | null;
    calendarEventId?: string | null;
  }
) {
  return withUserRls(userId, async (tx) => {
    const existing = await tx
      .select()
      .from(focusSessions)
      .where(
        and(
          eq(focusSessions.userId, userId),
          inArray(focusSessions.status, ["running", "paused"])
        )
      )
      .limit(1);

    if (existing[0]) {
      throw new FocusServiceError(
        409,
        "ACTIVE_SESSION_EXISTS",
        "You already have an active focus session. Resume or finish it first.",
        { activeSession: existing[0] }
      );
    }

    if (input.taskId) {
      const t = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, input.taskId), eq(tasks.userId, userId)))
        .limit(1);
      if (!t[0]) throw new FocusServiceError(400, "INVALID_TASK", "Task not found");
    }
    if (input.projectId) {
      const p = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.userId, userId)))
        .limit(1);
      if (!p[0]) throw new FocusServiceError(400, "INVALID_PROJECT", "Project not found");
    }
    if (input.courseId) {
      const c = await tx
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.id, input.courseId), eq(courses.userId, userId)))
        .limit(1);
      if (!c[0]) throw new FocusServiceError(400, "INVALID_COURSE", "Course not found");
    }

    const now = new Date();
    const [session] = await tx
      .insert(focusSessions)
      .values({
        userId,
        workspaceId,
        mode: input.mode,
        status: "running",
        startedAt: now,
        description: input.description ?? null,
        category: input.category ?? null,
        taskId: input.taskId ?? null,
        projectId: input.projectId ?? null,
        courseId: input.courseId ?? null,
        lessonId: input.lessonId ?? null,
        calendarEventId: input.calendarEventId ?? null,
      })
      .returning();

    if (!session) {
      throw new FocusServiceError(500, "START_FAILED", "Failed to start session");
    }

    const [interval] = await tx
      .insert(focusSessionIntervals)
      .values({
        userId,
        sessionId: session.id,
        intervalType: "focus",
        startedAt: now,
      })
      .returning();

    return { ...session, intervals: interval ? [interval] : [], elapsedSeconds: 0 };
  });
}

export async function transitionFocusSession(
  userId: string,
  sessionId: string,
  action: "pause" | "resume" | "complete" | "discard"
) {
  return withUserRls(userId, async (tx) => {
    const rows = await tx
      .select()
      .from(focusSessions)
      .where(and(eq(focusSessions.id, sessionId), eq(focusSessions.userId, userId)))
      .limit(1);

    const session = rows[0];
    if (!session) {
      throw new FocusServiceError(404, "SESSION_NOT_FOUND", "Focus session not found");
    }
    if (session.status === "completed" || session.status === "discarded") {
      return session;
    }

    const now = new Date();
    const intervals = await tx
      .select()
      .from(focusSessionIntervals)
      .where(eq(focusSessionIntervals.sessionId, sessionId))
      .orderBy(asc(focusSessionIntervals.startedAt));

    const openInterval = intervals.find((i) => i.endedAt === null);

    if (action === "pause") {
      if (openInterval) {
        await tx
          .update(focusSessionIntervals)
          .set({ endedAt: now })
          .where(eq(focusSessionIntervals.id, openInterval.id));
        openInterval.endedAt = now;
      }
      const elapsed = computeElapsedFocusSeconds(intervals, now);
      const [updated] = await tx
        .update(focusSessions)
        .set({ status: "paused", actualDurationSeconds: elapsed, updatedAt: now })
        .where(eq(focusSessions.id, sessionId))
        .returning();
      return { ...updated!, intervals, elapsedSeconds: elapsed };
    }

    if (action === "resume") {
      if (!openInterval) {
        const [createdInt] = await tx
          .insert(focusSessionIntervals)
          .values({
            userId,
            sessionId,
            intervalType: "focus",
            startedAt: now,
          })
          .returning();
        if (createdInt) intervals.push(createdInt);
      }
      const elapsed = computeElapsedFocusSeconds(intervals, now);
      const [updated] = await tx
        .update(focusSessions)
        .set({ status: "running", updatedAt: now })
        .where(eq(focusSessions.id, sessionId))
        .returning();
      return { ...updated!, intervals, elapsedSeconds: elapsed };
    }

    // complete or discard
    if (openInterval) {
      await tx
        .update(focusSessionIntervals)
        .set({ endedAt: now })
        .where(eq(focusSessionIntervals.id, openInterval.id));
      openInterval.endedAt = now;
    }

    const elapsed = computeElapsedFocusSeconds(intervals, now);
    const nextStatus = action === "complete" ? "completed" : "discarded";

    const [updated] = await tx
      .update(focusSessions)
      .set({
        status: nextStatus,
        endedAt: now,
        actualDurationSeconds: elapsed,
        updatedAt: now,
      })
      .where(eq(focusSessions.id, sessionId))
      .returning();

    // Update linked task actual_minutes on completion
    if (nextStatus === "completed" && session.taskId && elapsed > 0) {
      const addedMinutes = Math.max(1, Math.round(elapsed / 60));
      await tx
        .update(tasks)
        .set({
          actualMinutes: sql`${tasks.actualMinutes} + ${addedMinutes}`,
          updatedAt: now,
        })
        .where(and(eq(tasks.id, session.taskId), eq(tasks.userId, userId)));
    }

    return updated!;
  });
}

export async function updateFocusPreferences(
  userId: string,
  input: {
    focusMinutes?: number;
    shortBreakMinutes?: number;
    longBreakMinutes?: number;
    cyclesBeforeLongBreak?: number;
    soundEnabled?: boolean;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [saved] = await tx
      .insert(focusPreferences)
      .values({
        userId,
        focusMinutes: input.focusMinutes ?? 25,
        shortBreakMinutes: input.shortBreakMinutes ?? 5,
        longBreakMinutes: input.longBreakMinutes ?? 15,
        cyclesBeforeLongBreak: input.cyclesBeforeLongBreak ?? 4,
        soundEnabled: input.soundEnabled ?? true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: focusPreferences.userId,
        set: {
          ...(input.focusMinutes !== undefined ? { focusMinutes: input.focusMinutes } : {}),
          ...(input.shortBreakMinutes !== undefined
            ? { shortBreakMinutes: input.shortBreakMinutes }
            : {}),
          ...(input.longBreakMinutes !== undefined
            ? { longBreakMinutes: input.longBreakMinutes }
            : {}),
          ...(input.cyclesBeforeLongBreak !== undefined
            ? { cyclesBeforeLongBreak: input.cyclesBeforeLongBreak }
            : {}),
          ...(input.soundEnabled !== undefined ? { soundEnabled: input.soundEnabled } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    return saved!;
  });
}
