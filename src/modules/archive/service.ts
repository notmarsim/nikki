import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { withUserRls } from "@/db/rls";
import { projects, tasks, users, userSettings } from "@/db/schema";
import { mergeUserPreferences } from "@/modules/settings/registry";
import { computeWeekEndUtc } from "./week";

export interface ArchiveTaskFilters {
  q?: string;
  projectId?: string;
  priority?: string;
  from?: string;
  to?: string;
  sortBy?: "completedAt" | "archivedAt";
  page?: number;
  pageSize?: number;
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function listArchivedTasks(
  userId: string,
  workspaceId: string,
  filters: ArchiveTaskFilters = {}
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  return withUserRls(userId, async (tx) => {
    const conditions = [
      eq(tasks.userId, userId),
      eq(tasks.workspaceId, workspaceId),
      isNotNull(tasks.archivedAt),
      isNull(tasks.deletedAt),
    ];

    if (filters.q?.trim()) {
      const pattern = `%${filters.q.trim()}%`;
      conditions.push(or(ilike(tasks.title, pattern), ilike(tasks.description, pattern))!);
    }
    if (filters.projectId) {
      conditions.push(eq(tasks.projectId, filters.projectId));
    }
    if (filters.priority) {
      conditions.push(eq(tasks.priority, filters.priority as typeof tasks.priority._.data));
    }
    if (filters.from) {
      conditions.push(gte(tasks.completedAt, new Date(filters.from)));
    }
    if (filters.to) {
      conditions.push(lte(tasks.completedAt, new Date(`${filters.to}T23:59:59.999Z`)));
    }

    const orderCol =
      filters.sortBy === "completedAt" ? desc(tasks.completedAt) : desc(tasks.archivedAt);

    const [rows, countRes, projectRows] = await Promise.all([
      tx
        .select()
        .from(tasks)
        .where(and(...conditions))
        .orderBy(orderCol, desc(tasks.createdAt))
        .limit(pageSize)
        .offset(offset),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(and(...conditions)),
      tx
        .select({ id: projects.id, name: projects.name, color: projects.color })
        .from(projects)
        .where(and(eq(projects.userId, userId), eq(projects.workspaceId, workspaceId))),
    ]);

    const projectMap = new Map(projectRows.map((p) => [p.id, p]));
    const total = countRes[0]?.count ?? 0;

    return {
      items: rows.map((r) => ({
        ...r,
        projectName: r.projectId ? projectMap.get(r.projectId)?.name ?? null : null,
        projectColor: r.projectId ? projectMap.get(r.projectId)?.color ?? null : null,
      })),
      projects: projectRows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  });
}

export async function listArchivedProjects(
  userId: string,
  workspaceId: string,
  q = "",
  page = 1,
  pageSize = 25
) {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(50, Math.max(1, pageSize));
  const offset = (safePage - 1) * safeSize;

  return withUserRls(userId, async (tx) => {
    const conditions = [
      eq(projects.userId, userId),
      eq(projects.workspaceId, workspaceId),
      isNotNull(projects.archivedAt),
      isNull(projects.deletedAt),
    ];
    if (q.trim()) {
      const pattern = `%${q.trim()}%`;
      conditions.push(or(ilike(projects.name, pattern), ilike(projects.description, pattern))!);
    }

    const [projRows, countRes, taskStats] = await Promise.all([
      tx
        .select()
        .from(projects)
        .where(and(...conditions))
        .orderBy(desc(projects.archivedAt))
        .limit(safeSize)
        .offset(offset),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(projects)
        .where(and(...conditions)),
      tx
        .select({
          projectId: tasks.projectId,
          status: tasks.status,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.workspaceId, workspaceId),
            isNull(tasks.deletedAt)
          )
        ),
    ]);

    const total = countRes[0]?.count ?? 0;

    return {
      items: projRows.map((p) => {
        const pTasks = taskStats.filter((t) => t.projectId === p.id);
        const completedCount = pTasks.filter((t) => t.status === "done").length;
        return {
          ...p,
          totalTasks: pTasks.length,
          completedTasks: completedCount,
        };
      }),
      total,
      page: safePage,
      pageSize: safeSize,
      totalPages: Math.max(1, Math.ceil(total / safeSize)),
    };
  });
}

export async function listTrashItems(userId: string, workspaceId: string) {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  return withUserRls(userId, async (tx) => {
    const [deletedTasks, deletedProjects] = await Promise.all([
      tx
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.workspaceId, workspaceId),
            isNotNull(tasks.deletedAt)
          )
        )
        .orderBy(desc(tasks.deletedAt))
        .limit(100),
      tx
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.userId, userId),
            eq(projects.workspaceId, workspaceId),
            isNotNull(projects.deletedAt)
          )
        )
        .orderBy(desc(projects.deletedAt))
        .limit(100),
    ]);

    const calcDaysRemaining = (deletedAt: Date | null) => {
      if (!deletedAt) return 30;
      const purgeAt = deletedAt.getTime() + thirtyDaysMs;
      return Math.max(0, Math.ceil((purgeAt - now) / (24 * 60 * 60 * 1000)));
    };

    return {
      tasks: deletedTasks.map((t) => ({
        ...t,
        daysRemaining: calcDaysRemaining(t.deletedAt),
      })),
      projects: deletedProjects.map((p) => ({
        ...p,
        daysRemaining: calcDaysRemaining(p.deletedAt),
      })),
    };
  });
}

