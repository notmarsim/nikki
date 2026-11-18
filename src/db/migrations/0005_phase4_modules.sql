-- Nikki Phase 4: Knowledge Graph, Bookmarks & Digital Library, Developer Hub & Search Indexes

ALTER TYPE "entity_type" ADD VALUE IF NOT EXISTS 'lesson';
ALTER TYPE "entity_type" ADD VALUE IF NOT EXISTS 'command';
ALTER TYPE "entity_type" ADD VALUE IF NOT EXISTS 'reference';

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "doc_kind" text NOT NULL DEFAULT 'note';

-- =============================================================================
-- BOOKMARKS & DIGITAL LIBRARY
-- =============================================================================

CREATE TABLE IF NOT EXISTS "bookmark_collections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "parent_id" uuid,
  "name" text NOT NULL,
  "description" text,
  "icon" text NOT NULL DEFAULT 'Folder',
  "color" text NOT NULL DEFAULT '#f97316',
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "bookmark_collections_user_idx" ON "bookmark_collections" ("user_id", "workspace_id");
CREATE INDEX IF NOT EXISTS "bookmark_collections_parent_idx" ON "bookmark_collections" ("parent_id");

CREATE TABLE IF NOT EXISTS "bookmarks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "canonical_url" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "domain" text NOT NULL,
  "thumbnail_url" text,
  "favicon_url" text,
  "resource_type" text NOT NULL DEFAULT 'website',
  "collection_id" uuid REFERENCES "bookmark_collections"("id") ON DELETE SET NULL,
  "reading_status" text NOT NULL DEFAULT 'unread',
  "is_favorite" boolean NOT NULL DEFAULT false,
  "last_accessed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "archived_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "bookmarks_user_workspace_idx" ON "bookmarks" ("user_id", "workspace_id");
CREATE INDEX IF NOT EXISTS "bookmarks_collection_idx" ON "bookmarks" ("collection_id");
CREATE INDEX IF NOT EXISTS "bookmarks_status_idx" ON "bookmarks" ("user_id", "reading_status");
CREATE UNIQUE INDEX IF NOT EXISTS "bookmarks_workspace_canonical_uidx" ON "bookmarks" ("workspace_id", "canonical_url");

-- =============================================================================
-- DEVELOPER HUB
-- =============================================================================

CREATE TABLE IF NOT EXISTS "developer_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "parent_id" uuid,
  "name" text NOT NULL,
  "description" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "developer_categories_user_idx" ON "developer_categories" ("user_id", "workspace_id");

CREATE TABLE IF NOT EXISTS "developer_snippets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "language" text NOT NULL DEFAULT 'typescript',
  "code" text NOT NULL,
  "category_id" uuid REFERENCES "developer_categories"("id") ON DELETE SET NULL,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL,
  "source_note_id" uuid REFERENCES "notes"("id") ON DELETE SET NULL,
  "is_favorite" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "developer_snippets_user_idx" ON "developer_snippets" ("user_id", "workspace_id");
CREATE INDEX IF NOT EXISTS "developer_snippets_lang_idx" ON "developer_snippets" ("user_id", "language");
CREATE INDEX IF NOT EXISTS "developer_snippets_project_idx" ON "developer_snippets" ("project_id");

CREATE TABLE IF NOT EXISTS "developer_commands" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "command" text NOT NULL,
  "platform" text NOT NULL DEFAULT 'linux',
  "category_id" uuid REFERENCES "developer_categories"("id") ON DELETE SET NULL,
  "notes" text,
  "is_favorite" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "developer_commands_user_idx" ON "developer_commands" ("user_id", "workspace_id");
CREATE INDEX IF NOT EXISTS "developer_commands_platform_idx" ON "developer_commands" ("user_id", "platform");

CREATE TABLE IF NOT EXISTS "developer_references" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "url" text NOT NULL,
  "technology" text NOT NULL,
  "version_label" text,
  "category_id" uuid REFERENCES "developer_categories"("id") ON DELETE SET NULL,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "developer_references_user_idx" ON "developer_references" ("user_id", "workspace_id");

