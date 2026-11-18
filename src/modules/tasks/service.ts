import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { withUserRls, type DbTransaction } from "@/db/rls";
import {
  milestones,
  notes,
  projects,
  tags,
  taskRecurrenceRules,
  tasks,
  taskTags,
  type TaskRecord,
} from "@/db/schema";
import { recordActivity } from "@/modules/activity/service";
import { recalculateProjectProgressTx } from "@/modules/projects/progress";
import type { CreateTaskInput, UpdateTaskInput } from "./schemas";
import { calculateNextOccurrence, wouldCreateTaskCycle } from "./utils";

export class TaskServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

async function syncTaskTagsTx(
  tx: DbTransaction,
  userId: string,
  workspaceId: string,
  taskId: string,
  tagNames: string[]
): Promise<void> {
  await tx.delete(taskTags).where(eq(taskTags.taskId, taskId));
  const cleanNames = Array.from(new Set(tagNames.map((n) => n.trim()).filter(Boolean)));
  if (cleanNames.length === 0) return;

  const existingTags = await tx
    .select()
    .from(tags)
    .where(and(eq(tags.workspaceId, workspaceId), inArray(tags.name, cleanNames)));

  const existingByName = new Map(existingTags.map((t) => [t.name, t.id]));
  const tagIds: string[] = existingTags.map((t) => t.id);

  for (const name of cleanNames) {
    if (!existingByName.has(name)) {
      const [insertedTag] = await tx
        .insert(tags)
        .values({ userId, workspaceId, name })
        .returning({ id: tags.id });
      if (insertedTag) {
        tagIds.push(insertedTag.id);
      }
    }
  }

  if (tagIds.length > 0) {
    await tx.insert(taskTags).values(
      tagIds.map((tagId) => ({
        taskId,
        tagId,
      }))
    );
  }
}

async function verifyRelatedOwnershipTx(
  tx: DbTransaction,
  userId: string,
  input: {
    projectId?: string | null;
    noteId?: string | null;
    parentTaskId?: string | null;
    milestoneId?: string | null;
  }
): Promise<void> {
  if (input.projectId) {
    const row = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, input.projectId), eq(projects.userId, userId)))
      .limit(1);
    if (!row[0]) throw new TaskServiceError(400, "INVALID_PROJECT", "Project not found");
  }

  if (input.noteId) {
    const row = await tx
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.id, input.noteId), eq(notes.userId, userId), isNull(notes.deletedAt)))
      .limit(1);
    if (!row[0]) throw new TaskServiceError(400, "INVALID_NOTE", "Note not found");
  }

  if (input.parentTaskId) {
    const row = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, input.parentTaskId), eq(tasks.userId, userId)))
      .limit(1);
    if (!row[0]) throw new TaskServiceError(400, "INVALID_PARENT", "Parent task not found");
  }

  if (input.milestoneId) {
    const row = await tx
      .select({ id: milestones.id })
      .from(milestones)
      .where(and(eq(milestones.id, input.milestoneId), eq(milestones.userId, userId)))
      .limit(1);
    if (!row[0]) throw new TaskServiceError(400, "INVALID_MILESTONE", "Milestone not found");
  }
}

export interface TaskWithRelations extends TaskRecord {
  tags: Array<{ id: string; name: string; color: string }>;
  projectName: string | null;
  projectColor: string | null;
  noteTitle: string | null;
  recurrence: { frequency: "daily" | "weekly" | "monthly"; interval: number } | null;
}

export async function listTasks(
  userId: string,
  workspaceId: string,
  filters?: { projectId?: string; status?: string; priority?: string }
): Promise<TaskWithRelations[]> {
  return withUserRls(userId, async (tx) => {
    const conditions = [
      eq(tasks.userId, userId),
      eq(tasks.workspaceId, workspaceId),
    ];

    if (filters?.projectId) {
      conditions.push(eq(tasks.projectId, filters.projectId));
    }
    if (filters?.status) {
      conditions.push(eq(tasks.status, filters.status as TaskRecord["status"]));
    }
    if (filters?.priority) {
      conditions.push(eq(tasks.priority, filters.priority as TaskRecord["priority"]));
    }

    const taskRows = await tx
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(asc(tasks.sortOrder), desc(tasks.createdAt));

    if (taskRows.length === 0) return [];

    const taskIds = taskRows.map((t) => t.id);

    const [tagRows, recurrenceRows, projectRows, noteRows] = await Promise.all([
      tx
        .select({
          taskId: taskTags.taskId,
          id: tags.id,
          name: tags.name,
          color: tags.color,
        })
        .from(taskTags)
        .innerJoin(tags, eq(taskTags.tagId, tags.id))
        .where(inArray(taskTags.taskId, taskIds)),
      tx
        .select()
        .from(taskRecurrenceRules)
        .where(inArray(taskRecurrenceRules.taskId, taskIds)),
      tx
        .select({ id: projects.id, name: projects.name, color: projects.color })
        .from(projects)
        .where(eq(projects.userId, userId)),
      tx
        .select({ id: notes.id, title: notes.title })
        .from(notes)
        .where(and(eq(notes.userId, userId), isNull(notes.deletedAt))),
    ]);

    const tagsByTask = new Map<string, Array<{ id: string; name: string; color: string }>>();
    for (const tr of tagRows) {
      const list = tagsByTask.get(tr.taskId) ?? [];
      list.push({ id: tr.id, name: tr.name, color: tr.color });
      tagsByTask.set(tr.taskId, list);
    }

    const recByTask = new Map(
      recurrenceRows.map((r) => [
        r.taskId,
        { frequency: r.frequency, interval: r.interval },
      ])
    );
    const projectMap = new Map(projectRows.map((p) => [p.id, p]));
    const noteMap = new Map(noteRows.map((n) => [n.id, n]));

    return taskRows.map((t) => {
      const proj = t.projectId ? projectMap.get(t.projectId) : undefined;
      const note = t.noteId ? noteMap.get(t.noteId) : undefined;
      return {
        ...t,
        tags: tagsByTask.get(t.id) ?? [],
        projectName: proj?.name ?? null,
        projectColor: proj?.color ?? null,
        noteTitle: note?.title ?? null,
        recurrence: recByTask.get(t.id) ?? null,
      };
    });
  });
}

