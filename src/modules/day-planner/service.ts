import { and, asc, eq, gte, isNull, lte, ne } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  calendarEvents,
  dayPlannerBlocks,
  routines,
  routineSteps,
  taskDependencies,
  tasks,
} from "@/db/schema";

export interface PlannerCandidateTask {
  id: string;
  title: string;
  priority: string;
  estimatedMinutes: number;
  dueAt: Date | null;
  blockedBy: string[];
}

export interface FixedBusySlot {
  startMinute: number;
  endMinute: number;
  title: string;
}

const PRIORITY_SCORE: Record<string, number> = {
  urgent: 100,
  high: 70,
  medium: 40,
  low: 20,
  none: 10,
};

/**
 * Pure deterministic constraint-based scheduler for a single day.
 * Never overwrites fixed events or schedules dependency-blocked tasks.
 */
export function scheduleDaySlots(params: {
  tasks: PlannerCandidateTask[];
  busySlots: FixedBusySlot[];
  workStartMinute?: number;
  workEndMinute?: number;
  minBreakMinutes?: number;
  referenceDate?: Date;
}) {
  const workStart = params.workStartMinute ?? 8 * 60;
  const workEnd = params.workEndMinute ?? 21 * 60;
  const minBreak = params.minBreakMinutes ?? 10;
  const now = params.referenceDate ?? new Date();

  const sortedBusy = [...params.busySlots]
    .filter((b) => b.endMinute > workStart && b.startMinute < workEnd)
    .sort((a, b) => a.startMinute - b.startMinute);

  // Build free gaps inside [workStart, workEnd]
  const gaps: Array<{ start: number; end: number }> = [];
  let cursor = workStart;
  for (const busy of sortedBusy) {
    if (busy.startMinute > cursor) {
      gaps.push({ start: cursor, end: Math.min(workEnd, busy.startMinute) });
    }
    cursor = Math.max(cursor, busy.endMinute + minBreak);
  }
  if (cursor < workEnd) {
    gaps.push({ start: cursor, end: workEnd });
  }

  const unscheduled: Array<{ id: string; title: string; reason: string }> = [];
  const eligible: Array<PlannerCandidateTask & { score: number }> = [];

  for (const t of params.tasks) {
    if (t.blockedBy.length > 0) {
      unscheduled.push({
        id: t.id,
        title: t.title,
        reason: `Blocked by unfinished predecessor(s): ${t.blockedBy.join(", ")}`,
      });
      continue;
    }
    let score = PRIORITY_SCORE[t.priority] ?? 30;
    if (t.dueAt) {
      const hoursUntilDue = (t.dueAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilDue <= 0) score += 80;
      else if (hoursUntilDue <= 24) score += 50;
      else if (hoursUntilDue <= 72) score += 25;
    }
    eligible.push({ ...t, score });
  }

  eligible.sort((a, b) => b.score - a.score);

  const scheduled: Array<{
    taskId: string;
    title: string;
    priority: string;
    startMinute: number;
    endMinute: number;
  }> = [];

  for (const task of eligible) {
    const dur = Math.max(15, Math.min(240, task.estimatedMinutes || 30));
    let placed = false;
    for (const gap of gaps) {
      if (gap.end - gap.start >= dur) {
        const startMinute = gap.start;
        const endMinute = startMinute + dur;
        scheduled.push({
          taskId: task.id,
          title: task.title,
          priority: task.priority,
          startMinute,
          endMinute,
        });
        gap.start = endMinute + minBreak;
        placed = true;
        break;
      }
    }
    if (!placed) {
      unscheduled.push({
        id: task.id,
        title: task.title,
        reason: `No continuous ${dur}m slot available inside configured hours`,
      });
    }
  }

  return { scheduled, unscheduled };
}

export async function getDayPlanOverview(userId: string, workspaceId: string, planDate: string) {
  const dayStart = new Date(`${planDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${planDate}T23:59:59.999Z`);

  return withUserRls(userId, async (tx) => {
    const [blocks, events, openTasks, deps] = await Promise.all([
      tx
        .select()
        .from(dayPlannerBlocks)
        .where(
          and(
            eq(dayPlannerBlocks.userId, userId),
            eq(dayPlannerBlocks.workspaceId, workspaceId),
            eq(dayPlannerBlocks.planDate, planDate)
          )
        )
        .orderBy(asc(dayPlannerBlocks.startMinute)),
      tx
        .select()
        .from(calendarEvents)
        .where(
          and(
            eq(calendarEvents.userId, userId),
            eq(calendarEvents.workspaceId, workspaceId),
            gte(calendarEvents.endsAt, dayStart),
            lte(calendarEvents.startsAt, dayEnd)
          )
        ),
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
    ]);

    return {
      planDate,
      blocks,
      events,
      openTasksCount: openTasks.length,
      dependenciesCount: deps.length,
    };
  });
}

