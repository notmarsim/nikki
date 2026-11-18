import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  activityLogs,
  milestones,
  notes,
  projects,
  tasks,
  type MilestoneRecord,
  type ProjectRecord,
} from "@/db/schema";
import { recordActivity } from "@/modules/activity/service";
import type {
  CreateMilestoneInput,
  CreateProjectInput,
  UpdateMilestoneInput,
  UpdateProjectInput,
} from "./schemas";

export class ProjectServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export interface ProjectSummary extends ProjectRecord {
  totalTasks: number;
  completedTasks: number;
  notesCount: number;
  milestonesCount: number;
}

export async function listProjects(
  userId: string,
  workspaceId: string
): Promise<ProjectSummary[]> {
  return withUserRls(userId, async (tx) => {
    const [projRows, taskRows, noteRows, milestoneRows] = await Promise.all([
      tx
        .select()
        .from(projects)
        .where(and(eq(projects.userId, userId), eq(projects.workspaceId, workspaceId)))
        .orderBy(desc(projects.updatedAt)),
      tx
        .select({
          projectId: tasks.projectId,
          status: tasks.status,
          parentTaskId: tasks.parentTaskId,
        })
        .from(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.workspaceId, workspaceId))),
      tx
        .select({ projectId: notes.projectId })
        .from(notes)
        .where(
          and(
            eq(notes.userId, userId),
            eq(notes.workspaceId, workspaceId),
            isNull(notes.deletedAt)
          )
        ),
      tx
        .select({ projectId: milestones.projectId })
        .from(milestones)
        .where(
          and(eq(milestones.userId, userId), eq(milestones.workspaceId, workspaceId))
        ),
    ]);

    return projRows.map((p) => {
      const pTasks = taskRows.filter(
        (t) => t.projectId === p.id && t.parentTaskId === null && t.status !== "cancelled"
      );
      const completedTasks = pTasks.filter((t) => t.status === "done").length;
      const notesCount = noteRows.filter((n) => n.projectId === p.id).length;
      const milestonesCount = milestoneRows.filter((m) => m.projectId === p.id).length;

      return {
        ...p,
        totalTasks: pTasks.length,
        completedTasks,
        notesCount,
        milestonesCount,
      };
    });
  });
}

