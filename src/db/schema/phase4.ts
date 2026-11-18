import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { entityTypeEnum } from "./enums";
import { notes, projects } from "./core-phase2";
import { users } from "./users";
import { workspaces } from "./workspaces";

// =============================================================================
// BOOKMARKS & DIGITAL LIBRARY
// =============================================================================

export const bookmarkCollections = pgTable(
  "bookmark_collections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon").notNull().default("Folder"),
    color: text("color").notNull().default("#f97316"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("bookmark_collections_user_idx").on(table.userId, table.workspaceId),
    index("bookmark_collections_parent_idx").on(table.parentId),
  ]
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    domain: text("domain").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    faviconUrl: text("favicon_url"),
    resourceType: text("resource_type").notNull().default("website"),
    collectionId: uuid("collection_id").references(() => bookmarkCollections.id, {
      onDelete: "set null",
    }),
    readingStatus: text("reading_status").notNull().default("unread"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("bookmarks_user_workspace_idx").on(table.userId, table.workspaceId),
    index("bookmarks_collection_idx").on(table.collectionId),
    index("bookmarks_status_idx").on(table.userId, table.readingStatus),
    uniqueIndex("bookmarks_workspace_canonical_uidx").on(
      table.workspaceId,
      table.canonicalUrl
    ),
  ]
);

// =============================================================================
// DEVELOPER HUB (SNIPPETS, COMMANDS, REFERENCES, GITHUB)
// =============================================================================

export const developerCategories = pgTable(
  "developer_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("developer_categories_user_idx").on(table.userId, table.workspaceId),
  ]
);

export const developerSnippets = pgTable(
  "developer_snippets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    language: text("language").notNull().default("typescript"),
    code: text("code").notNull(),
    categoryId: uuid("category_id").references(() => developerCategories.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    sourceNoteId: uuid("source_note_id").references(() => notes.id, {
      onDelete: "set null",
    }),
    isFavorite: boolean("is_favorite").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("developer_snippets_user_idx").on(table.userId, table.workspaceId),
    index("developer_snippets_lang_idx").on(table.userId, table.language),
    index("developer_snippets_project_idx").on(table.projectId),
  ]
);

export const developerCommands = pgTable(
  "developer_commands",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    command: text("command").notNull(),
    platform: text("platform").notNull().default("linux"),
    categoryId: uuid("category_id").references(() => developerCategories.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("developer_commands_user_idx").on(table.userId, table.workspaceId),
    index("developer_commands_platform_idx").on(table.userId, table.platform),
  ]
);

export const developerReferences = pgTable(
  "developer_references",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    technology: text("technology").notNull(),
    versionLabel: text("version_label"),
    categoryId: uuid("category_id").references(() => developerCategories.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("developer_references_user_idx").on(table.userId, table.workspaceId),
  ]
);

export const githubConnections = pgTable(
  "github_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    githubAccountId: text("github_account_id").notNull(),
    accountLogin: text("account_login").notNull(),
    avatarUrl: text("avatar_url"),
    encryptedToken: text("encrypted_token").notNull(),
    scopes: text("scopes").notNull().default(""),
    connectionMetadata: jsonb("connection_metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("github_connections_user_workspace_uidx").on(
      table.userId,
      table.workspaceId
    ),
  ]
);

export const projectRepositories = pgTable(
  "project_repositories",
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
    repositoryIdentifier: text("repository_identifier").notNull(),
    repositoryUrl: text("repository_url").notNull(),
    defaultBranch: text("default_branch").notNull().default("main"),
    language: text("language"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("project_repositories_unique_uidx").on(
      table.projectId,
      table.repositoryIdentifier
    ),
    index("project_repositories_user_idx").on(table.userId),
  ]
);

// =============================================================================
// KNOWLEDGE GRAPH PREFERENCES & POSITIONS
// =============================================================================

export interface GraphLayoutConfig {
  chargeStrength?: number;
  linkDistance?: number;
  includeTasks?: boolean;
}

export interface GraphFilterConfig {
  entityTypes?: string[];
  favoritesOnly?: boolean;
}

export const graphPreferences = pgTable(
  "graph_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    layoutConfig: jsonb("layout_config")
      .$type<GraphLayoutConfig>()
      .notNull()
      .default({ chargeStrength: 240, linkDistance: 95, includeTasks: false }),
    filterConfig: jsonb("filter_config")
      .$type<GraphFilterConfig>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("graph_preferences_user_workspace_uidx").on(
      table.userId,
      table.workspaceId
    ),
  ]
);

export const graphNodePositions = pgTable(
  "graph_node_positions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    positionX: doublePrecision("position_x").notNull(),
    positionY: doublePrecision("position_y").notNull(),
    isPinned: boolean("is_pinned").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("graph_node_positions_unique_uidx").on(
      table.userId,
      table.entityType,
      table.entityId
    ),
  ]
);

export type BookmarkCollectionRecord = typeof bookmarkCollections.$inferSelect;
export type BookmarkRecord = typeof bookmarks.$inferSelect;
export type DeveloperCategoryRecord = typeof developerCategories.$inferSelect;
export type DeveloperSnippetRecord = typeof developerSnippets.$inferSelect;
export type DeveloperCommandRecord = typeof developerCommands.$inferSelect;
export type DeveloperReferenceRecord = typeof developerReferences.$inferSelect;
export type GithubConnectionRecord = typeof githubConnections.$inferSelect;
export type ProjectRepositoryRecord = typeof projectRepositories.$inferSelect;
export type GraphPreferenceRecord = typeof graphPreferences.$inferSelect;
export type GraphNodePositionRecord = typeof graphNodePositions.$inferSelect;