export async function archiveTasksManually(userId: string, taskIds: string[]) {
  if (taskIds.length === 0) return { count: 0 };
  const now = new Date();
  return withUserRls(userId, async (tx) => {
    const updated = await tx
      .update(tasks)
      .set({ archivedAt: now, updatedAt: now })
      .where(and(eq(tasks.userId, userId), inArray(tasks.id, taskIds), isNull(tasks.deletedAt)))
      .returning({ id: tasks.id });
    return { count: updated.length };
  });
}

export async function restoreTasks(userId: string, taskIds: string[], fromTrash = false) {
  if (taskIds.length === 0) return { count: 0 };
  const now = new Date();
  return withUserRls(userId, async (tx) => {
    const updated = await tx
      .update(tasks)
      .set({
        ...(fromTrash ? { deletedAt: null } : { archivedAt: null, archiveAfter: null }),
        updatedAt: now,
      })
      .where(and(eq(tasks.userId, userId), inArray(tasks.id, taskIds)))
      .returning({ id: tasks.id });
    return { count: updated.length };
  });
}

export async function moveTasksToTrash(userId: string, taskIds: string[]) {
  if (taskIds.length === 0) return { count: 0 };
  const now = new Date();
  return withUserRls(userId, async (tx) => {
    const updated = await tx
      .update(tasks)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(tasks.userId, userId), inArray(tasks.id, taskIds)))
      .returning({ id: tasks.id });
    return { count: updated.length };
  });
}

export async function permanentDeleteTasks(userId: string, taskIds: string[]) {
  if (taskIds.length === 0) return { count: 0 };
  return withUserRls(userId, async (tx) => {
    const deleted = await tx
      .delete(tasks)
      .where(and(eq(tasks.userId, userId), inArray(tasks.id, taskIds)))
      .returning({ id: tasks.id });
    return { count: deleted.length };
  });
}

export async function archiveProjectManually(userId: string, projectId: string) {
  const now = new Date();
  return withUserRls(userId, async (tx) => {
    const [updated] = await tx
      .update(projects)
      .set({ archivedAt: now, updatedAt: now })
      .where(and(eq(projects.userId, userId), eq(projects.id, projectId), isNull(projects.deletedAt)))
      .returning();
    return updated ?? null;
  });
}

export async function restoreProjects(userId: string, projectIds: string[], fromTrash = false) {
  if (projectIds.length === 0) return { count: 0 };
  const now = new Date();
  return withUserRls(userId, async (tx) => {
    const updated = await tx
      .update(projects)
      .set({
        ...(fromTrash ? { deletedAt: null } : { archivedAt: null }),
        updatedAt: now,
      })
      .where(and(eq(projects.userId, userId), inArray(projects.id, projectIds)))
      .returning({ id: projects.id });
    return { count: updated.length };
  });
}

export async function permanentDeleteProjects(userId: string, projectIds: string[]) {
  if (projectIds.length === 0) return { count: 0 };
  return withUserRls(userId, async (tx) => {
    await tx
      .update(tasks)
      .set({ projectId: null, updatedAt: new Date() })
      .where(and(eq(tasks.userId, userId), inArray(tasks.projectId, projectIds), isNull(tasks.deletedAt)));
    const deleted = await tx
      .delete(projects)
      .where(and(eq(projects.userId, userId), inArray(projects.id, projectIds)))
      .returning({ id: projects.id });
    return { count: deleted.length };
  });
}

export async function emptyUserTrash(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    const delTasks = await tx
      .delete(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.workspaceId, workspaceId),
          isNotNull(tasks.deletedAt)
        )
      )
      .returning({ id: tasks.id });

    const delProjects = await tx
      .delete(projects)
      .where(
        and(
          eq(projects.userId, userId),
          eq(projects.workspaceId, workspaceId),
          isNotNull(projects.deletedAt)
        )
      )
      .returning({ id: projects.id });

    return { deletedTasks: delTasks.length, deletedProjects: delProjects.length };
  });
}

