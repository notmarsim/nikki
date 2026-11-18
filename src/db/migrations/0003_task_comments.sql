CREATE TABLE IF NOT EXISTS "task_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  "task_id" uuid NOT NULL REFERENCES "public"."tasks"("id") ON DELETE cascade,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_comments_task_idx" ON "task_comments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_comments_user_idx" ON "task_comments" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "task_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "task_comments_owner_policy" ON "task_comments";--> statement-breakpoint
CREATE POLICY "task_comments_owner_policy" ON "task_comments" FOR ALL
  USING ("user_id" = public.nikki_current_user_id())
  WITH CHECK (
    "user_id" = public.nikki_current_user_id()
    AND EXISTS (SELECT 1 FROM "tasks" t WHERE t."id" = "task_id" AND t."user_id" = public.nikki_current_user_id())
  );
