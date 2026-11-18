import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { notes } from "./core-phase2";
import { users } from "./users";
import { workspaces } from "./workspaces";

// =============================================================================
// NIKKI SPACES (MEMBERS & INVITATIONS)
// =============================================================================

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("editor"), // owner|admin|editor|viewer
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workspace_members_ws_user_uidx").on(table.workspaceId, table.userId),
    index("workspace_members_user_idx").on(table.userId),
  ]
);

export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("editor"),
    tokenHash: text("token_hash").notNull().unique(),
    status: text("status").notNull().default("pending"), // pending|accepted|declined|revoked
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("workspace_invites_ws_idx").on(table.workspaceId, table.status)]
);

// =============================================================================
// COLLABORATIVE EDITING (YJS CRDT UPDATES & SNAPSHOTS)
// =============================================================================

export const collaborativeDocuments = pgTable(
  "collaborative_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    noteId: uuid("note_id")
      .notNull()
      .unique()
      .references(() => notes.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    stateBase64: text("state_base64").notNull().default(""),
    revision: integer("revision").notNull().default(0),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("collab_docs_ws_idx").on(table.workspaceId)]
);

export const collaborativeDocumentSnapshots = pgTable(
  "collaborative_document_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull().default("Checkpoint"),
    stateBase64: text("state_base64").notNull(),
    contentText: text("content_text").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("collab_snapshots_note_idx").on(table.noteId, table.createdAt)]
);

// =============================================================================
// GOALS & LIFE AREAS
// =============================================================================

export const lifeAreas = pgTable(
  "life_areas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#3b82f6"),
    icon: text("icon").notNull().default("Compass"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("life_areas_user_idx").on(table.userId, table.workspaceId)]
);

export const lifeGoals = pgTable(
  "life_goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    areaId: uuid("area_id").references(() => lifeAreas.id, { onDelete: "set null" }),
    parentGoalId: uuid("parent_goal_id"),
    title: text("title").notNull(),
    description: text("description"),
    horizon: text("horizon").notNull().default("quarterly"), // weekly|monthly|quarterly|yearly|long_term|custom
    status: text("status").notNull().default("active"), // active|completed|archived
    priority: text("priority").notNull().default("medium"),
    metricSource: text("metric_source").notNull().default("manual"), // manual|tasks|learning|focus|habits
    targetValue: integer("target_value").notNull().default(100),
    currentValue: integer("current_value").notNull().default(0),
    unit: text("unit").notNull().default("%"),
    startDate: text("start_date"),
    targetDate: text("target_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("life_goals_user_idx").on(table.userId, table.status)]
);

// =============================================================================
// NIKKI JOURNAL (PRIVATE BY DEFAULT)
// =============================================================================

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entryDate: text("entry_date").notNull(), // YYYY-MM-DD
    title: text("title"),
    content: text("content").notNull().default(""),
    mood: text("mood"),
    templateKind: text("template_kind").notNull().default("daily"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    isPrivate: boolean("is_private").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("journal_entries_user_date_idx").on(table.userId, table.entryDate)]
);

// =============================================================================
// NIKKI HOME (SHOPPING, INVENTORY, RECIPES, MEAL PLANNING)
// =============================================================================

export const homeShoppingLists = pgTable(
  "home_shopping_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("home_shopping_lists_ws_idx").on(table.workspaceId)]
);

export const homeShoppingItems = pgTable(
  "home_shopping_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listId: uuid("list_id")
      .notNull()
      .references(() => homeShoppingLists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: text("quantity").notNull().default("1"),
    unit: text("unit").notNull().default("un"),
    category: text("category").notNull().default("General"),
    isPurchased: boolean("is_purchased").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("home_shopping_items_list_idx").on(table.listId)]
);

export const homeInventoryItems = pgTable(
  "home_inventory_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull().default("Pantry"),
    quantity: integer("quantity").notNull().default(1),
    minQuantity: integer("min_quantity").notNull().default(0),
    unit: text("unit").notNull().default("un"),
    location: text("location"),
    expiresAt: text("expires_at"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("home_inventory_ws_idx").on(table.workspaceId)]
);

