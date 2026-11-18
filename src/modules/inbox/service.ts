import { and, desc, eq } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  inboxItems,
  notes,
  projects,
  tasks,
  type InboxItemRecord,
} from "@/db/schema";
import { recordActivity } from "@/modules/activity/service";
import { recalculateProjectProgressTx } from "@/modules/projects/progress";
import type {
  ConvertInboxItemInput,
  CreateInboxItemInput,
  UpdateInboxItemInput,
} from "./schemas";

export class InboxServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export async function listInboxItems(
  userId: string,
  workspaceId: string,
  statusFilter?: string
): Promise<InboxItemRecord[]> {
  return withUserRls(userId, async (tx) => {
    const conditions = [
      eq(inboxItems.userId, userId),
      eq(inboxItems.workspaceId, workspaceId),
    ];

    if (
      statusFilter === "pending" ||
      statusFilter === "processed" ||
      statusFilter === "archived"
    ) {
      conditions.push(eq(inboxItems.status, statusFilter));
    }

    return tx
      .select()
      .from(inboxItems)
      .where(and(...conditions))
      .orderBy(desc(inboxItems.createdAt));
  });
}

export async function createInboxItem(
  userId: string,
  workspaceId: string,
  input: CreateInboxItemInput
): Promise<InboxItemRecord> {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(inboxItems)
      .values({
        userId,
        workspaceId,
        type: input.type,
        title: input.title || null,
        content: input.content,
        url: input.url ? input.url : null,
        status: "pending",
      })
      .returning();

    if (!created) {
      throw new InboxServiceError(500, "CREATE_FAILED", "Failed to capture inbox item");
    }
    return created;
  });
}

export async function updateInboxItem(
  userId: string,
  itemId: string,
  input: UpdateInboxItemInput
): Promise<InboxItemRecord> {
  return withUserRls(userId, async (tx) => {
    const existingRows = await tx
      .select()
      .from(inboxItems)
      .where(and(eq(inboxItems.id, itemId), eq(inboxItems.userId, userId)))
      .limit(1);

    if (!existingRows[0]) {
      throw new InboxServiceError(404, "INBOX_NOT_FOUND", "Inbox item not found");
    }

    const [updated] = await tx
      .update(inboxItems)
      .set({
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.url !== undefined ? { url: input.url || null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(inboxItems.id, itemId), eq(inboxItems.userId, userId)))
      .returning();

    if (!updated) {
      throw new InboxServiceError(500, "UPDATE_FAILED", "Failed to update inbox item");
    }
    return updated;
  });
}

export async function deleteInboxItem(userId: string, itemId: string): Promise<void> {
  await withUserRls(userId, async (tx) => {
    const rows = await tx
      .select({ id: inboxItems.id })
      .from(inboxItems)
      .where(and(eq(inboxItems.id, itemId), eq(inboxItems.userId, userId)))
      .limit(1);

    if (!rows[0]) {
      throw new InboxServiceError(404, "INBOX_NOT_FOUND", "Inbox item not found");
    }

    await tx
      .delete(inboxItems)
      .where(and(eq(inboxItems.id, itemId), eq(inboxItems.userId, userId)));
  });
}

export async function convertInboxItem(
  userId: string,
  workspaceId: string,
  itemId: string,
  input: ConvertInboxItemInput
): Promise<{ item: InboxItemRecord; convertedId: string; targetType: "note" | "task" }> {
  const result = await withUserRls(userId, async (tx) => {
    const rows = await tx
      .select()
      .from(inboxItems)
      .where(and(eq(inboxItems.id, itemId), eq(inboxItems.userId, userId)))
      .limit(1);

    const item = rows[0];
    if (!item) {
      throw new InboxServiceError(404, "INBOX_NOT_FOUND", "Inbox item not found");
    }

    // Idempotent guard against duplicate conversions
    if (item.status === "processed" && item.convertedToId && item.convertedToType) {
      return {
        item,
        convertedId: item.convertedToId,
        targetType: item.convertedToType === "note" ? ("note" as const) : ("task" as const),
      };
    }

    if (input.projectId) {
      const proj = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.userId, userId)))
        .limit(1);
      if (!proj[0]) {
        throw new InboxServiceError(400, "INVALID_PROJECT", "Project not found");
      }
    }

    let convertedId: string;
    const derivedTitle =
      item.title?.trim() || item.content.split("\n")[0]?.slice(0, 120) || "Captured item";

    if (input.targetType === "note") {
      const contentText = item.url ? `${item.content}\n\nSource: ${item.url}` : item.content;
      const [createdNote] = await tx
        .insert(notes)
        .values({
          userId,
          workspaceId,
          projectId: input.projectId ?? null,
          title: derivedTitle,
          icon: "FileText",
          contentJson: {
            version: 1,
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: contentText }],
              },
            ],
          },
          contentText,
        })
        .returning({ id: notes.id });

      if (!createdNote) {
        throw new InboxServiceError(500, "CONVERT_FAILED", "Failed to create note");
      }
      convertedId = createdNote.id;
    } else {
      const description = item.url ? `${item.content}\n\nURL: ${item.url}` : item.content;
      const [createdTask] = await tx
        .insert(tasks)
        .values({
          userId,
          workspaceId,
          projectId: input.projectId ?? null,
          title: derivedTitle,
          description: description !== derivedTitle ? description : null,
          status: "todo",
          priority: "medium",
        })
        .returning({ id: tasks.id });

      if (!createdTask) {
        throw new InboxServiceError(500, "CONVERT_FAILED", "Failed to create task");
      }
      convertedId = createdTask.id;
      await recalculateProjectProgressTx(tx, userId, input.projectId);
    }

    const [updatedItem] = await tx
      .update(inboxItems)
      .set({
        status: "processed",
        convertedToType: input.targetType,
        convertedToId: convertedId,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(inboxItems.id, itemId), eq(inboxItems.userId, userId)))
      .returning();

    if (!updatedItem) {
      throw new InboxServiceError(500, "CONVERT_FAILED", "Failed to update inbox item");
    }

    return { item: updatedItem, convertedId, targetType: input.targetType };
  });

  await recordActivity({
    userId,
    workspaceId,
    entityType: result.targetType,
    entityId: result.convertedId,
    action: `inbox.converted_to_${result.targetType}`,
    payload: { inboxItemId: itemId },
  });

  return result;
}
