import { db } from "@/db";
import { activityLogs } from "@/db/schema";

export type ActivityEntityType =
  | "note"
  | "task"
  | "project"
  | "inbox_item"
  | "event"
  | "course"
  | "habit";

export async function recordActivity(params: {
  userId: string;
  workspaceId: string;
  entityType: ActivityEntityType;
  entityId: string;
  action: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(activityLogs).values({
    userId: params.userId,
    workspaceId: params.workspaceId,
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    payload: params.payload ?? null,
  });
}
