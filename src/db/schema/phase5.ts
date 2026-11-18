import {
  bigint,
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
import { users } from "./users";
import { workspaces } from "./workspaces";

// =============================================================================
// PERSONAL FINANCES (INTEGER-CENT PRECISION VIA BIGINT)
// =============================================================================

export const financeAccounts = pgTable(
  "finance_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    accountType: text("account_type").notNull().default("checking"), // cash|checking|savings|wallet|investment|other
    institution: text("institution"),
    color: text("color").notNull().default("#10b981"),
    icon: text("icon").notNull().default("Wallet"),
    currency: text("currency").notNull().default("BRL"),
    initialBalanceCents: bigint("initial_balance_cents", { mode: "number" })
      .notNull()
      .default(0),
    balanceReferenceDate: text("balance_reference_date").notNull(),
    status: text("status").notNull().default("active"), // active|archived
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("finance_accounts_user_idx").on(table.userId, table.workspaceId),
  ]
);

export const financeCategories = pgTable(
  "finance_categories",
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
    kind: text("kind").notNull().default("expense"), // income|expense
    color: text("color").notNull().default("#64748b"),
    icon: text("icon").notNull().default("Tag"),
    sortOrder: integer("sort_order").notNull().default(0),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("finance_categories_user_idx").on(table.userId, table.workspaceId),
  ]
);

export const financeCreditCards = pgTable(
  "finance_credit_cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    institution: text("institution").notNull().default(""),
    last4: text("last4"),
    brand: text("brand"),
    creditLimitCents: bigint("credit_limit_cents", { mode: "number" })
      .notNull()
      .default(0),
    currency: text("currency").notNull().default("BRL"),
    closingDay: integer("closing_day").notNull().default(10),
    dueDay: integer("due_day").notNull().default(17),
    paymentAccountId: uuid("payment_account_id").references(() => financeAccounts.id, {
      onDelete: "set null",
    }),
    color: text("color").notNull().default("#8b5cf6"),
    icon: text("icon").notNull().default("CreditCard"),
    status: text("status").notNull().default("active"), // active|archived
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("finance_credit_cards_user_idx").on(table.userId, table.workspaceId),
  ]
);

export const financeStatements = pgTable(
  "finance_statements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => financeCreditCards.id, { onDelete: "cascade" }),
    periodKey: text("period_key").notNull(), // YYYY-MM
    closingDate: text("closing_date").notNull(),
    dueDate: text("due_date").notNull(),
    totalCents: bigint("total_cents", { mode: "number" }).notNull().default(0),
    paidCents: bigint("paid_cents", { mode: "number" }).notNull().default(0),
    status: text("status").notNull().default("open"), // open|closed|partially_paid|paid|overdue
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("finance_statements_card_period_uidx").on(table.cardId, table.periodKey),
    index("finance_statements_user_idx").on(table.userId),
  ]
);

export const financeCardPurchases = pgTable(
  "finance_card_purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => financeCreditCards.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => financeCategories.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),
    installmentsCount: integer("installments_count").notNull().default(1),
    purchaseDate: text("purchase_date").notNull(), // YYYY-MM-DD
    status: text("status").notNull().default("confirmed"), // confirmed|canceled|refunded
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("finance_card_purchases_card_idx").on(table.cardId, table.purchaseDate)]
);

export const financeInstallments = pgTable(
  "finance_installments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => financeCardPurchases.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => financeCreditCards.id, { onDelete: "cascade" }),
    statementId: uuid("statement_id")
      .notNull()
      .references(() => financeStatements.id, { onDelete: "cascade" }),
    installmentNumber: integer("installment_number").notNull(),
    totalInstallments: integer("total_installments").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    dueDate: text("due_date").notNull(),
    status: text("status").notNull().default("scheduled"), // scheduled|posted|paid|canceled
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("finance_installments_statement_idx").on(table.statementId),
    index("finance_installments_purchase_idx").on(table.purchaseId),
  ]
);

export const financeRecurringRules = pgTable(
  "finance_recurring_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull().default("expense"), // income|expense
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    accountId: uuid("account_id").references(() => financeAccounts.id, {
      onDelete: "set null",
    }),
    categoryId: uuid("category_id").references(() => financeCategories.id, {
      onDelete: "set null",
    }),
    frequency: text("frequency").notNull().default("monthly"), // daily|weekly|monthly|annual|custom
    intervalValue: integer("interval_value").notNull().default(1),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    nextOccurrence: text("next_occurrence").notNull(),
    autoConfirm: boolean("auto_confirm").notNull().default(false),
    status: text("status").notNull().default("active"), // active|paused|archived
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("finance_recurring_user_idx").on(table.userId, table.status)]
);