export async function getProjectDetails(userId: string, projectId: string) {
  return withUserRls(userId, async (tx) => {
    const rows = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    const project = rows[0];
    if (!project) {
      throw new ProjectServiceError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    const [projectTasks, projectNotes, projectMilestones, recentActivity] =
      await Promise.all([
        tx
          .select()
          .from(tasks)
          .where(and(eq(tasks.projectId, projectId), eq(tasks.userId, userId)))
          .orderBy(asc(tasks.sortOrder), desc(tasks.createdAt)),
        tx
          .select({
            id: notes.id,
            title: notes.title,
            icon: notes.icon,
            updatedAt: notes.updatedAt,
          })
          .from(notes)
          .where(
            and(
              eq(notes.projectId, projectId),
              eq(notes.userId, userId),
              isNull(notes.deletedAt)
            )
          )
          .orderBy(desc(notes.updatedAt)),
        tx
          .select()
          .from(milestones)
          .where(and(eq(milestones.projectId, projectId), eq(milestones.userId, userId)))
          .orderBy(asc(milestones.dueDate), asc(milestones.createdAt)),
        tx
          .select()
          .from(activityLogs)
          .where(
            and(
              eq(activityLogs.userId, userId),
              eq(activityLogs.entityType, "project"),
              eq(activityLogs.entityId, projectId)
            )
          )
          .orderBy(desc(activityLogs.createdAt))
          .limit(15),
      ]);

    const milestonesWithProgress = projectMilestones.map((m) => {
      const mTasks = projectTasks.filter(
        (t) => t.milestoneId === m.id && t.status !== "cancelled"
      );
      const doneCount = mTasks.filter((t) => t.status === "done").length;
      const progress = mTasks.length > 0 ? Math.round((doneCount / mTasks.length) * 100) : 0;
      return {
        ...m,
        totalTasks: mTasks.length,
        completedTasks: doneCount,
        progress,
      };
    });

    return {
      project,
      tasks: projectTasks,
      notes: projectNotes,
      milestones: milestonesWithProgress,
      recentActivity,
    };
  });
}

export async function createProject(
  userId: string,
  workspaceId: string,
  input: CreateProjectInput
): Promise<ProjectRecord> {
  const created = await withUserRls(userId, async (tx) => {
    const status = input.status ?? "active";
    const [inserted] = await tx
      .insert(projects)
      .values({
        userId,
        workspaceId,
        name: input.name,
        description: input.description ?? null,
        icon: input.icon ?? "FolderKanban",
        color: input.color ?? "#3b82f6",
        status,
        priority: input.priority ?? "medium",
        startDate: input.startDate ? new Date(input.startDate) : null,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        completedAt: status === "completed" ? new Date() : null,
      })
      .returning();

    if (!inserted) {
      throw new ProjectServiceError(500, "CREATE_FAILED", "Failed to create project");
    }
    return inserted;
  });

  await recordActivity({
    userId,
    workspaceId,
    entityType: "project",
    entityId: created.id,
    action: "project.created",
    payload: { name: created.name },
  });

  return created;
}

export async function updateProject(
  userId: string,
  projectId: string,
  input: UpdateProjectInput
): Promise<ProjectRecord> {
  const updated = await withUserRls(userId, async (tx) => {
    const existingRows = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    const existing = existingRows[0];
    if (!existing) {
      throw new ProjectServiceError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    const nextStatus = input.status ?? existing.status;
    const becomingCompleted =
      existing.status !== "completed" && nextStatus === "completed";

    const [saved] = await tx
      .update(projects)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.startDate !== undefined
          ? { startDate: input.startDate ? new Date(input.startDate) : null }
          : {}),
        ...(input.targetDate !== undefined
          ? { targetDate: input.targetDate ? new Date(input.targetDate) : null }
          : {}),
        ...(becomingCompleted ? { completedAt: new Date() } : {}),
        ...(input.status !== undefined && input.status !== "completed"
          ? { completedAt: null }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning();

    if (!saved) {
      throw new ProjectServiceError(500, "UPDATE_FAILED", "Failed to update project");
    }
    return saved;
  });

  await recordActivity({
    userId,
    workspaceId: updated.workspaceId,
    entityType: "project",
    entityId: updated.id,
    action: "project.updated",
    payload: { name: updated.name, status: updated.status },
  });

  return updated;
}

export async function deleteProject(userId: string, projectId: string): Promise<void> {
  await withUserRls(userId, async (tx) => {
    const rows = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    if (!rows[0]) {
      throw new ProjectServiceError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    await tx
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  });
}

export async function createMilestone(
  userId: string,
  workspaceId: string,
  projectId: string,
  input: CreateMilestoneInput
): Promise<MilestoneRecord> {
  return withUserRls(userId, async (tx) => {
    const projRows = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    if (!projRows[0]) {
      throw new ProjectServiceError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    const [created] = await tx
      .insert(milestones)
      .values({
        userId,
        workspaceId,
        projectId,
        name: input.name,
        description: input.description ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: input.status ?? "planned",
      })
      .returning();

    if (!created) {
      throw new ProjectServiceError(500, "CREATE_FAILED", "Failed to create milestone");
    }
    return created;
  });
}

export async function updateMilestone(
  userId: string,
  milestoneId: string,
  input: UpdateMilestoneInput
): Promise<MilestoneRecord> {
  return withUserRls(userId, async (tx) => {
    const existingRows = await tx
      .select()
      .from(milestones)
      .where(and(eq(milestones.id, milestoneId), eq(milestones.userId, userId)))
      .limit(1);

    if (!existingRows[0]) {
      throw new ProjectServiceError(404, "MILESTONE_NOT_FOUND", "Milestone not found");
    }

    const [updated] = await tx
      .update(milestones)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.dueDate !== undefined
          ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(milestones.id, milestoneId), eq(milestones.userId, userId)))
      .returning();

    if (!updated) {
      throw new ProjectServiceError(500, "UPDATE_FAILED", "Failed to update milestone");
    }
    return updated;
  });
}

export async function deleteMilestone(userId: string, milestoneId: string): Promise<void> {
  await withUserRls(userId, async (tx) => {
    const existingRows = await tx
      .select({ id: milestones.id })
      .from(milestones)
      .where(and(eq(milestones.id, milestoneId), eq(milestones.userId, userId)))
      .limit(1);

    if (!existingRows[0]) {
      throw new ProjectServiceError(404, "MILESTONE_NOT_FOUND", "Milestone not found");
    }

    await tx
      .delete(milestones)
      .where(and(eq(milestones.id, milestoneId), eq(milestones.userId, userId)));
  });
}