CREATE TABLE IF NOT EXISTS "github_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "github_account_id" text NOT NULL,
  "account_login" text NOT NULL,
  "avatar_url" text,
  "encrypted_token" text NOT NULL,
  "scopes" text NOT NULL DEFAULT '',
  "connection_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "github_connections_user_workspace_uidx" ON "github_connections" ("user_id", "workspace_id");

CREATE TABLE IF NOT EXISTS "project_repositories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "repository_identifier" text NOT NULL,
  "repository_url" text NOT NULL,
  "default_branch" text NOT NULL DEFAULT 'main',
  "language" text,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_repositories_unique_uidx" ON "project_repositories" ("project_id", "repository_identifier");
CREATE INDEX IF NOT EXISTS "project_repositories_user_idx" ON "project_repositories" ("user_id");

-- =============================================================================
-- KNOWLEDGE GRAPH PREFERENCES & NODE POSITIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS "graph_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "layout_config" jsonb NOT NULL DEFAULT '{"chargeStrength":240,"linkDistance":95,"includeTasks":false}'::jsonb,
  "filter_config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "graph_preferences_user_workspace_uidx" ON "graph_preferences" ("user_id", "workspace_id");

CREATE TABLE IF NOT EXISTS "graph_node_positions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "entity_type" "entity_type" NOT NULL,
  "entity_id" uuid NOT NULL,
  "position_x" double precision NOT NULL,
  "position_y" double precision NOT NULL,
  "is_pinned" boolean NOT NULL DEFAULT false,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "graph_node_positions_unique_uidx" ON "graph_node_positions" ("user_id", "entity_type", "entity_id");

-- =============================================================================
-- FULL-TEXT & TRIGRAM SEARCH INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS "bookmarks_fts_idx" ON "bookmarks" USING GIN (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("domain", '')));
CREATE INDEX IF NOT EXISTS "developer_snippets_fts_idx" ON "developer_snippets" USING GIN (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("language", '') || ' ' || coalesce("code", '')));
CREATE INDEX IF NOT EXISTS "developer_commands_fts_idx" ON "developer_commands" USING GIN (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("command", '')));
CREATE INDEX IF NOT EXISTS "developer_references_fts_idx" ON "developer_references" USING GIN (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("technology", '') || ' ' || coalesce("description", '')));

CREATE INDEX IF NOT EXISTS "notes_title_trgm_idx" ON "notes" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "bookmarks_title_trgm_idx" ON "bookmarks" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "developer_snippets_title_trgm_idx" ON "developer_snippets" USING GIN ("title" gin_trgm_ops);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE "bookmark_collections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookmarks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "developer_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "developer_snippets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "developer_commands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "developer_references" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "github_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_repositories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "graph_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "graph_node_positions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookmark_collections_owner_policy" ON "bookmark_collections";
CREATE POLICY "bookmark_collections_owner_policy" ON "bookmark_collections" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "bookmarks_owner_policy" ON "bookmarks";
CREATE POLICY "bookmarks_owner_policy" ON "bookmarks" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "developer_categories_owner_policy" ON "developer_categories";
CREATE POLICY "developer_categories_owner_policy" ON "developer_categories" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "developer_snippets_owner_policy" ON "developer_snippets";
CREATE POLICY "developer_snippets_owner_policy" ON "developer_snippets" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "developer_commands_owner_policy" ON "developer_commands";
CREATE POLICY "developer_commands_owner_policy" ON "developer_commands" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "developer_references_owner_policy" ON "developer_references";
CREATE POLICY "developer_references_owner_policy" ON "developer_references" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "github_connections_owner_policy" ON "github_connections";
CREATE POLICY "github_connections_owner_policy" ON "github_connections" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "project_repositories_owner_policy" ON "project_repositories";
CREATE POLICY "project_repositories_owner_policy" ON "project_repositories" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "graph_preferences_owner_policy" ON "graph_preferences";
CREATE POLICY "graph_preferences_owner_policy" ON "graph_preferences" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "graph_node_positions_owner_policy" ON "graph_node_positions";
CREATE POLICY "graph_node_positions_owner_policy" ON "graph_node_positions" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());