export async function createTask(
  userId: string,
  workspaceId: string,
  input: CreateTaskInput
): Promise<TaskWithRelations> {
  const created = await withUserRls(userId, async (tx) => {
    await verifyRelatedOwnershipTx(tx, userId, input);

    const status = input.status ?? "todo";
    const dueAt = input.dueAt ? new Date(input.dueAt) : null;
    const startAt = input.startAt ? new Date(input.startAt) : null;
    const recurrenceRule = input.recurrence
      ? `${input.recurrence.frequency}:${input.recurrence.interval}`
      : null;

    const [inserted] = await tx
      .insert(tasks)
      .values({
        userId,
        workspaceId,
        title: input.title,
        description: input.description ?? null,
        status,
        priority: input.priority ?? "medium",
        dueAt,
        startAt,
        estimatedMinutes: input.estimatedMinutes ?? null,
        projectId: input.projectId ?? null,
        noteId: input.noteId ?? null,
        parentTaskId: input.parentTaskId ?? null,
        milestoneId: input.milestoneId ?? null,
        recurrenceRule,
        completedAt: status === "done" ? new Date() : null,
      })
      .returning();

    if (!inserted) {
      throw new TaskServiceError(500, "CREATE_FAILED", "Failed to create task");
    }

    if (input.tags && input.tags.length > 0) {
      await syncTaskTagsTx(tx, userId, workspaceId, inserted.id, input.tags);
    }

    if (input.recurrence) {
      const nextOccurrence = calculateNextOccurrence(
        dueAt ?? new Date(),
        input.recurrence.frequency,
        input.recurrence.interval
      );
      await tx.insert(taskRecurrenceRules).values({
        userId,
        taskId: inserted.id,
        frequency: input.recurrence.frequency,
        interval: input.recurrence.interval,
        nextOccurrenceAt: nextOccurrence,
      });
    }

    await recalculateProjectProgressTx(tx, userId, inserted.projectId);
    return inserted;
  });

  await recordActivity({
    userId,
    workspaceId,
    entityType: "task",
    entityId: created.id,
    action: "task.created",
    payload: { title: created.title, projectId: created.projectId },
  });

  const all = await listTasks(userId, workspaceId);
  return all.find((t) => t.id === created.id)!;
}

