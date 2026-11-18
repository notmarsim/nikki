-- Nikki Phase 5: Personal Finances, Advanced Analytics & Comprehensive Settings

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "preferences" jsonb NOT NULL DEFAULT '{}'::jsonb;

-- =============================================================================
-- PERSONAL FINANCES
-- =============================================================================

CREATE TABLE IF NOT EXISTS "finance_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "account_type" text NOT NULL DEFAULT 'checking',
  "institution" text,
  "color" text NOT NULL DEFAULT '#10b981',
  "icon" text NOT NULL DEFAULT 'Wallet',
  "currency" text NOT NULL DEFAULT 'BRL',
  "initial_balance_cents" bigint NOT NULL DEFAULT 0,
  "balance_reference_date" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "finance_accounts_user_idx" ON "finance_accounts" ("user_id", "workspace_id");

CREATE TABLE IF NOT EXISTS "finance_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "parent_id" uuid,
  "name" text NOT NULL,
  "kind" text NOT NULL DEFAULT 'expense',
  "color" text NOT NULL DEFAULT '#64748b',
  "icon" text NOT NULL DEFAULT 'Tag',
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_archived" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "finance_categories_user_idx" ON "finance_categories" ("user_id", "workspace_id");

CREATE TABLE IF NOT EXISTS "finance_credit_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "institution" text NOT NULL DEFAULT '',
  "last4" text,
  "brand" text,
  "credit_limit_cents" bigint NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'BRL',
  "closing_day" integer NOT NULL DEFAULT 10,
  "due_day" integer NOT NULL DEFAULT 17,
  "payment_account_id" uuid REFERENCES "finance_accounts"("id") ON DELETE SET NULL,
  "color" text NOT NULL DEFAULT '#8b5cf6',
  "icon" text NOT NULL DEFAULT 'CreditCard',
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "finance_credit_cards_user_idx" ON "finance_credit_cards" ("user_id", "workspace_id");

CREATE TABLE IF NOT EXISTS "finance_statements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "card_id" uuid NOT NULL REFERENCES "finance_credit_cards"("id") ON DELETE CASCADE,
  "period_key" text NOT NULL,
  "closing_date" text NOT NULL,
  "due_date" text NOT NULL,
  "total_cents" bigint NOT NULL DEFAULT 0,
  "paid_cents" bigint NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'open',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "finance_statements_card_period_uidx" ON "finance_statements" ("card_id", "period_key");
CREATE INDEX IF NOT EXISTS "finance_statements_user_idx" ON "finance_statements" ("user_id");

CREATE TABLE IF NOT EXISTS "finance_card_purchases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "card_id" uuid NOT NULL REFERENCES "finance_credit_cards"("id") ON DELETE CASCADE,
  "category_id" uuid REFERENCES "finance_categories"("id") ON DELETE SET NULL,
  "description" text NOT NULL,
  "total_cents" bigint NOT NULL,
  "installments_count" integer NOT NULL DEFAULT 1,
  "purchase_date" text NOT NULL,
  "status" text NOT NULL DEFAULT 'confirmed',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "finance_card_purchases_card_idx" ON "finance_card_purchases" ("card_id", "purchase_date");

CREATE TABLE IF NOT EXISTS "finance_installments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "purchase_id" uuid NOT NULL REFERENCES "finance_card_purchases"("id") ON DELETE CASCADE,
  "card_id" uuid NOT NULL REFERENCES "finance_credit_cards"("id") ON DELETE CASCADE,
  "statement_id" uuid NOT NULL REFERENCES "finance_statements"("id") ON DELETE CASCADE,
  "installment_number" integer NOT NULL,
  "total_installments" integer NOT NULL,
  "amount_cents" bigint NOT NULL,
  "due_date" text NOT NULL,
  "status" text NOT NULL DEFAULT 'scheduled',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "finance_installments_statement_idx" ON "finance_installments" ("statement_id");
CREATE INDEX IF NOT EXISTS "finance_installments_purchase_idx" ON "finance_installments" ("purchase_id");

CREATE TABLE IF NOT EXISTS "finance_recurring_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "type" text NOT NULL DEFAULT 'expense',
  "amount_cents" bigint NOT NULL,
  "currency" text NOT NULL DEFAULT 'BRL',
  "account_id" uuid REFERENCES "finance_accounts"("id") ON DELETE SET NULL,
  "category_id" uuid REFERENCES "finance_categories"("id") ON DELETE SET NULL,
  "frequency" text NOT NULL DEFAULT 'monthly',
  "interval_value" integer NOT NULL DEFAULT 1,
  "start_date" text NOT NULL,
  "end_date" text,
  "next_occurrence" text NOT NULL,
  "auto_confirm" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "finance_recurring_user_idx" ON "finance_recurring_rules" ("user_id", "status");

CREATE TABLE IF NOT EXISTS "finance_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "account_id" uuid REFERENCES "finance_accounts"("id") ON DELETE RESTRICT,
  "target_account_id" uuid REFERENCES "finance_accounts"("id") ON DELETE RESTRICT,
  "card_id" uuid REFERENCES "finance_credit_cards"("id") ON DELETE SET NULL,
  "statement_id" uuid REFERENCES "finance_statements"("id") ON DELETE SET NULL,
  "category_id" uuid REFERENCES "finance_categories"("id") ON DELETE SET NULL,
  "type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'confirmed',
  "amount_cents" bigint NOT NULL,
  "fee_cents" bigint NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'BRL',
  "description" text NOT NULL,
  "transaction_date" text NOT NULL,
  "notes" text,
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "recurring_rule_id" uuid REFERENCES "finance_recurring_rules"("id") ON DELETE SET NULL,
  "recurrence_occurrence_key" text,
  "transfer_group_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "finance_transactions_user_date_idx" ON "finance_transactions" ("user_id", "transaction_date");
