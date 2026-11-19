import { and, asc, desc, eq } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import { routineRuns, routines, routineSteps } from "@/db/schema";

export async function listRoutines(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    const [routineRows, stepRows, runRows] = await Promise.all([
      tx
        .select()
        .from(routines)
        .where(and(eq(routines.userId, userId), eq(routines.workspaceId, workspaceId)))
        .orderBy(desc(routines.updatedAt)),
      tx
        .select()
        .from(routineSteps)
        .where(eq(routineSteps.userId, userId))
        .orderBy(asc(routineSteps.sortOrder)),
      tx
        .select()
        .from(routineRuns)
        .where(eq(routineRuns.userId, userId))
        .orderBy(desc(routineRuns.startedAt))
        .limit(30),
    ]);

    return routineRows.map((r) => ({
      ...r,
      steps: stepRows.filter((s) => s.routineId === r.id),
      latestRun: runRows.find((run) => run.routineId === r.id) ?? null,
    }));
  });
}

export async function createRoutine(
  userId: string,
  workspaceId: string,
  input: {
    title: string;
    description?: string | null;
    scheduledTime?: string;
    recurrenceDays?: string[];
    isTemplate?: boolean;
    steps: Array<{ title: string; durationMinutes: number; linkedHabitId?: string | null; linkedTaskId?: string | null }>;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(routines)
      .values({
        userId,
        workspaceId,
        title: input.title,
        description: input.description ?? null,
        scheduledTime: input.scheduledTime ?? "08:00",
        recurrenceDays: input.recurrenceDays ?? [],
        isTemplate: input.isTemplate ?? false,
      })
      .returning();

    if (input.steps.length > 0) {
      await tx.insert(routineSteps).values(
        input.steps.map((s, idx) => ({
          userId,
          routineId: created!.id,
          title: s.title,
          durationMinutes: Math.max(1, s.durationMinutes),
          sortOrder: idx,
          linkedHabitId: s.linkedHabitId ?? null,
          linkedTaskId: s.linkedTaskId ?? null,
        }))
      );
    }

    return created!;
  });
}

export async function duplicateRoutine(userId: string, workspaceId: string, routineId: string) {
  return withUserRls(userId, async (tx) => {
    const [orig] = await tx
      .select()
      .from(routines)
      .where(and(eq(routines.id, routineId), eq(routines.userId, userId)))
      .limit(1);
    if (!orig) throw new Error("Routine not found");

    const steps = await tx
      .select()
      .from(routineSteps)
      .where(eq(routineSteps.routineId, orig.id))
      .orderBy(asc(routineSteps.sortOrder));

    const [copy] = await tx
      .insert(routines)
      .values({
        userId,
        workspaceId,
        title: `${orig.title} (Copy)`,
        description: orig.description,
        scheduledTime: orig.scheduledTime,
        recurrenceDays: orig.recurrenceDays,
        isTemplate: false,
      })
      .returning();

    if (steps.length > 0) {
      await tx.insert(routineSteps).values(
        steps.map((s, idx) => ({
          userId,
          routineId: copy!.id,
          title: s.title,
          durationMinutes: s.durationMinutes,
          sortOrder: idx,
          linkedHabitId: s.linkedHabitId,
          linkedTaskId: s.linkedTaskId,
        }))
      );
    }
    return copy!;
  });
}

export async function toggleRoutinePause(userId: string, routineId: string, isPaused: boolean) {
  return withUserRls(userId, async (tx) => {
    const [updated] = await tx
      .update(routines)
      .set({ isPaused, updatedAt: new Date() })
      .where(and(eq(routines.id, routineId), eq(routines.userId, userId)))
      .returning();
    return updated ?? null;
  });
}

export async function startOrAdvanceRoutineRun(
  userId: string,
  input: {
    action: "start" | "step" | "finish" | "cancel";
    routineId: string;
    runId?: string;
    stepId?: string;
    stepResult?: "completed" | "skipped";
  }
) {
  return withUserRls(userId, async (tx) => {
    if (input.action === "start") {
      const [run] = await tx
        .insert(routineRuns)
        .values({
          userId,
          routineId: input.routineId,
          status: "running",
          currentStepIndex: 0,
          stepStates: {},
        })
        .returning();
      return run!;
    }

    if (!input.runId) throw new Error("runId required");
    const [run] = await tx
      .select()
      .from(routineRuns)
      .where(and(eq(routineRuns.id, input.runId), eq(routineRuns.userId, userId)))
      .limit(1);
    if (!run) throw new Error("Routine run not found");

    if (input.action === "finish" || input.action === "cancel") {
      const [updated] = await tx
        .update(routineRuns)
        .set({
          status: input.action === "finish" ? "completed" : "cancelled",
          completedAt: new Date(),
        })
        .where(eq(routineRuns.id, run.id))
        .returning();
      return updated!;
    }

    const steps = await tx
      .select()
      .from(routineSteps)
      .where(eq(routineSteps.routineId, run.routineId))
      .orderBy(asc(routineSteps.sortOrder));

    const nextStates = {
      ...run.stepStates,
      ...(input.stepId ? { [input.stepId]: input.stepResult ?? "completed" } : {}),
    };
    const nextIndex = Math.min(steps.length, run.currentStepIndex + 1);
    const done = nextIndex >= steps.length;

    const [updated] = await tx
      .update(routineRuns)
      .set({
        stepStates: nextStates,
        currentStepIndex: nextIndex,
        status: done ? "completed" : "running",
        ...(done ? { completedAt: new Date() } : {}),
      })
      .where(eq(routineRuns.id, run.id))
      .returning();

    return updated!;
  });
}

export async function deleteRoutine(userId: string, routineId: string) {
  return withUserRls(userId, async (tx) => {
    await tx.delete(routines).where(and(eq(routines.id, routineId), eq(routines.userId, userId)));
    return { deleted: true };
  });
}
