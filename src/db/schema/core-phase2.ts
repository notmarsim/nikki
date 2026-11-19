import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  entityTypeEnum,
  inboxStatusEnum,
  milestoneStatusEnum,
  priorityEnum,
  projectStatusEnum,
  recurrenceFrequencyEnum,
  taskStatusEnum,
} from "./enums";
import { tags } from "./relations";
import { users } from "./users";
import { workspaces } from "./workspaces";

export interface NoteBlockDocument {
  version: 1;
  type: "doc";
  content: NoteBlockNode[];
}

export interface NoteBlockNode {
  id?: string;
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
    completedAt: timestamp("completed_at", { withTimezone: true }),
    progress: integer("progress").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("projects_workspace_status_idx").on(table.workspaceId, table.status),
    index("projects_user_id_idx").on(table.userId),
  ]
);

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    status: milestoneStatusEnum("status").notNull().default("planned"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("milestones_project_id_idx").on(table.projectId),
    index("milestones_user_id_idx").on(table.userId),
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
    coverPath: text("cover_path"),
    contentJson: jsonb("content_json")
      .$type<NoteBlockDocument>()
      .notNull()
      .default({ version: 1, type: "doc", content: [] }),
    contentText: text("content_text").notNull().default(""),
    isFavorite: boolean("is_favorite").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    docKind: text("doc_kind").notNull().default("note"),
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("notes_workspace_parent_idx").on(table.workspaceId, table.parentId),
    index("notes_project_id_idx").on(table.projectId),
    index("notes_user_id_idx").on(table.userId),
  ]
);

export const noteLinks = pgTable(
  "note_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceNoteId: uuid("source_note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    targetNoteId: uuid("target_note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("note_links_source_target_uidx").on(
      table.sourceNoteId,
      table.targetNoteId
    ),
    index("note_links_target_idx").on(table.targetNoteId),
    index("note_links_user_idx").on(table.userId),
  ]
);

export const noteAttachments = pgTable(
  "note_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull().unique(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("note_attachments_note_idx").on(table.noteId),
    index("note_attachments_user_idx").on(table.userId),
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
    milestoneId: uuid("milestone_id").references(() => milestones.id, {
      onDelete: "set null",
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
    sortOrder: integer("sort_order").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archiveAfter: timestamp("archive_after", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("tasks_workspace_status_idx").on(table.workspaceId, table.status),
    index("tasks_project_id_idx").on(table.projectId),
    index("tasks_milestone_id_idx").on(table.milestoneId),
    index("tasks_due_at_idx").on(table.dueAt),
    index("tasks_user_id_idx").on(table.userId),
  ]
);

export const taskTags = pgTable(
  "task_tags",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.tagId] }),
    index("task_tags_tag_idx").on(table.tagId),
  ]
);

export const taskRecurrenceRules = pgTable(
  "task_recurrence_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .unique()
      .references(() => tasks.id, { onDelete: "cascade" }),
    frequency: recurrenceFrequencyEnum("frequency").notNull(),
    interval: integer("interval").notNull().default(1),
    nextOccurrenceAt: timestamp("next_occurrence_at", { withTimezone: true }).notNull(),
    lastGeneratedAt: timestamp("last_generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("task_recurrence_user_idx").on(table.userId)]
);

export const taskComments = pgTable(
  "task_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("task_comments_task_idx").on(table.taskId),
    index("task_comments_user_idx").on(table.userId),
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
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("inbox_items_workspace_status_idx").on(table.workspaceId, table.status),
    index("inbox_items_user_id_idx").on(table.userId),
  ]
);

export type ProjectRecord = typeof projects.$inferSelect;
export type MilestoneRecord = typeof milestones.$inferSelect;
export type NoteRecord = typeof notes.$inferSelect;
export type NoteLinkRecord = typeof noteLinks.$inferSelect;
export type NoteAttachmentRecord = typeof noteAttachments.$inferSelect;
export type TaskRecord = typeof tasks.$inferSelect;
export type TaskCommentRecord = typeof taskComments.$inferSelect;
export type TaskRecurrenceRuleRecord = typeof taskRecurrenceRules.$inferSelect;
export type InboxItemRecord = typeof inboxItems.$inferSelect;
