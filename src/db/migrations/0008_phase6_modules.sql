-- Nikki Phase 6: Spaces, Collaborative Editing, Goals, Journal, Home, Vault, Focus Rooms, Feed, Templates, Diagnostics & Ops

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" boolean NOT NULL DEFAULT false;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "color" text NOT NULL DEFAULT '#3b82f6';
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "space_type" text NOT NULL DEFAULT 'personal';
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active';

-- =============================================================================
-- NIKKI SPACES
-- =============================================================================

CREATE TABLE IF NOT EXISTS "workspace_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'editor',
  "joined_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_ws_user_uidx" ON "workspace_members" ("workspace_id", "user_id");
CREATE INDEX IF NOT EXISTS "workspace_members_user_idx" ON "workspace_members" ("user_id");

-- Backfill existing workspace owners into workspace_members safely
INSERT INTO "workspace_members" ("workspace_id", "user_id", "role")
SELECT "id", "owner_id", 'owner' FROM "workspaces"
ON CONFLICT ("workspace_id", "user_id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "workspace_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "invited_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" text NOT NULL DEFAULT 'editor',
  "token_hash" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'pending',
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "workspace_invites_ws_idx" ON "workspace_invitations" ("workspace_id", "status");

-- =============================================================================
-- COLLABORATIVE EDITING (YJS CRDT)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "collaborative_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "note_id" uuid NOT NULL UNIQUE REFERENCES "notes"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "state_base64" text NOT NULL DEFAULT '',
  "revision" integer NOT NULL DEFAULT 0,
  "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "collab_docs_ws_idx" ON "collaborative_documents" ("workspace_id");

CREATE TABLE IF NOT EXISTS "collaborative_document_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "note_id" uuid NOT NULL REFERENCES "notes"("id") ON DELETE CASCADE,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "label" text NOT NULL DEFAULT 'Checkpoint',
  "state_base64" text NOT NULL,
  "content_text" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "collab_snapshots_note_idx" ON "collaborative_document_snapshots" ("note_id", "created_at");

-- =============================================================================
-- GOALS & LIFE AREAS
-- =============================================================================

CREATE TABLE IF NOT EXISTS "life_areas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "color" text NOT NULL DEFAULT '#3b82f6',
  "icon" text NOT NULL DEFAULT 'Compass',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "life_areas_user_idx" ON "life_areas" ("user_id", "workspace_id");

CREATE TABLE IF NOT EXISTS "life_goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "area_id" uuid REFERENCES "life_areas"("id") ON DELETE SET NULL,
  "parent_goal_id" uuid,
  "title" text NOT NULL,
  "description" text,
  "horizon" text NOT NULL DEFAULT 'quarterly',
  "status" text NOT NULL DEFAULT 'active',
  "priority" text NOT NULL DEFAULT 'medium',
  "metric_source" text NOT NULL DEFAULT 'manual',
  "target_value" integer NOT NULL DEFAULT 100,
  "current_value" integer NOT NULL DEFAULT 0,
  "unit" text NOT NULL DEFAULT '%',
  "start_date" text,
  "target_date" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "life_goals_user_idx" ON "life_goals" ("user_id", "status");

-- =============================================================================
-- NIKKI JOURNAL
-- =============================================================================

CREATE TABLE IF NOT EXISTS "journal_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "entry_date" text NOT NULL,
  "title" text,
  "content" text NOT NULL DEFAULT '',
  "mood" text,
  "template_kind" text NOT NULL DEFAULT 'daily',
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "is_private" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "journal_entries_user_date_idx" ON "journal_entries" ("user_id", "entry_date");

-- =============================================================================
-- NIKKI HOME
-- =============================================================================

CREATE TABLE IF NOT EXISTS "home_shopping_lists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "home_shopping_lists_ws_idx" ON "home_shopping_lists" ("workspace_id");

CREATE TABLE IF NOT EXISTS "home_shopping_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "list_id" uuid NOT NULL REFERENCES "home_shopping_lists"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "quantity" text NOT NULL DEFAULT '1',
  "unit" text NOT NULL DEFAULT 'un',
  "category" text NOT NULL DEFAULT 'General',
  "is_purchased" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "home_shopping_items_list_idx" ON "home_shopping_items" ("list_id");

CREATE TABLE IF NOT EXISTS "home_inventory_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "category" text NOT NULL DEFAULT 'Pantry',
  "quantity" integer NOT NULL DEFAULT 1,
  "min_quantity" integer NOT NULL DEFAULT 0,
  "unit" text NOT NULL DEFAULT 'un',
  "location" text,
  "expires_at" text,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "home_inventory_ws_idx" ON "home_inventory_items" ("workspace_id");

CREATE TABLE IF NOT EXISTS "home_recipes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "ingredients" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "instructions" text NOT NULL DEFAULT '',
  "prep_minutes" integer NOT NULL DEFAULT 20,
  "servings" integer NOT NULL DEFAULT 2,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "home_recipes_ws_idx" ON "home_recipes" ("workspace_id");

CREATE TABLE IF NOT EXISTS "home_meal_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "plan_date" text NOT NULL,
  "meal_slot" text NOT NULL DEFAULT 'lunch',
  "recipe_id" uuid REFERENCES "home_recipes"("id") ON DELETE SET NULL,
  "title" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "home_meal_plans_ws_date_idx" ON "home_meal_plans" ("workspace_id", "plan_date");

-- =============================================================================
-- DOCUMENT VAULT
-- =============================================================================

CREATE TABLE IF NOT EXISTS "vault_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "category" text NOT NULL DEFAULT 'other',
  "storage_path" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "expires_at" text,
  "version" integer NOT NULL DEFAULT 1,
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "is_archived" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "vault_docs_user_idx" ON "vault_documents" ("user_id", "workspace_id");

-- =============================================================================
-- FOCUS ROOMS
-- =============================================================================

CREATE TABLE IF NOT EXISTS "focus_rooms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "creator_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "description" text,
  "mode" text NOT NULL DEFAULT 'synchronized',
  "status" text NOT NULL DEFAULT 'idle',
  "focus_minutes" integer NOT NULL DEFAULT 25,
  "break_minutes" integer NOT NULL DEFAULT 5,
  "cycle_started_at" timestamptz,
  "invite_code" text NOT NULL UNIQUE,
  "is_private" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "focus_rooms_creator_idx" ON "focus_rooms" ("creator_id");

CREATE TABLE IF NOT EXISTS "focus_room_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "room_id" uuid NOT NULL REFERENCES "focus_rooms"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "hide_activity" boolean NOT NULL DEFAULT false,
  "status_label" text NOT NULL DEFAULT 'Focusing',
  "joined_at" timestamptz NOT NULL DEFAULT now(),
  "last_seen_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "focus_room_members_uidx" ON "focus_room_members" ("room_id", "user_id");

-- =============================================================================
-- NIKKI FEED
-- =============================================================================

CREATE TABLE IF NOT EXISTS "feed_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "category" text NOT NULL DEFAULT 'Tech',
  "status" text NOT NULL DEFAULT 'active',
  "last_fetched_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "feed_sources_user_idx" ON "feed_sources" ("user_id");

CREATE TABLE IF NOT EXISTS "feed_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source_id" uuid NOT NULL REFERENCES "feed_sources"("id") ON DELETE CASCADE,
  "guid" text NOT NULL,
  "title" text NOT NULL,
  "link" text NOT NULL,
  "summary" text NOT NULL DEFAULT '',
  "published_at" timestamptz NOT NULL DEFAULT now(),
  "is_read" boolean NOT NULL DEFAULT false,
  "is_favorite" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "feed_entries_source_guid_uidx" ON "feed_entries" ("source_id", "guid");
CREATE INDEX IF NOT EXISTS "feed_entries_user_idx" ON "feed_entries" ("user_id", "published_at");

-- =============================================================================
-- TEMPLATES, DIAGNOSTICS & OPS
-- =============================================================================

CREATE TABLE IF NOT EXISTS "nikki_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "author_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "category" text NOT NULL DEFAULT 'productivity',
  "is_public" boolean NOT NULL DEFAULT false,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "nikki_templates_author_idx" ON "nikki_templates" ("author_user_id");

CREATE TABLE IF NOT EXISTS "diagnostic_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "platform" text NOT NULL,
  "app_version" text NOT NULL,
  "summary" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "diagnostic_reports_user_idx" ON "diagnostic_reports" ("user_id");

CREATE TABLE IF NOT EXISTS "application_error_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "module" text NOT NULL,
  "severity" text NOT NULL DEFAULT 'error',
  "message" text NOT NULL,
  "platform" text NOT NULL DEFAULT 'web',
  "correlation_id" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "app_error_events_created_idx" ON "application_error_events" ("created_at");

CREATE TABLE IF NOT EXISTS "administrative_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "admin_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "action" text NOT NULL,
  "target_entity" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "admin_audit_events_created_idx" ON "administrative_audit_events" ("created_at");

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE "workspace_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collaborative_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collaborative_document_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "life_areas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "life_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journal_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_shopping_lists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_shopping_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_inventory_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_recipes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_meal_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vault_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "focus_rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "focus_room_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feed_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feed_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nikki_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "diagnostic_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "application_error_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "administrative_audit_events" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_members_policy" ON "workspace_members";
CREATE POLICY "workspace_members_policy" ON "workspace_members" FOR ALL USING ("user_id" = public.nikki_current_user_id() OR EXISTS (SELECT 1 FROM "workspace_members" wm WHERE wm."workspace_id" = "workspace_members"."workspace_id" AND wm."user_id" = public.nikki_current_user_id()));

DROP POLICY IF EXISTS "workspace_invitations_policy" ON "workspace_invitations";
CREATE POLICY "workspace_invitations_policy" ON "workspace_invitations" FOR ALL USING ("invited_by_user_id" = public.nikki_current_user_id() OR EXISTS (SELECT 1 FROM "workspace_members" wm WHERE wm."workspace_id" = "workspace_invitations"."workspace_id" AND wm."user_id" = public.nikki_current_user_id() AND wm."role" IN ('owner','admin')));

DROP POLICY IF EXISTS "collab_docs_policy" ON "collaborative_documents";
CREATE POLICY "collab_docs_policy" ON "collaborative_documents" FOR ALL USING (EXISTS (SELECT 1 FROM "workspace_members" wm WHERE wm."workspace_id" = "collaborative_documents"."workspace_id" AND wm."user_id" = public.nikki_current_user_id()));

DROP POLICY IF EXISTS "collab_snapshots_policy" ON "collaborative_document_snapshots";
CREATE POLICY "collab_snapshots_policy" ON "collaborative_document_snapshots" FOR ALL USING ("created_by_user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "life_areas_owner_policy" ON "life_areas";
CREATE POLICY "life_areas_owner_policy" ON "life_areas" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "life_goals_owner_policy" ON "life_goals";
CREATE POLICY "life_goals_owner_policy" ON "life_goals" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "journal_entries_owner_policy" ON "journal_entries";
CREATE POLICY "journal_entries_owner_policy" ON "journal_entries" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "home_shopping_lists_policy" ON "home_shopping_lists";
CREATE POLICY "home_shopping_lists_policy" ON "home_shopping_lists" FOR ALL USING ("user_id" = public.nikki_current_user_id() OR EXISTS (SELECT 1 FROM "workspace_members" wm WHERE wm."workspace_id" = "home_shopping_lists"."workspace_id" AND wm."user_id" = public.nikki_current_user_id()));

DROP POLICY IF EXISTS "home_shopping_items_policy" ON "home_shopping_items";
CREATE POLICY "home_shopping_items_policy" ON "home_shopping_items" FOR ALL USING ("user_id" = public.nikki_current_user_id() OR EXISTS (SELECT 1 FROM "home_shopping_lists" l JOIN "workspace_members" wm ON wm."workspace_id" = l."workspace_id" WHERE l."id" = "home_shopping_items"."list_id" AND wm."user_id" = public.nikki_current_user_id()));

DROP POLICY IF EXISTS "home_inventory_policy" ON "home_inventory_items";
CREATE POLICY "home_inventory_policy" ON "home_inventory_items" FOR ALL USING ("user_id" = public.nikki_current_user_id() OR EXISTS (SELECT 1 FROM "workspace_members" wm WHERE wm."workspace_id" = "home_inventory_items"."workspace_id" AND wm."user_id" = public.nikki_current_user_id()));

DROP POLICY IF EXISTS "home_recipes_policy" ON "home_recipes";
CREATE POLICY "home_recipes_policy" ON "home_recipes" FOR ALL USING ("user_id" = public.nikki_current_user_id() OR EXISTS (SELECT 1 FROM "workspace_members" wm WHERE wm."workspace_id" = "home_recipes"."workspace_id" AND wm."user_id" = public.nikki_current_user_id()));

DROP POLICY IF EXISTS "home_meal_plans_policy" ON "home_meal_plans";
CREATE POLICY "home_meal_plans_policy" ON "home_meal_plans" FOR ALL USING ("user_id" = public.nikki_current_user_id() OR EXISTS (SELECT 1 FROM "workspace_members" wm WHERE wm."workspace_id" = "home_meal_plans"."workspace_id" AND wm."user_id" = public.nikki_current_user_id()));

DROP POLICY IF EXISTS "vault_documents_owner_policy" ON "vault_documents";
CREATE POLICY "vault_documents_owner_policy" ON "vault_documents" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "focus_rooms_policy" ON "focus_rooms";
CREATE POLICY "focus_rooms_policy" ON "focus_rooms" FOR ALL USING ("creator_id" = public.nikki_current_user_id() OR EXISTS (SELECT 1 FROM "focus_room_members" fm WHERE fm."room_id" = "focus_rooms"."id" AND fm."user_id" = public.nikki_current_user_id()));

DROP POLICY IF EXISTS "focus_room_members_policy" ON "focus_room_members";
CREATE POLICY "focus_room_members_policy" ON "focus_room_members" FOR ALL USING ("user_id" = public.nikki_current_user_id() OR EXISTS (SELECT 1 FROM "focus_room_members" fm WHERE fm."room_id" = "focus_room_members"."room_id" AND fm."user_id" = public.nikki_current_user_id()));

DROP POLICY IF EXISTS "feed_sources_owner_policy" ON "feed_sources";
CREATE POLICY "feed_sources_owner_policy" ON "feed_sources" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "feed_entries_owner_policy" ON "feed_entries";
CREATE POLICY "feed_entries_owner_policy" ON "feed_entries" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "nikki_templates_policy" ON "nikki_templates";
CREATE POLICY "nikki_templates_policy" ON "nikki_templates" FOR ALL USING ("author_user_id" = public.nikki_current_user_id() OR "is_public" = true);

DROP POLICY IF EXISTS "diagnostic_reports_owner_policy" ON "diagnostic_reports";
CREATE POLICY "diagnostic_reports_owner_policy" ON "diagnostic_reports" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "app_error_events_admin_policy" ON "application_error_events";
CREATE POLICY "app_error_events_admin_policy" ON "application_error_events" FOR SELECT USING (EXISTS (SELECT 1 FROM "users" u WHERE u."id" = public.nikki_current_user_id() AND u."is_admin" = true));

DROP POLICY IF EXISTS "admin_audit_events_admin_policy" ON "administrative_audit_events";
CREATE POLICY "admin_audit_events_admin_policy" ON "administrative_audit_events" FOR ALL USING (EXISTS (SELECT 1 FROM "users" u WHERE u."id" = public.nikki_current_user_id() AND u."is_admin" = true));