export async function updateTask(
  userId: string,
  taskId: string,
  input: UpdateTaskInput
): Promise<TaskWithRelations> {
  const result = await withUserRls(userId, async (tx) => {
    const existingRows = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .limit(1);

    const existing = existingRows[0];
    if (!existing) {
      throw new TaskServiceError(404, "TASK_NOT_FOUND", "Task not found");
    }

    await verifyRelatedOwnershipTx(tx, userId, input);

    if (input.parentTaskId !== undefined && input.parentTaskId !== existing.parentTaskId) {
      const allTasks = await tx
        .select({ id: tasks.id, parentTaskId: tasks.parentTaskId })
        .from(tasks)
        .where(eq(tasks.userId, userId));

      if (wouldCreateTaskCycle(allTasks, taskId, input.parentTaskId)) {
        throw new TaskServiceError(
          400,
          "SUBTASK_CYCLE",
          "Cannot set a subtask as its own ancestor"
        );
      }
    }

    const nextStatus = input.status ?? existing.status;
    const becomingDone = existing.status !== "done" && nextStatus === "done";
    const leavingDone = existing.status === "done" && nextStatus !== "done";

    const [updated] = await tx
      .update(tasks)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.dueAt !== undefined
          ? { dueAt: input.dueAt ? new Date(input.dueAt) : null }
          : {}),
        ...(input.startAt !== undefined
          ? { startAt: input.startAt ? new Date(input.startAt) : null }
          : {}),
        ...(input.estimatedMinutes !== undefined
          ? { estimatedMinutes: input.estimatedMinutes }
          : {}),
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        ...(input.noteId !== undefined ? { noteId: input.noteId } : {}),
        ...(input.parentTaskId !== undefined ? { parentTaskId: input.parentTaskId } : {}),
        ...(input.milestoneId !== undefined ? { milestoneId: input.milestoneId } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.recurrence !== undefined
          ? {
              recurrenceRule: input.recurrence
                ? `${input.recurrence.frequency}:${input.recurrence.interval}`
                : null,
            }
          : {}),
        ...(becomingDone ? { completedAt: new Date() } : {}),
        ...(leavingDone ? { completedAt: null } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning();

    if (!updated) {
      throw new TaskServiceError(500, "UPDATE_FAILED", "Failed to update task");
    }

    if (input.tags !== undefined) {
      await syncTaskTagsTx(tx, userId, existing.workspaceId, taskId, input.tags);
    }

    if (input.recurrence !== undefined) {
      await tx.delete(taskRecurrenceRules).where(eq(taskRecurrenceRules.taskId, taskId));
      if (input.recurrence) {
        const nextOcc = calculateNextOccurrence(
          updated.dueAt ?? new Date(),
          input.recurrence.frequency,
          input.recurrence.interval
        );
        await tx.insert(taskRecurrenceRules).values({
          userId,
          taskId,
          frequency: input.recurrence.frequency,
          interval: input.recurrence.interval,
          nextOccurrenceAt: nextOcc,
        });
      }
    }

    // Generate next recurring occurrence atomically on completion (idempotent via lastGeneratedAt)
    if (becomingDone) {
      const recRows = await tx
        .select()
        .from(taskRecurrenceRules)
        .where(eq(taskRecurrenceRules.taskId, taskId))
        .limit(1);
      const rule = recRows[0];
      if (rule && !rule.lastGeneratedAt) {
        const nextDue = calculateNextOccurrence(
          updated.dueAt ?? new Date(),
          rule.frequency,
          rule.interval
        );
        const [nextTask] = await tx
          .insert(tasks)
          .values({
            userId,
            workspaceId: updated.workspaceId,
            projectId: updated.projectId,
            noteId: updated.noteId,
            milestoneId: updated.milestoneId,
            title: updated.title,
            description: updated.description,
            status: "todo",
            priority: updated.priority,
            dueAt: nextDue,
            estimatedMinutes: updated.estimatedMinutes,
            recurrenceRule: updated.recurrenceRule,
          })
          .returning({ id: tasks.id });

        if (nextTask) {
          await tx.insert(taskRecurrenceRules).values({
            userId,
            taskId: nextTask.id,
            frequency: rule.frequency,
            interval: rule.interval,
            nextOccurrenceAt: calculateNextOccurrence(
              nextDue,
              rule.frequency,
              rule.interval
            ),
          });
          await tx
            .update(taskRecurrenceRules)
            .set({ lastGeneratedAt: new Date(), updatedAt: new Date() })
            .where(eq(taskRecurrenceRules.id, rule.id));
        }
      }
    }

    if (existing.projectId && existing.projectId !== updated.projectId) {
      await recalculateProjectProgressTx(tx, userId, existing.projectId);
    }
    await recalculateProjectProgressTx(tx, userId, updated.projectId);

    return { updated, becomingDone };
  });

  await recordActivity({
    userId,
    workspaceId: result.updated.workspaceId,
    entityType: "task",
    entityId: result.updated.id,
    action: result.becomingDone ? "task.completed" : "task.updated",
    payload: { title: result.updated.title, status: result.updated.status },
  });

  const all = await listTasks(userId, result.updated.workspaceId);
  return all.find((t) => t.id === result.updated.id)!;
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  await withUserRls(userId, async (tx) => {
    const rows = await tx
      .select({ id: tasks.id, projectId: tasks.projectId })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .limit(1);

    const existing = rows[0];
    if (!existing) {
      throw new TaskServiceError(404, "TASK_NOT_FOUND", "Task not found");
    }

    await tx.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
    await recalculateProjectProgressTx(tx, userId, existing.projectId);
  });
}

export async function duplicateTask(
  userId: string,
  workspaceId: string,
  taskId: string
): Promise<TaskWithRelations> {
  const all = await listTasks(userId, workspaceId);
  const original = all.find((t) => t.id === taskId);
  if (!original) {
    throw new TaskServiceError(404, "TASK_NOT_FOUND", "Task not found");
  }

  return createTask(userId, workspaceId, {
    title: `${original.title} (Copy)`,
    description: original.description,
    status: "todo",
    priority: original.priority,
    dueAt: original.dueAt ? original.dueAt.toISOString() : null,
    estimatedMinutes: original.estimatedMinutes,
    projectId: original.projectId,
    noteId: original.noteId,
    parentTaskId: original.parentTaskId,
    milestoneId: original.milestoneId,
    tags: original.tags.map((t) => t.name),
  });
}
