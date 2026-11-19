import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  archiveProjectManually,
  archiveTasksManually,
  emptyUserTrash,
  listArchivedProjects,
  listArchivedTasks,
  listTrashItems,
  moveTasksToTrash,
  permanentDeleteProjects,
  permanentDeleteTasks,
  previewRetentionImpact,
  restoreProjects,
  restoreTasks,
} from "@/modules/archive/service";
import { getProjectDetails } from "@/modules/projects/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("archive_tasks"), ids: z.array(z.string().uuid()).min(1).max(200) }),
  z.object({ action: z.literal("restore_tasks"), ids: z.array(z.string().uuid()).min(1).max(200), fromTrash: z.boolean().optional() }),
  z.object({ action: z.literal("trash_tasks"), ids: z.array(z.string().uuid()).min(1).max(200) }),
  z.object({ action: z.literal("delete_tasks_permanent"), ids: z.array(z.string().uuid()).min(1).max(200) }),
  z.object({ action: z.literal("archive_project"), projectId: z.string().uuid() }),
  z.object({ action: z.literal("restore_projects"), ids: z.array(z.string().uuid()).min(1).max(100), fromTrash: z.boolean().optional() }),
  z.object({ action: z.literal("delete_projects_permanent"), ids: z.array(z.string().uuid()).min(1).max(100) }),
  z.object({ action: z.literal("empty_trash") }),
  z.object({ action: z.literal("retention_preview"), years: z.enum(["forever", "1", "2", "5"]) }),
]);

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") ?? "tasks";
  const projectId = searchParams.get("projectId") ?? "";

  if (tab === "project_detail" && projectId) {
    try {
      const details = await getProjectDetails(session.user.id, projectId);
      return apiOk(details);
    } catch {
      return apiError(404, "NOT_FOUND", "Archived project not found");
    }
  }

  if (tab === "projects") {
    const data = await listArchivedProjects(
      session.user.id,
      workspace.id,
      searchParams.get("q") ?? "",
      Number(searchParams.get("page") ?? 1)
    );
    return apiOk(data);
  }

  if (tab === "trash") {
    const data = await listTrashItems(session.user.id, workspace.id);
    return apiOk(data);
  }

  const data = await listArchivedTasks(session.user.id, workspace.id, {
    q: searchParams.get("q") ?? undefined,
    projectId: searchParams.get("projectId") || undefined,
    priority: searchParams.get("priority") || undefined,
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    sortBy: searchParams.get("sortBy") === "completedAt" ? "completedAt" : "archivedAt",
    page: Number(searchParams.get("page") ?? 1),
  });
  return apiOk(data);
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid archive action payload");
  }

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const d = parsed.data;

  switch (d.action) {
    case "archive_tasks":
      return apiOk(await archiveTasksManually(session.user.id, d.ids));
    case "restore_tasks":
      return apiOk(await restoreTasks(session.user.id, d.ids, d.fromTrash ?? false));
    case "trash_tasks":
      return apiOk(await moveTasksToTrash(session.user.id, d.ids));
    case "delete_tasks_permanent":
      return apiOk(await permanentDeleteTasks(session.user.id, d.ids));
    case "archive_project":
      return apiOk({ project: await archiveProjectManually(session.user.id, d.projectId) });
    case "restore_projects":
      return apiOk(await restoreProjects(session.user.id, d.ids, d.fromTrash ?? false));
    case "delete_projects_permanent":
      return apiOk(await permanentDeleteProjects(session.user.id, d.ids));
    case "empty_trash":
      return apiOk(await emptyUserTrash(session.user.id, workspace.id));
    case "retention_preview":
      return apiOk(await previewRetentionImpact(session.user.id, d.years));
  }
}
