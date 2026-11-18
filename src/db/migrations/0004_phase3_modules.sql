-- Phase 3 Tables: Learning Hub, Calendar, Flashcards, Focus, Habits

CREATE TABLE IF NOT EXISTS "learning_paths" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "description" text,
  "icon" text DEFAULT 'GraduationCap' NOT NULL,
  "color" text DEFAULT '#8b5cf6' NOT NULL,
  "goal" text,
  "status" text DEFAULT 'in_progress' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "courses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "description" text,
  "platform" text,
  "url" text,
  "category" text,
  "status" text DEFAULT 'in_progress' NOT NULL,
  "estimated_minutes" integer,
  "started_at" timestamp with time zone,
  "target_date" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "learning_path_courses" (
  "path_id" uuid NOT NULL REFERENCES "public"."learning_paths"("id") ON DELETE cascade,
  "course_id" uuid NOT NULL REFERENCES "public"."courses"("id") ON DELETE cascade,
  "sort_order" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "learning_path_courses_pk" PRIMARY KEY("path_id", "course_id")
);

CREATE TABLE IF NOT EXISTS "course_modules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "course_id" uuid NOT NULL REFERENCES "public"."courses"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "description" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lessons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "module_id" uuid NOT NULL REFERENCES "public"."course_modules"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'not_started' NOT NULL,
  "estimated_minutes" integer,
  "external_url" text,
  "completed_at" timestamp with time zone,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "learning_resource_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "course_id" uuid REFERENCES "public"."courses"("id") ON DELETE cascade,
  "lesson_id" uuid REFERENCES "public"."lessons"("id") ON DELETE cascade,
  "note_id" uuid REFERENCES "public"."notes"("id") ON DELETE cascade,
  "task_id" uuid REFERENCES "public"."tasks"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "calendar_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "description" text,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "is_all_day" boolean DEFAULT false NOT NULL,
  "all_day_date" text,
  "location" text,
  "color" text DEFAULT '#3b82f6' NOT NULL,
  "category" text DEFAULT 'event' NOT NULL,
  "status" text DEFAULT 'confirmed' NOT NULL,
  "recurrence_rule" text,
  "recurrence_timezone" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "calendar_event_exceptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "event_id" uuid NOT NULL REFERENCES "public"."calendar_events"("id") ON DELETE cascade,
  "original_occurrence" timestamp with time zone NOT NULL,
  "replacement_start" timestamp with time zone,
  "replacement_end" timestamp with time zone,
  "replacement_title" text,
  "is_canceled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "scheduled_time_blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "event_id" uuid NOT NULL REFERENCES "public"."calendar_events"("id") ON DELETE cascade,
  "task_id" uuid REFERENCES "public"."tasks"("id") ON DELETE set null,
  "project_id" uuid REFERENCES "public"."projects"("id") ON DELETE set null,
  "course_id" uuid REFERENCES "public"."courses"("id") ON DELETE set null,
  "lesson_id" uuid REFERENCES "public"."lessons"("id") ON DELETE set null,
  "note_id" uuid REFERENCES "public"."notes"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "flashcard_decks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "description" text,
  "course_id" uuid REFERENCES "public"."courses"("id") ON DELETE set null,
  "module_id" uuid REFERENCES "public"."course_modules"("id") ON DELETE set null,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "flashcard_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "note_type" text DEFAULT 'basic' NOT NULL,
  "front" text NOT NULL,
  "back" text DEFAULT '' NOT NULL,
  "cloze_text" text,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source_note_id" uuid REFERENCES "public"."notes"("id") ON DELETE set null,
  "course_id" uuid REFERENCES "public"."courses"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "flashcards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "deck_id" uuid NOT NULL REFERENCES "public"."flashcard_decks"("id") ON DELETE cascade,
  "flashcard_note_id" uuid NOT NULL REFERENCES "public"."flashcard_notes"("id") ON DELETE cascade,
  "template_key" text DEFAULT 'forward' NOT NULL,
  "front" text NOT NULL,
  "back" text NOT NULL,
  "fsrs_state" integer DEFAULT 0 NOT NULL,
  "stability" double precision DEFAULT 0 NOT NULL,
  "difficulty" double precision DEFAULT 0 NOT NULL,
  "elapsed_days" integer DEFAULT 0 NOT NULL,
  "scheduled_days" integer DEFAULT 0 NOT NULL,
  "reps" integer DEFAULT 0 NOT NULL,
  "lapses" integer DEFAULT 0 NOT NULL,
  "due_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_review_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "flashcard_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "card_id" uuid NOT NULL REFERENCES "public"."flashcards"("id") ON DELETE cascade,
  "review_request_id" text NOT NULL UNIQUE,
  "rating" integer NOT NULL,
  "previous_state" integer NOT NULL,
  "next_state" integer NOT NULL,
  "elapsed_days" integer NOT NULL,
  "scheduled_days" integer NOT NULL,
  "algorithm_version" text DEFAULT 'ts-fsrs-4' NOT NULL,
  "reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "focus_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  "mode" text DEFAULT 'pomodoro' NOT NULL,
  "status" text DEFAULT 'running' NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at" timestamp with time zone,
  "actual_duration_seconds" integer DEFAULT 0 NOT NULL,
  "pomodoro_cycle" integer DEFAULT 1 NOT NULL,
  "description" text,
  "category" text,
  "task_id" uuid REFERENCES "public"."tasks"("id") ON DELETE set null,
  "project_id" uuid REFERENCES "public"."projects"("id") ON DELETE set null,
  "course_id" uuid REFERENCES "public"."courses"("id") ON DELETE set null,
  "lesson_id" uuid REFERENCES "public"."lessons"("id") ON DELETE set null,
  "calendar_event_id" uuid REFERENCES "public"."calendar_events"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "focus_session_intervals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "session_id" uuid NOT NULL REFERENCES "public"."focus_sessions"("id") ON DELETE cascade,
  "interval_type" text DEFAULT 'focus' NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "focus_preferences" (
  "user_id" uuid PRIMARY KEY REFERENCES "public"."users"("id") ON DELETE cascade,
  "focus_minutes" integer DEFAULT 25 NOT NULL,
  "short_break_minutes" integer DEFAULT 5 NOT NULL,
  "long_break_minutes" integer DEFAULT 15 NOT NULL,
  "cycles_before_long_break" integer DEFAULT 4 NOT NULL,
  "sound_enabled" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "habits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "description" text,
  "icon" text DEFAULT 'Flame' NOT NULL,
  "color" text DEFAULT '#10b981' NOT NULL,
  "category" text,
  "habit_type" text DEFAULT 'boolean' NOT NULL,
  "frequency" text DEFAULT 'daily' NOT NULL,
  "schedule_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "target_value" integer DEFAULT 1 NOT NULL,
  "unit" text DEFAULT 'times' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "start_date" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "habit_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "habit_id" uuid NOT NULL REFERENCES "public"."habits"("id") ON DELETE cascade,
  "entry_date" text NOT NULL,
  "value" integer DEFAULT 1 NOT NULL,
  "source" text DEFAULT 'manual' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "habit_activity_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "habit_id" uuid NOT NULL UNIQUE REFERENCES "public"."habits"("id") ON DELETE cascade,
  "activity_type" text NOT NULL,
  "project_id" uuid REFERENCES "public"."projects"("id") ON DELETE set null,
  "course_id" uuid REFERENCES "public"."courses"("id") ON DELETE set null,
  "category" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes & Unique Constraints
CREATE INDEX IF NOT EXISTS "learning_paths_user_idx" ON "learning_paths" ("user_id");
CREATE INDEX IF NOT EXISTS "courses_user_idx" ON "courses" ("user_id");
CREATE INDEX IF NOT EXISTS "course_modules_course_idx" ON "course_modules" ("course_id");
CREATE INDEX IF NOT EXISTS "lessons_module_idx" ON "lessons" ("module_id");
CREATE INDEX IF NOT EXISTS "calendar_events_user_range_idx" ON "calendar_events" ("user_id", "starts_at", "ends_at");
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_exceptions_event_occ_uidx" ON "calendar_event_exceptions" ("event_id", "original_occurrence");
CREATE INDEX IF NOT EXISTS "time_blocks_event_idx" ON "scheduled_time_blocks" ("event_id");
CREATE INDEX IF NOT EXISTS "time_blocks_task_idx" ON "scheduled_time_blocks" ("task_id");
CREATE INDEX IF NOT EXISTS "flashcards_deck_due_idx" ON "flashcards" ("deck_id", "due_at");
CREATE INDEX IF NOT EXISTS "flashcards_user_due_idx" ON "flashcards" ("user_id", "due_at");
CREATE INDEX IF NOT EXISTS "flashcard_reviews_card_idx" ON "flashcard_reviews" ("card_id");
CREATE INDEX IF NOT EXISTS "flashcard_reviews_user_date_idx" ON "flashcard_reviews" ("user_id", "reviewed_at");
CREATE INDEX IF NOT EXISTS "focus_sessions_user_status_idx" ON "focus_sessions" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "focus_sessions_user_started_idx" ON "focus_sessions" ("user_id", "started_at");
CREATE UNIQUE INDEX IF NOT EXISTS "focus_sessions_one_active_per_user_uidx" ON "focus_sessions" ("user_id") WHERE status IN ('running', 'paused');
CREATE INDEX IF NOT EXISTS "focus_intervals_session_idx" ON "focus_session_intervals" ("session_id");
CREATE INDEX IF NOT EXISTS "habits_user_status_idx" ON "habits" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "habit_entries_habit_date_idx" ON "habit_entries" ("habit_id", "entry_date");
CREATE INDEX IF NOT EXISTS "habit_entries_user_date_idx" ON "habit_entries" ("user_id", "entry_date");

-- Enable RLS & Ownership Policies on all Phase 3 tables
ALTER TABLE "learning_paths" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "learning_paths_owner_policy" ON "learning_paths";
CREATE POLICY "learning_paths_owner_policy" ON "learning_paths" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "courses_owner_policy" ON "courses";
CREATE POLICY "courses_owner_policy" ON "courses" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

ALTER TABLE "learning_path_courses" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "learning_path_courses_owner_policy" ON "learning_path_courses";
CREATE POLICY "learning_path_courses_owner_policy" ON "learning_path_courses" FOR ALL
  USING (EXISTS (SELECT 1 FROM "learning_paths" lp WHERE lp."id" = "path_id" AND lp."user_id" = public.nikki_current_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM "learning_paths" lp WHERE lp."id" = "path_id" AND lp."user_id" = public.nikki_current_user_id()));

ALTER TABLE "course_modules" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "course_modules_owner_policy" ON "course_modules";
CREATE POLICY "course_modules_owner_policy" ON "course_modules" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

ALTER TABLE "lessons" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lessons_owner_policy" ON "lessons";
CREATE POLICY "lessons_owner_policy" ON "lessons" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

ALTER TABLE "learning_resource_links" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "learning_resource_links_owner_policy" ON "learning_resource_links";
CREATE POLICY "learning_resource_links_owner_policy" ON "learning_resource_links" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

ALTER TABLE "calendar_events" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calendar_events_owner_policy" ON "calendar_events";
CREATE POLICY "calendar_events_owner_policy" ON "calendar_events" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

ALTER TABLE "calendar_event_exceptions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calendar_event_exceptions_owner_policy" ON "calendar_event_exceptions";
CREATE POLICY "calendar_event_exceptions_owner_policy" ON "calendar_event_exceptions" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

ALTER TABLE "scheduled_time_blocks" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scheduled_time_blocks_owner_policy" ON "scheduled_time_blocks";
CREATE POLICY "scheduled_time_blocks_owner_policy" ON "scheduled_time_blocks" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

ALTER TABLE "flashcard_decks" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "flashcard_decks_owner_policy" ON "flashcard_decks";
CREATE POLICY "flashcard_decks_owner_policy" ON "flashcard_decks" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

ALTER TABLE "flashcard_notes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "flashcard_notes_owner_policy" ON "flashcard_notes";
CREATE POLICY "flashcard_notes_owner_policy" ON "flashcard_notes" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

ALTER TABLE "flashcards" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "flashcards_owner_policy" ON "flashcards";
CREATE POLICY "flashcards_owner_policy" ON "flashcards" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

ALTER TABLE "flashcard_reviews" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "flashcard_reviews_owner_policy" ON "flashcard_reviews";
CREATE POLICY "flashcard_reviews_owner_policy" ON "flashcard_reviews" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

ALTER TABLE "focus_sessions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "focus_sessions_owner_policy" ON "focus_sessions";
CREATE POLICY "focus_sessions_owner_policy" ON "focus_sessions" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

ALTER TABLE "focus_session_intervals" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "focus_session_intervals_owner_policy" ON "focus_session_intervals";
CREATE POLICY "focus_session_intervals_owner_policy" ON "focus_session_intervals" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

ALTER TABLE "focus_preferences" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "focus_preferences_owner_policy" ON "focus_preferences";
CREATE POLICY "focus_preferences_owner_policy" ON "focus_preferences" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

ALTER TABLE "habits" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "habits_owner_policy" ON "habits";
CREATE POLICY "habits_owner_policy" ON "habits" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

ALTER TABLE "habit_entries" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "habit_entries_owner_policy" ON "habit_entries";
CREATE POLICY "habit_entries_owner_policy" ON "habit_entries" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

ALTER TABLE "habit_activity_links" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "habit_activity_links_owner_policy" ON "habit_activity_links";
CREATE POLICY "habit_activity_links_owner_policy" ON "habit_activity_links" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());
