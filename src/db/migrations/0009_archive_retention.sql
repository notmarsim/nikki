-- 0009_archive_retention.sql
-- Nikki Auto-Archive, History, Trash (30d) and Retention Policy

-- 1. Add lifecycle columns safely
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Safe backfill for existing completed tasks missing completed_at
-- (Preserves existing tasks without prematurely archiving or deleting them)
UPDATE public.tasks
SET completed_at = COALESCE(updated_at, created_at, NOW())
WHERE status = 'done'
  AND completed_at IS NULL;

-- Set archive_after to end of completion week (UTC fallback) for completed tasks missing archive_after
UPDATE public.tasks
SET archive_after = date_trunc('week', completed_at AT TIME ZONE 'UTC') + INTERVAL '7 days' - INTERVAL '1 millisecond'
WHERE status = 'done'
  AND completed_at IS NOT NULL
  AND archive_after IS NULL
  AND archived_at IS NULL
  AND deleted_at IS NULL;

-- 3. Partial indexes for active queries, archive pagination, eligibility & trash cleanup
CREATE INDEX IF NOT EXISTS tasks_active_user_idx
  ON public.tasks (user_id, workspace_id, sort_order, created_at DESC)
  WHERE archived_at IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS tasks_archived_user_idx
  ON public.tasks (user_id, workspace_id, archived_at DESC)
  WHERE archived_at IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS tasks_archive_eligible_idx
  ON public.tasks (archive_after)
  WHERE status = 'done' AND archived_at IS NULL AND deleted_at IS NULL AND archive_after IS NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_trash_cleanup_idx
  ON public.tasks (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS projects_active_user_idx
  ON public.projects (user_id, workspace_id, created_at DESC)
  WHERE archived_at IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS projects_trash_cleanup_idx
  ON public.projects (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- 4. Idempotent global weekly archive & 30-day trash cleanup function
CREATE OR REPLACE FUNCTION public.nikki_run_archive_and_retention_job()
RETURNS TABLE(archived_tasks INT, purged_tasks INT, purged_projects INT, retention_purged_tasks INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archived INT := 0;
  v_purged_tasks INT := 0;
  v_purged_projects INT := 0;
  v_retention_purged INT := 0;
BEGIN
  -- A) Archive eligible completed tasks where user autoArchiveTasks is enabled (default true)
  WITH eligible AS (
    SELECT t.id
    FROM public.tasks t
    LEFT JOIN public.user_settings us ON us.user_id = t.user_id
    WHERE t.status = 'done'
      AND t.archived_at IS NULL
      AND t.deleted_at IS NULL
      AND t.archive_after IS NOT NULL
      AND t.archive_after <= NOW()
      AND COALESCE((us.preferences->>'autoArchiveTasks')::boolean, true) = true
  )
  UPDATE public.tasks t
  SET archived_at = NOW(),
      updated_at = NOW()
  FROM eligible e
  WHERE t.id = e.id;
  GET DIAGNOSTICS v_archived = ROW_COUNT;

  -- B) Permanently delete tasks in Trash older than 30 days
  DELETE FROM public.tasks
  WHERE deleted_at IS NOT NULL
    AND deleted_at <= NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_purged_tasks = ROW_COUNT;

  -- C) Permanently delete projects in Trash older than 30 days (unlink surviving active tasks if any)
  UPDATE public.tasks t
  SET project_id = NULL
  FROM public.projects p
  WHERE t.project_id = p.id
    AND p.deleted_at IS NOT NULL
    AND p.deleted_at <= NOW() - INTERVAL '30 days'
    AND t.deleted_at IS NULL;

  DELETE FROM public.projects
  WHERE deleted_at IS NOT NULL
    AND deleted_at <= NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_purged_projects = ROW_COUNT;

  -- D) Opt-in historical retention purge for archived tasks (only when user explicitly chose 1, 2, or 5 years)
  WITH expired_history AS (
    SELECT t.id
    FROM public.tasks t
    INNER JOIN public.user_settings us ON us.user_id = t.user_id
    WHERE t.archived_at IS NOT NULL
      AND t.deleted_at IS NULL
      AND (us.preferences->>'archiveRetentionYears') IN ('1', '2', '5')
      AND t.archived_at <= NOW() - make_interval(years => (us.preferences->>'archiveRetentionYears')::int)
  )
  DELETE FROM public.tasks t
  USING expired_history eh
  WHERE t.id = eh.id;
  GET DIAGNOSTICS v_retention_purged = ROW_COUNT;

  RETURN QUERY SELECT v_archived, v_purged_tasks, v_purged_projects, v_retention_purged;
END;
$$;

-- 5. Schedule hourly via pg_cron if available on the Supabase instance (no-op if pg_cron is disabled)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('nikki-weekly-archive-job');
    PERFORM cron.schedule(
      'nikki-weekly-archive-job',
      '15 * * * *',
      $cron$SELECT public.nikki_run_archive_and_retention_job();$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Safe fallback: Vercel Cron (/api/cron/archive) runs the same job hourly
  NULL;
END $$;
