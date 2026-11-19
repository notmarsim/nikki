-- 0010_expansion_onboarding.sql
-- Nikki Feature Expansion & Interactive Onboarding Update

CREATE TABLE IF NOT EXISTS public.day_planner_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_date TEXT NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'task',
  source_id UUID,
  start_minute INT NOT NULL,
  end_minute INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'suggested',
  priority TEXT NOT NULL DEFAULT 'medium',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS day_planner_blocks_user_date_idx ON public.day_planner_blocks (user_id, workspace_id, plan_date);

CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT task_dependencies_no_self CHECK (task_id <> depends_on_task_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS task_dependencies_pair_uidx ON public.task_dependencies (task_id, depends_on_task_id);
CREATE INDEX IF NOT EXISTS task_dependencies_dep_idx ON public.task_dependencies (depends_on_task_id);

CREATE TABLE IF NOT EXISTS public.routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_time TEXT DEFAULT '08:00',
  recurrence_days JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_template BOOLEAN NOT NULL DEFAULT FALSE,
  is_paused BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS routines_user_ws_idx ON public.routines (user_id, workspace_id);

CREATE TABLE IF NOT EXISTS public.routine_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 15,
  sort_order INT NOT NULL DEFAULT 0,
  linked_habit_id UUID REFERENCES public.habits(id) ON DELETE SET NULL,
  linked_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS routine_steps_routine_idx ON public.routine_steps (routine_id, sort_order);

CREATE TABLE IF NOT EXISTS public.routine_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running',
  current_step_index INT NOT NULL DEFAULT 0,
  step_states JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS routine_runs_routine_idx ON public.routine_runs (routine_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Software',
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  next_billing_date TEXT NOT NULL,
  renewal_date TEXT,
  trial_ends_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  payment_label TEXT,
  notes TEXT,
  recurring_rule_id UUID REFERENCES public.finance_recurring_rules(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS subscriptions_user_ws_idx ON public.subscriptions (user_id, workspace_id, next_billing_date);

CREATE TABLE IF NOT EXISTS public.smart_shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Groceries',
  status TEXT NOT NULL DEFAULT 'active',
  total_estimated_cents BIGINT NOT NULL DEFAULT 0,
  total_actual_cents BIGINT NOT NULL DEFAULT 0,
  linked_transaction_id UUID REFERENCES public.finance_transactions(id) ON DELETE SET NULL,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS smart_shopping_lists_ws_idx ON public.smart_shopping_lists (workspace_id, status);

CREATE TABLE IF NOT EXISTS public.smart_shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.smart_shopping_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  quantity TEXT NOT NULL DEFAULT '1',
  unit TEXT NOT NULL DEFAULT 'un',
  estimated_price_cents BIGINT NOT NULL DEFAULT 0,
  actual_price_cents BIGINT NOT NULL DEFAULT 0,
  is_purchased BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS smart_shopping_items_list_idx ON public.smart_shopping_items (list_id);

CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  description TEXT,
  budget_cents BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planning',
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trips_ws_date_idx ON public.trips (workspace_id, start_date);

CREATE TABLE IF NOT EXISTS public.trip_itinerary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  day_number INT NOT NULL DEFAULT 1,
  item_date TEXT NOT NULL,
  start_time TEXT NOT NULL DEFAULT '09:00',
  title TEXT NOT NULL,
  location TEXT,
  duration_minutes INT NOT NULL DEFAULT 60,
  estimated_cost_cents BIGINT NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS trip_itinerary_trip_idx ON public.trip_itinerary_items (trip_id, day_number);

CREATE TABLE IF NOT EXISTS public.trip_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'packing',
  title TEXT NOT NULL,
  is_checked BOOLEAN NOT NULL DEFAULT FALSE,
  linked_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS trip_checklist_trip_idx ON public.trip_checklist_items (trip_id);

CREATE TABLE IF NOT EXISTS public.trip_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'hotel',
  provider TEXT NOT NULL,
  reference_code TEXT,
  check_in TEXT,
  check_out TEXT,
  cost_cents BIGINT NOT NULL DEFAULT 0,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS trip_bookings_trip_idx ON public.trip_bookings (trip_id);

CREATE TABLE IF NOT EXISTS public.onboarding_states (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  onboarding_version INT NOT NULL DEFAULT 1,
  welcome_completed BOOLEAN NOT NULL DEFAULT FALSE,
  tour_status TEXT NOT NULL DEFAULT 'not_started',
  current_tour_id TEXT,
  current_step_index INT NOT NULL DEFAULT 0,
  completed_tours JSONB NOT NULL DEFAULT '[]'::jsonb,
  dismissed_tours JSONB NOT NULL DEFAULT '[]'::jsonb,
  dismissed_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  recovery_dismissed_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS across all new tables
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'day_planner_blocks',
    'task_dependencies',
    'routines',
    'routine_steps',
    'routine_runs',
    'subscriptions',
    'smart_shopping_lists',
    'smart_shopping_items',
    'trips',
    'trip_itinerary_items',
    'trip_checklist_items',
    'trip_bookings',
    'onboarding_states'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_owner_policy ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I_owner_policy ON public.%I FOR ALL USING (user_id = public.nikki_current_user_id()) WITH CHECK (user_id = public.nikki_current_user_id())',
      tbl, tbl
    );
  END LOOP;
END $$;

-- Shared Spaces policies for smart_shopping_lists & trips
DROP POLICY IF EXISTS smart_shopping_lists_space_policy ON public.smart_shopping_lists;
CREATE POLICY smart_shopping_lists_space_policy ON public.smart_shopping_lists
  FOR ALL USING (
    user_id = public.nikki_current_user_id()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = smart_shopping_lists.workspace_id
        AND wm.user_id = public.nikki_current_user_id()
    )
  );

DROP POLICY IF EXISTS trips_space_policy ON public.trips;
CREATE POLICY trips_space_policy ON public.trips
  FOR ALL USING (
    user_id = public.nikki_current_user_id()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = trips.workspace_id
        AND wm.user_id = public.nikki_current_user_id()
    )
  );
