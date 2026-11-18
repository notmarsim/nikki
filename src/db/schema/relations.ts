import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { entityTypeEnum, relationTypeEnum } from "./enums";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#64748b"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tags_workspace_name_uidx").on(table.workspaceId, table.name),
    index("tags_user_id_idx").on(table.userId),
  ]
);

export const entityTags = pgTable(
  "entity_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("entity_tags_unique_uidx").on(table.tagId, table.entityType, table.entityId),
    index("entity_tags_entity_idx").on(table.entityType, table.entityId),
  ]
);

export const entityRelations = pgTable(
  "entity_relations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceType: entityTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    targetType: entityTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    relationType: relationTypeEnum("relation_type").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("entity_relations_unique_uidx").on(
      table.sourceType,
      table.sourceId,
      table.targetType,
      table.targetId,
      table.relationType
    ),
    index("entity_relations_source_idx").on(table.sourceType, table.sourceId),
    index("entity_relations_target_idx").on(table.targetType, table.targetId),
    index("entity_relations_user_idx").on(table.userId),
  ]
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("activity_logs_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("activity_logs_entity_idx").on(table.entityType, table.entityId),
  ]
);