export const financeTransactions = pgTable(
  "finance_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => financeAccounts.id, {
      onDelete: "restrict",
    }),
    targetAccountId: uuid("target_account_id").references(() => financeAccounts.id, {
      onDelete: "restrict",
    }),
    cardId: uuid("card_id").references(() => financeCreditCards.id, {
      onDelete: "set null",
    }),
    statementId: uuid("statement_id").references(() => financeStatements.id, {
      onDelete: "set null",
    }),
    categoryId: uuid("category_id").references(() => financeCategories.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(), // income|expense|transfer|adjustment|refund|card_payment
    status: text("status").notNull().default("confirmed"), // pending|confirmed|canceled
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    feeCents: bigint("fee_cents", { mode: "number" }).notNull().default(0),
    currency: text("currency").notNull().default("BRL"),
    description: text("description").notNull(),
    transactionDate: text("transaction_date").notNull(), // YYYY-MM-DD
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    recurringRuleId: uuid("recurring_rule_id").references(() => financeRecurringRules.id, {
      onDelete: "set null",
    }),
    recurrenceOccurrenceKey: text("recurrence_occurrence_key"),
    transferGroupId: uuid("transfer_group_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("finance_transactions_user_date_idx").on(table.userId, table.transactionDate),
    index("finance_transactions_account_idx").on(table.accountId),
    uniqueIndex("finance_transactions_recurrence_uidx").on(
      table.recurringRuleId,
      table.recurrenceOccurrenceKey
    ),
  ]
);

export const financeTransactionSplits = pgTable(
  "finance_transaction_splits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => financeTransactions.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => financeCategories.id, {
      onDelete: "set null",
    }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    description: text("description"),
  },
  (table) => [index("finance_splits_tx_idx").on(table.transactionId)]
);

export const financeBudgets = pgTable(
  "finance_budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    categoryId: uuid("category_id").references(() => financeCategories.id, {
      onDelete: "set null",
    }),
    period: text("period").notNull().default("monthly"), // weekly|monthly|annual|custom
    limitCents: bigint("limit_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    rolloverEnabled: boolean("rollover_enabled").notNull().default(false),
    alertThresholds: jsonb("alert_thresholds")
      .$type<number[]>()
      .notNull()
      .default([50, 75, 90, 100]),
    alertedThresholds: jsonb("alerted_thresholds")
      .$type<number[]>()
      .notNull()
      .default([]),
    status: text("status").notNull().default("active"), // active|archived
    startDate: text("start_date"),
    endDate: text("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("finance_budgets_user_idx").on(table.userId, table.status)]
);

export const financeGoals = pgTable(
  "finance_goals",
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
    targetCents: bigint("target_cents", { mode: "number" }).notNull(),
    reservedCents: bigint("reserved_cents", { mode: "number" }).notNull().default(0),
    currency: text("currency").notNull().default("BRL"),
    deadline: text("deadline"),
    category: text("category"),
    color: text("color").notNull().default("#3b82f6"),
    icon: text("icon").notNull().default("Target"),
    linkedAccountId: uuid("linked_account_id").references(() => financeAccounts.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("active"), // active|completed|archived
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("finance_goals_user_idx").on(table.userId, table.status)]
);

export const financeGoalContributions = pgTable(
  "finance_goal_contributions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => financeGoals.id, { onDelete: "cascade" }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    kind: text("kind").notNull().default("contribution"), // contribution|withdrawal
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("finance_goal_contrib_goal_idx").on(table.goalId)]
);

export const financeImportBatches = pgTable(
  "finance_import_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => financeAccounts.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    totalRows: integer("total_rows").notNull(),
    importedRows: integer("imported_rows").notNull(),
    skippedRows: integer("skipped_rows").notNull(),
    status: text("status").notNull().default("completed"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("finance_import_user_idx").on(table.userId)]
);

// =============================================================================
// ANALYTICS CUSTOM SAVED REPORTS
// =============================================================================

export const analyticsSavedReports = pgTable(
  "analytics_saved_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    module: text("module").notNull(), // tasks|focus|learning|habits|flashcards|finances
    metric: text("metric").notNull(),
    groupBy: text("group_by").notNull().default("day"), // day|week|month|category|project
    chartType: text("chart_type").notNull().default("bar"), // bar|line|donut|table
    period: text("period").notNull().default("30d"), // 7d|30d|month|year
    filters: jsonb("filters").$type<Record<string, unknown>>().notNull().default({}),
    isFavorite: boolean("is_favorite").notNull().default(false),
    pinToDashboard: boolean("pin_to_dashboard").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("analytics_reports_user_idx").on(table.userId, table.workspaceId)]
);

export type FinanceAccountRecord = typeof financeAccounts.$inferSelect;
export type FinanceCategoryRecord = typeof financeCategories.$inferSelect;
export type FinanceCreditCardRecord = typeof financeCreditCards.$inferSelect;
export type FinanceStatementRecord = typeof financeStatements.$inferSelect;
export type FinanceCardPurchaseRecord = typeof financeCardPurchases.$inferSelect;
export type FinanceInstallmentRecord = typeof financeInstallments.$inferSelect;
export type FinanceRecurringRuleRecord = typeof financeRecurringRules.$inferSelect;
export type FinanceTransactionRecord = typeof financeTransactions.$inferSelect;
export type FinanceBudgetRecord = typeof financeBudgets.$inferSelect;
export type FinanceGoalRecord = typeof financeGoals.$inferSelect;
export type AnalyticsSavedReportRecord = typeof analyticsSavedReports.$inferSelect;
