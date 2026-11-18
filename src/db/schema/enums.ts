import { pgEnum } from "drizzle-orm/pg-core";

export const themeEnum = pgEnum("theme", ["light", "dark", "system"]);

export const entityTypeEnum = pgEnum("entity_type", [
  "note",
  "task",
  "project",
  "inbox_item",
  "course",
  "bookmark",
  "event",
  "habit",
  "snippet",
]);

export const relationTypeEnum = pgEnum("relation_type", [
  "references",
  "belongs_to",
  "blocks",
  "derived_from",
  "related_to",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
]);

export const priorityEnum = pgEnum("priority", [
  "none",
  "low",
  "medium",
  "high",
  "urgent",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "active",
  "on_hold",
  "completed",
  "archived",
]);

export const milestoneStatusEnum = pgEnum("milestone_status", [
  "planned",
  "active",
  "completed",
  "cancelled",
]);

export const recurrenceFrequencyEnum = pgEnum("recurrence_frequency", [
  "daily",
  "weekly",
  "monthly",
]);

export const inboxStatusEnum = pgEnum("inbox_status", [
  "pending",
  "processed",
  "archived",
]);