export async function previewRetentionImpact(userId: string, years: "forever" | "1" | "2" | "5") {
  if (years === "forever") return { affectedTasks: 0 };
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - Number(years));

  return withUserRls(userId, async (tx) => {
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          isNotNull(tasks.archivedAt),
          isNull(tasks.deletedAt),
          lte(tasks.archivedAt, cutoff)
        )
      );
    return { affectedTasks: row?.count ?? 0 };
  });
}

export async function recalculatePendingArchiveAfterForUser(userId: string) {
  return withUserRls(userId, async (tx) => {
    const [userRows, settingsRows, pendingTasks] = await Promise.all([
      tx.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1),
      tx
        .select({ preferences: userSettings.preferences })
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1),
      tx
        .select({ id: tasks.id, completedAt: tasks.completedAt })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.status, "done"),
            isNull(tasks.archivedAt),
            isNull(tasks.deletedAt),
            isNotNull(tasks.completedAt)
          )
        ),
    ]);

    const tz = userRows[0]?.timezone ?? "UTC";
    const prefs = mergeUserPreferences(settingsRows[0]?.preferences);

    for (const t of pendingTasks) {
      if (!t.completedAt) continue;
      const archiveAfter = computeWeekEndUtc(t.completedAt, tz, prefs.weekStartsOn);
      await tx
        .update(tasks)
        .set({ archiveAfter })
        .where(and(eq(tasks.id, t.id), eq(tasks.userId, userId)));
    }
    return { recalculated: pendingTasks.length };
  });
}

export async function runGlobalArchiveJob() {
  const res = await db.execute<{
    archived_tasks: number;
    purged_tasks: number;
    purged_projects: number;
    retention_purged_tasks: number;
  }>(sql`SELECT * FROM public.nikki_run_archive_and_retention_job()`);
  return res[0] ?? {
    archived_tasks: 0,
    purged_tasks: 0,
    purged_projects: 0,
    retention_purged_tasks: 0,
  };
}

export async function exportHistoryPayload(
  userId: string,
  workspaceId: string,
  opts: {
    scope: "all" | "completed" | "archived" | "project" | "archived_projects";
    format: "csv" | "json";
    projectId?: string;
  }
) {
  return withUserRls(userId, async (tx) => {
    if (opts.scope === "archived_projects") {
      const rows = await tx
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.userId, userId),
            eq(projects.workspaceId, workspaceId),
            isNotNull(projects.archivedAt),
            isNull(projects.deletedAt)
          )
        )
        .orderBy(desc(projects.archivedAt));

      if (opts.format === "json") {
        return { content: JSON.stringify({ exportedAt: new Date().toISOString(), projects: rows }, null, 2) };
      }
      const header = ["id", "name", "status", "priority", "progress", "completedAt", "archivedAt"].join(",");
      const lines = rows.map((p) =>
        [p.id, p.name, p.status, p.priority, p.progress, p.completedAt?.toISOString() ?? "", p.archivedAt?.toISOString() ?? ""]
          .map(escapeCsvCell)
          .join(",")
      );
      return { content: [header, ...lines].join("\n") };
    }

    const conditions = [
      eq(tasks.userId, userId),
      eq(tasks.workspaceId, workspaceId),
      isNull(tasks.deletedAt),
    ];
    if (opts.scope === "completed") {
      conditions.push(eq(tasks.status, "done"));
    } else if (opts.scope === "archived") {
      conditions.push(isNotNull(tasks.archivedAt));
    } else if (opts.scope === "project" && opts.projectId) {
      conditions.push(eq(tasks.projectId, opts.projectId));
    }

    const rows = await tx
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.createdAt));

    if (opts.format === "json") {
      return { content: JSON.stringify({ exportedAt: new Date().toISOString(), tasks: rows }, null, 2) };
    }

    const header = [
      "id",
      "title",
      "status",
      "priority",
      "projectId",
      "dueAt",
      "completedAt",
      "archivedAt",
      "createdAt",
    ].join(",");
    const lines = rows.map((t) =>
      [
        t.id,
        t.title,
        t.status,
        t.priority,
        t.projectId ?? "",
        t.dueAt?.toISOString() ?? "",
        t.completedAt?.toISOString() ?? "",
        t.archivedAt?.toISOString() ?? "",
        t.createdAt.toISOString(),
      ]
        .map(escapeCsvCell)
        .join(",")
    );
    return { content: [header, ...lines].join("\n") };
  });
}
