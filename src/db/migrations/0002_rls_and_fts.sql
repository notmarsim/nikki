-- Full-Text Search GIN indexes for Global Search (Notes, Tasks, Projects)
CREATE INDEX IF NOT EXISTS "notes_fts_idx" ON "notes" USING gin (
  to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("content_text", ''))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_fts_idx" ON "tasks" USING gin (
  to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", ''))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_fts_idx" ON "projects" USING gin (
  to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("description", ''))
);--> statement-breakpoint

-- Helper function for RLS (works with both Drizzle app.current_user_id and Supabase JWT sub)
CREATE OR REPLACE FUNCTION public.nikki_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_user_id', true), '')::uuid,
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
  );
$$;--> statement-breakpoint

-- Enable Row Level Security on all personal tables
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "entity_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "entity_relations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activity_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "milestones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "note_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "note_attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "task_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "task_recurrence_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inbox_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Ownership policies (SELECT, INSERT, UPDATE, DELETE via FOR ALL)
DROP POLICY IF EXISTS "user_settings_owner_policy" ON "user_settings";--> statement-breakpoint
CREATE POLICY "user_settings_owner_policy" ON "user_settings" FOR ALL
  USING ("user_id" = public.nikki_current_user_id())
  WITH CHECK ("user_id" = public.nikki_current_user_id());--> statement-breakpoint

DROP POLICY IF EXISTS "workspaces_owner_policy" ON "workspaces";--> statement-breakpoint
CREATE POLICY "workspaces_owner_policy" ON "workspaces" FOR ALL
  USING ("owner_id" = public.nikki_current_user_id())
  WITH CHECK ("owner_id" = public.nikki_current_user_id());--> statement-breakpoint

DROP POLICY IF EXISTS "tags_owner_policy" ON "tags";--> statement-breakpoint
CREATE POLICY "tags_owner_policy" ON "tags" FOR ALL
  USING ("user_id" = public.nikki_current_user_id())
  WITH CHECK ("user_id" = public.nikki_current_user_id());--> statement-breakpoint

DROP POLICY IF EXISTS "entity_tags_owner_policy" ON "entity_tags";--> statement-breakpoint
CREATE POLICY "entity_tags_owner_policy" ON "entity_tags" FOR ALL
  USING (EXISTS (SELECT 1 FROM "tags" t WHERE t."id" = "tag_id" AND t."user_id" = public.nikki_current_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM "tags" t WHERE t."id" = "tag_id" AND t."user_id" = public.nikki_current_user_id()));--> statement-breakpoint

DROP POLICY IF EXISTS "entity_relations_owner_policy" ON "entity_relations";--> statement-breakpoint
CREATE POLICY "entity_relations_owner_policy" ON "entity_relations" FOR ALL
  USING ("user_id" = public.nikki_current_user_id())
  WITH CHECK ("user_id" = public.nikki_current_user_id());--> statement-breakpoint

DROP POLICY IF EXISTS "activity_logs_owner_policy" ON "activity_logs";--> statement-breakpoint
CREATE POLICY "activity_logs_owner_policy" ON "activity_logs" FOR ALL
  USING ("user_id" = public.nikki_current_user_id())
  WITH CHECK ("user_id" = public.nikki_current_user_id());--> statement-breakpoint

DROP POLICY IF EXISTS "projects_owner_policy" ON "projects";--> statement-breakpoint
CREATE POLICY "projects_owner_policy" ON "projects" FOR ALL
  USING ("user_id" = public.nikki_current_user_id())
  WITH CHECK ("user_id" = public.nikki_current_user_id());--> statement-breakpoint

DROP POLICY IF EXISTS "milestones_owner_policy" ON "milestones";--> statement-breakpoint
CREATE POLICY "milestones_owner_policy" ON "milestones" FOR ALL
  USING ("user_id" = public.nikki_current_user_id())
  WITH CHECK ("user_id" = public.nikki_current_user_id() AND EXISTS (SELECT 1 FROM "projects" p WHERE p."id" = "project_id" AND p."user_id" = public.nikki_current_user_id()));--> statement-breakpoint

DROP POLICY IF EXISTS "notes_owner_policy" ON "notes";--> statement-breakpoint
CREATE POLICY "notes_owner_policy" ON "notes" FOR ALL
  USING ("user_id" = public.nikki_current_user_id())
  WITH CHECK ("user_id" = public.nikki_current_user_id());--> statement-breakpoint

DROP POLICY IF EXISTS "note_links_owner_policy" ON "note_links";--> statement-breakpoint
CREATE POLICY "note_links_owner_policy" ON "note_links" FOR ALL
  USING ("user_id" = public.nikki_current_user_id())
  WITH CHECK (
    "user_id" = public.nikki_current_user_id()
    AND EXISTS (SELECT 1 FROM "notes" s WHERE s."id" = "source_note_id" AND s."user_id" = public.nikki_current_user_id())
    AND EXISTS (SELECT 1 FROM "notes" t WHERE t."id" = "target_note_id" AND t."user_id" = public.nikki_current_user_id())
  );--> statement-breakpoint

DROP POLICY IF EXISTS "note_attachments_owner_policy" ON "note_attachments";--> statement-breakpoint
CREATE POLICY "note_attachments_owner_policy" ON "note_attachments" FOR ALL
  USING ("user_id" = public.nikki_current_user_id())
  WITH CHECK ("user_id" = public.nikki_current_user_id() AND EXISTS (SELECT 1 FROM "notes" n WHERE n."id" = "note_id" AND n."user_id" = public.nikki_current_user_id()));--> statement-breakpoint

DROP POLICY IF EXISTS "tasks_owner_policy" ON "tasks";--> statement-breakpoint
CREATE POLICY "tasks_owner_policy" ON "tasks" FOR ALL
  USING ("user_id" = public.nikki_current_user_id())
  WITH CHECK ("user_id" = public.nikki_current_user_id());--> statement-breakpoint

DROP POLICY IF EXISTS "task_tags_owner_policy" ON "task_tags";--> statement-breakpoint
CREATE POLICY "task_tags_owner_policy" ON "task_tags" FOR ALL
  USING (EXISTS (SELECT 1 FROM "tasks" t WHERE t."id" = "task_id" AND t."user_id" = public.nikki_current_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM "tasks" t WHERE t."id" = "task_id" AND t."user_id" = public.nikki_current_user_id()));--> statement-breakpoint

DROP POLICY IF EXISTS "task_recurrence_rules_owner_policy" ON "task_recurrence_rules";--> statement-breakpoint
CREATE POLICY "task_recurrence_rules_owner_policy" ON "task_recurrence_rules" FOR ALL
  USING ("user_id" = public.nikki_current_user_id())
  WITH CHECK ("user_id" = public.nikki_current_user_id() AND EXISTS (SELECT 1 FROM "tasks" t WHERE t."id" = "task_id" AND t."user_id" = public.nikki_current_user_id()));--> statement-breakpoint

DROP POLICY IF EXISTS "inbox_items_owner_policy" ON "inbox_items";--> statement-breakpoint
CREATE POLICY "inbox_items_owner_policy" ON "inbox_items" FOR ALL
  USING ("user_id" = public.nikki_current_user_id())
  WITH CHECK ("user_id" = public.nikki_current_user_id());