CREATE INDEX IF NOT EXISTS "finance_transactions_account_idx" ON "finance_transactions" ("account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_transactions_recurrence_uidx" ON "finance_transactions" ("recurring_rule_id", "recurrence_occurrence_key");

CREATE TABLE IF NOT EXISTS "finance_transaction_splits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "transaction_id" uuid NOT NULL REFERENCES "finance_transactions"("id") ON DELETE CASCADE,
  "category_id" uuid REFERENCES "finance_categories"("id") ON DELETE SET NULL,
  "amount_cents" bigint NOT NULL,
  "description" text
);
CREATE INDEX IF NOT EXISTS "finance_splits_tx_idx" ON "finance_transaction_splits" ("transaction_id");

CREATE TABLE IF NOT EXISTS "finance_budgets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "category_id" uuid REFERENCES "finance_categories"("id") ON DELETE SET NULL,
  "period" text NOT NULL DEFAULT 'monthly',
  "limit_cents" bigint NOT NULL,
  "currency" text NOT NULL DEFAULT 'BRL',
  "rollover_enabled" boolean NOT NULL DEFAULT false,
  "alert_thresholds" jsonb NOT NULL DEFAULT '[50,75,90,100]'::jsonb,
  "alerted_thresholds" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" text NOT NULL DEFAULT 'active',
  "start_date" text,
  "end_date" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "finance_budgets_user_idx" ON "finance_budgets" ("user_id", "status");

CREATE TABLE IF NOT EXISTS "finance_goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "target_cents" bigint NOT NULL,
  "reserved_cents" bigint NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'BRL',
  "deadline" text,
  "category" text,
  "color" text NOT NULL DEFAULT '#3b82f6',
  "icon" text NOT NULL DEFAULT 'Target',
  "linked_account_id" uuid REFERENCES "finance_accounts"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "finance_goals_user_idx" ON "finance_goals" ("user_id", "status");

CREATE TABLE IF NOT EXISTS "finance_goal_contributions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "goal_id" uuid NOT NULL REFERENCES "finance_goals"("id") ON DELETE CASCADE,
  "amount_cents" bigint NOT NULL,
  "kind" text NOT NULL DEFAULT 'contribution',
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "finance_goal_contrib_goal_idx" ON "finance_goal_contributions" ("goal_id");

CREATE TABLE IF NOT EXISTS "finance_import_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "account_id" uuid NOT NULL REFERENCES "finance_accounts"("id") ON DELETE CASCADE,
  "filename" text NOT NULL,
  "total_rows" integer NOT NULL,
  "imported_rows" integer NOT NULL,
  "skipped_rows" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'completed',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "finance_import_user_idx" ON "finance_import_batches" ("user_id");

CREATE TABLE IF NOT EXISTS "analytics_saved_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "module" text NOT NULL,
  "metric" text NOT NULL,
  "group_by" text NOT NULL DEFAULT 'day',
  "chart_type" text NOT NULL DEFAULT 'bar',
  "period" text NOT NULL DEFAULT '30d',
  "filters" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_favorite" boolean NOT NULL DEFAULT false,
  "pin_to_dashboard" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "analytics_reports_user_idx" ON "analytics_saved_reports" ("user_id", "workspace_id");

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE "finance_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_credit_cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_statements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_card_purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_installments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_recurring_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_transaction_splits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_budgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_goal_contributions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_import_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analytics_saved_reports" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_accounts_owner_policy" ON "finance_accounts";
CREATE POLICY "finance_accounts_owner_policy" ON "finance_accounts" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "finance_categories_owner_policy" ON "finance_categories";
CREATE POLICY "finance_categories_owner_policy" ON "finance_categories" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "finance_credit_cards_owner_policy" ON "finance_credit_cards";
CREATE POLICY "finance_credit_cards_owner_policy" ON "finance_credit_cards" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "finance_statements_owner_policy" ON "finance_statements";
CREATE POLICY "finance_statements_owner_policy" ON "finance_statements" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "finance_card_purchases_owner_policy" ON "finance_card_purchases";
CREATE POLICY "finance_card_purchases_owner_policy" ON "finance_card_purchases" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "finance_installments_owner_policy" ON "finance_installments";
CREATE POLICY "finance_installments_owner_policy" ON "finance_installments" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "finance_recurring_rules_owner_policy" ON "finance_recurring_rules";
CREATE POLICY "finance_recurring_rules_owner_policy" ON "finance_recurring_rules" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "finance_transactions_owner_policy" ON "finance_transactions";
CREATE POLICY "finance_transactions_owner_policy" ON "finance_transactions" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "finance_transaction_splits_owner_policy" ON "finance_transaction_splits";
CREATE POLICY "finance_transaction_splits_owner_policy" ON "finance_transaction_splits" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "finance_budgets_owner_policy" ON "finance_budgets";
CREATE POLICY "finance_budgets_owner_policy" ON "finance_budgets" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "finance_goals_owner_policy" ON "finance_goals";
CREATE POLICY "finance_goals_owner_policy" ON "finance_goals" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "finance_goal_contributions_owner_policy" ON "finance_goal_contributions";
CREATE POLICY "finance_goal_contributions_owner_policy" ON "finance_goal_contributions" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "finance_import_batches_owner_policy" ON "finance_import_batches";
CREATE POLICY "finance_import_batches_owner_policy" ON "finance_import_batches" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "analytics_saved_reports_owner_policy" ON "analytics_saved_reports";
CREATE POLICY "analytics_saved_reports_owner_policy" ON "analytics_saved_reports" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());
