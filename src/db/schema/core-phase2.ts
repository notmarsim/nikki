import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  entityTypeEnum,
  inboxStatusEnum,
  priorityEnum,
  projectStatusEnum,
  taskStatusEnum,
} from "./enums";
import { users } from "./users";
import { workspaces } from "./workspaces";

export interface NoteBlockDocument {
  version: 1;
  type: "doc";
  content: NoteBlockNode[];
}

export interface NoteBlockNode {
  id: string;
  type: string;
  attrs?: Record<string, unknown>;
  content?: NoteBlockNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon").notNull().default("FolderKanban"),
    color: text("color").notNull().default("#3b82f6"),
    status: projectStatusEnum("status").notNull().default("planning"),
    priority: priorityEnum("priority").notNull().default("medium"),
    startDate: timestamp("start_date", { withTimezone: true }),
    targetDate: timestamp("target_date", { withTimezone: true }),
    progress: integer("progress").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("projects_workspace_status_idx").on(table.workspaceId, table.status),
    index("projects_user_id_idx").on(table.userId),
  ]
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => notes.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull().default("Untitled"),
    icon: text("icon").default("FileText"),
    contentJson: jsonb("content_json")
      .$type<NoteBlockDocument>()
      .notNull()
      .default({ version: 1, type: "doc", content: [] }),
    contentText: text("content_text").notNull().default(""),
    isFavorite: boolean("is_favorite").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("notes_workspace_parent_idx").on(table.workspaceId, table.parentId),
    index("notes_project_id_idx").on(table.projectId),
    index("notes_user_id_idx").on(table.userId),
  ]
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    noteId: uuid("note_id").references(() => notes.id, {
      onDelete: "set null",
    }),
    parentTaskId: uuid("parent_task_id").references((): AnyPgColumn => tasks.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("todo"),
    priority: priorityEnum("priority").notNull().default("medium"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    startAt: timestamp("start_at", { withTimezone: true }),
    estimatedMinutes: integer("estimated_minutes"),
    actualMinutes: integer("actual_minutes").notNull().default(0),
    recurrenceRule: text("recurrence_rule"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("tasks_workspace_status_idx").on(table.workspaceId, table.status),
    index("tasks_project_id_idx").on(table.projectId),
    index("tasks_due_at_idx").on(table.dueAt),
    index("tasks_user_id_idx").on(table.userId),
  ]
);

export const inboxItems = pgTable(
  "inbox_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("note"),
    title: text("title"),
    content: text("content").notNull(),
    url: text("url"),
    status: inboxStatusEnum("status").notNull().default("pending"),
    convertedToType: entityTypeEnum("converted_to_type"),
    convertedToId: uuid("converted_to_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("inbox_items_workspace_status_idx").on(table.workspaceId, table.status),
    index("inbox_items_user_id_idx").on(table.userId),
  ]
);

export type ProjectRecord = typeof projects.$inferSelect;
export type NoteRecord = typeof notes.$inferSelect;
export type TaskRecord = typeof tasks.$inferSelect;
export type InboxItemRecord = typeof inboxItems.$inferSelect;