export async function generateDayPlanForUser(
  userId: string,
  workspaceId: string,
  planDate: string,
  options?: { workStartMinute?: number; workEndMinute?: number }
) {
  const dayStart = new Date(`${planDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${planDate}T23:59:59.999Z`);

  return withUserRls(userId, async (tx) => {
    const [events, allOpenTasks, allTasks, deps, activeRoutines, allRoutineSteps, blockedBlocks] =
      await Promise.all([
        tx
          .select()
          .from(calendarEvents)
          .where(
            and(
              eq(calendarEvents.userId, userId),
              eq(calendarEvents.workspaceId, workspaceId),
              gte(calendarEvents.endsAt, dayStart),
              lte(calendarEvents.startsAt, dayEnd)
            )
          ),
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
        tx
          .select({ id: tasks.id, title: tasks.title, status: tasks.status })
          .from(tasks)
          .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt))),
        tx.select().from(taskDependencies).where(eq(taskDependencies.userId, userId)),
        tx
          .select()
          .from(routines)
          .where(
            and(
              eq(routines.userId, userId),
              eq(routines.workspaceId, workspaceId),
              eq(routines.isPaused, false),
              eq(routines.isTemplate, false)
            )
          ),
        tx.select().from(routineSteps).where(eq(routineSteps.userId, userId)),
        tx
          .select()
          .from(dayPlannerBlocks)
          .where(
            and(
              eq(dayPlannerBlocks.userId, userId),
              eq(dayPlannerBlocks.workspaceId, workspaceId),
              eq(dayPlannerBlocks.planDate, planDate),
              eq(dayPlannerBlocks.sourceType, "blocked")
            )
          ),
      ]);

    const taskMap = new Map(allTasks.map((t) => [t.id, t]));
    const busySlots: FixedBusySlot[] = [
      ...events.map((e) => ({
        startMinute: e.startsAt.getHours() * 60 + e.startsAt.getMinutes(),
        endMinute: Math.max(
          e.startsAt.getHours() * 60 + e.startsAt.getMinutes() + 15,
          e.endsAt.getHours() * 60 + e.endsAt.getMinutes()
        ),
        title: e.title,
      })),
      ...blockedBlocks.map((b) => ({
        startMinute: b.startMinute,
        endMinute: b.endMinute,
        title: b.title,
      })),
    ];

    for (const r of activeRoutines) {
      const steps = allRoutineSteps.filter((s) => s.routineId === r.id);
      const totalDur = steps.reduce((acc, s) => acc + s.durationMinutes, 0) || 20;
      const [hh, mm] = (r.scheduledTime ?? "08:00").split(":").map(Number);
      const startM = (hh || 8) * 60 + (mm || 0);
      busySlots.push({
        startMinute: startM,
        endMinute: startM + totalDur,
        title: `Routine: ${r.title}`,
      });
    }

    const candidates: PlannerCandidateTask[] = allOpenTasks.map((t) => {
      const preds = deps
        .filter((d) => d.taskId === t.id)
        .map((d) => taskMap.get(d.dependsOnTaskId))
        .filter((p) => p && p.status !== "done")
        .map((p) => p!.title);

      return {
        id: t.id,
        title: t.title,
        priority: t.priority,
        estimatedMinutes: t.estimatedMinutes ?? 30,
        dueAt: t.dueAt,
        blockedBy: preds,
      };
    });

    const { scheduled, unscheduled } = scheduleDaySlots({
      tasks: candidates,
      busySlots,
      workStartMinute: options?.workStartMinute,
      workEndMinute: options?.workEndMinute,
    });

    // Clear previous suggested blocks for this date (keep accepted/blocked)
    await tx
      .delete(dayPlannerBlocks)
      .where(
        and(
          eq(dayPlannerBlocks.userId, userId),
          eq(dayPlannerBlocks.workspaceId, workspaceId),
          eq(dayPlannerBlocks.planDate, planDate),
          eq(dayPlannerBlocks.status, "suggested")
        )
      );

    if (scheduled.length > 0) {
      await tx.insert(dayPlannerBlocks).values(
        scheduled.map((s) => ({
          userId,
          workspaceId,
          planDate,
          title: s.title,
          sourceType: "task",
          sourceId: s.taskId,
          startMinute: s.startMinute,
          endMinute: s.endMinute,
          status: "suggested",
          priority: s.priority,
        }))
      );
    }

    return { scheduledCount: scheduled.length, unscheduled };
  });
}

export async function updateDayPlannerBlock(
  userId: string,
  blockId: string,
  patch: { startMinute?: number; endMinute?: number; status?: string }
) {
  return withUserRls(userId, async (tx) => {
    const [updated] = await tx
      .update(dayPlannerBlocks)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(dayPlannerBlocks.id, blockId), eq(dayPlannerBlocks.userId, userId)))
      .returning();
    return updated ?? null;
  });
}

export async function createManualPlannerBlock(
  userId: string,
  workspaceId: string,
  input: {
    planDate: string;
    title: string;
    sourceType: "custom" | "blocked";
    startMinute: number;
    endMinute: number;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(dayPlannerBlocks)
      .values({
        userId,
        workspaceId,
        planDate: input.planDate,
        title: input.title,
        sourceType: input.sourceType,
        startMinute: input.startMinute,
        endMinute: Math.max(input.startMinute + 15, input.endMinute),
        status: "accepted",
      })
      .returning();
    return created!;
  });
}

export async function deleteDayPlannerBlock(userId: string, blockId: string) {
  return withUserRls(userId, async (tx) => {
    await tx
      .delete(dayPlannerBlocks)
      .where(and(eq(dayPlannerBlocks.id, blockId), eq(dayPlannerBlocks.userId, userId)));
    return { deleted: true };
  });
}