export const homeRecipes = pgTable(
  "home_recipes",
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
    ingredients: jsonb("ingredients")
      .$type<Array<{ name: string; quantity: string; unit: string }>>()
      .notNull()
      .default([]),
    instructions: text("instructions").notNull().default(""),
    prepMinutes: integer("prep_minutes").notNull().default(20),
    servings: integer("servings").notNull().default(2),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("home_recipes_ws_idx").on(table.workspaceId)]
);

export const homeMealPlans = pgTable(
  "home_meal_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    planDate: text("plan_date").notNull(), // YYYY-MM-DD
    mealSlot: text("meal_slot").notNull().default("lunch"), // breakfast|lunch|dinner|snack
    recipeId: uuid("recipe_id").references(() => homeRecipes.id, { onDelete: "set null" }),
    title: text("title").notNull(),
  },
  (table) => [index("home_meal_plans_ws_date_idx").on(table.workspaceId, table.planDate)]
);

// =============================================================================
// DOCUMENT VAULT
// =============================================================================

export const vaultDocuments = pgTable(
  "vault_documents",
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
    category: text("category").notNull().default("other"), // certificate|contract|receipt|warranty|invoice|academic|financial|other
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    expiresAt: text("expires_at"),
    version: integer("version").notNull().default(1),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("vault_docs_user_idx").on(table.userId, table.workspaceId)]
);

// =============================================================================
// FOCUS ROOMS
// =============================================================================

export const focusRooms = pgTable(
  "focus_rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    mode: text("mode").notNull().default("synchronized"), // synchronized|independent
    status: text("status").notNull().default("idle"), // idle|running|paused|break|ended
    focusMinutes: integer("focus_minutes").notNull().default(25),
    breakMinutes: integer("break_minutes").notNull().default(5),
    cycleStartedAt: timestamp("cycle_started_at", { withTimezone: true }),
    inviteCode: text("invite_code").notNull().unique(),
    isPrivate: boolean("is_private").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("focus_rooms_creator_idx").on(table.creatorId)]
);

export const focusRoomMembers = pgTable(
  "focus_room_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => focusRooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    hideActivity: boolean("hide_activity").notNull().default(false),
    statusLabel: text("status_label").notNull().default("Focusing"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("focus_room_members_uidx").on(table.roomId, table.userId)]
);

// =============================================================================
// NIKKI FEED (RSS / ATOM READER)
// =============================================================================

export const feedSources = pgTable(
  "feed_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category").notNull().default("Tech"),
    status: text("status").notNull().default("active"),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("feed_sources_user_idx").on(table.userId)]
);

export const feedEntries = pgTable(
  "feed_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => feedSources.id, { onDelete: "cascade" }),
    guid: text("guid").notNull(),
    title: text("title").notNull(),
    link: text("link").notNull(),
    summary: text("summary").notNull().default(""),
    publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
    isRead: boolean("is_read").notNull().default(false),
    isFavorite: boolean("is_favorite").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("feed_entries_source_guid_uidx").on(table.sourceId, table.guid),
    index("feed_entries_user_idx").on(table.userId, table.publishedAt),
  ]
);

// =============================================================================
// NIKKI TEMPLATES, DIAGNOSTICS & OPS
// =============================================================================

export const nikkiTemplates = pgTable(
  "nikki_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("productivity"), // note|project|study|workspace|home
    isPublic: boolean("is_public").notNull().default(false),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("nikki_templates_author_idx").on(table.authorUserId)]
);

export const diagnosticReports = pgTable(
  "diagnostic_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    appVersion: text("app_version").notNull(),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("diagnostic_reports_user_idx").on(table.userId)]
);

export const applicationErrorEvents = pgTable(
  "application_error_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    module: text("module").notNull(),
    severity: text("severity").notNull().default("error"), // info|warn|error
    message: text("message").notNull(),
    platform: text("platform").notNull().default("web"),
    correlationId: text("correlation_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("app_error_events_created_idx").on(table.createdAt)]
);

export const administrativeAuditEvents = pgTable(
  "administrative_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    targetEntity: text("target_entity"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("admin_audit_events_created_idx").on(table.createdAt)]
);
