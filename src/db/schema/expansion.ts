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
import { tasks } from "./core-phase2";
import { calendarEvents, habits } from "./phase3";
import { financeRecurringRules, financeTransactions } from "./phase5";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const dayPlannerBlocks = pgTable(
  "day_planner_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    planDate: text("plan_date").notNull(), // YYYY-MM-DD
    title: text("title").notNull(),
    sourceType: text("source_type").notNull().default("task"), // task | routine | custom | blocked
    sourceId: uuid("source_id"),
    startMinute: integer("start_minute").notNull(), // 0..1439
    endMinute: integer("end_minute").notNull(), // 1..1440
    status: text("status").notNull().default("suggested"), // suggested | accepted | completed | skipped
    priority: text("priority").notNull().default("medium"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("day_planner_blocks_user_date_idx").on(table.userId, table.workspaceId, table.planDate),
  ]
);

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    dependsOnTaskId: uuid("depends_on_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("task_dependencies_pair_uidx").on(table.taskId, table.dependsOnTaskId),
    index("task_dependencies_dep_idx").on(table.dependsOnTaskId),
  ]
);

export const routines = pgTable(
  "routines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    scheduledTime: text("scheduled_time").default("08:00"),
    recurrenceDays: jsonb("recurrence_days").$type<string[]>().notNull().default([]),
    isTemplate: boolean("is_template").notNull().default(false),
    isPaused: boolean("is_paused").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("routines_user_ws_idx").on(table.userId, table.workspaceId)]
);

export const routineSteps = pgTable(
  "routine_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(15),
    sortOrder: integer("sort_order").notNull().default(0),
    linkedHabitId: uuid("linked_habit_id").references(() => habits.id, { onDelete: "set null" }),
    linkedTaskId: uuid("linked_task_id").references(() => tasks.id, { onDelete: "set null" }),
  },
  (table) => [index("routine_steps_routine_idx").on(table.routineId, table.sortOrder)]
);

export const routineRuns = pgTable(
  "routine_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("running"), // running | paused | completed | cancelled
    currentStepIndex: integer("current_step_index").notNull().default(0),
    stepStates: jsonb("step_states")
      .$type<Record<string, "pending" | "completed" | "skipped">>()
      .notNull()
      .default({}),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("routine_runs_routine_idx").on(table.routineId, table.startedAt)]
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull().default("Software"),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    billingCycle: text("billing_cycle").notNull().default("monthly"), // weekly | monthly | quarterly | yearly
    nextBillingDate: text("next_billing_date").notNull(), // YYYY-MM-DD
    renewalDate: text("renewal_date"),
    trialEndsAt: text("trial_ends_at"),
    status: text("status").notNull().default("active"), // active | trial | paused | cancelled
    paymentLabel: text("payment_label"),
    notes: text("notes"),
    recurringRuleId: uuid("recurring_rule_id").references(() => financeRecurringRules.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("subscriptions_user_ws_idx").on(table.userId, table.workspaceId, table.nextBillingDate)]
);

export const smartShoppingLists = pgTable(
  "smart_shopping_lists",
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
    category: text("category").notNull().default("Groceries"),
    status: text("status").notNull().default("active"), // active | completed | archived
    totalEstimatedCents: bigint("total_estimated_cents", { mode: "number" }).notNull().default(0),
    totalActualCents: bigint("total_actual_cents", { mode: "number" }).notNull().default(0),
    linkedTransactionId: uuid("linked_transaction_id").references(() => financeTransactions.id, {
      onDelete: "set null",
    }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("smart_shopping_lists_ws_idx").on(table.workspaceId, table.status)]
);

export const smartShoppingItems = pgTable(
  "smart_shopping_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listId: uuid("list_id")
      .notNull()
      .references(() => smartShoppingLists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull().default("General"),
    quantity: text("quantity").notNull().default("1"),
    unit: text("unit").notNull().default("un"),
    estimatedPriceCents: bigint("estimated_price_cents", { mode: "number" }).notNull().default(0),
    actualPriceCents: bigint("actual_price_cents", { mode: "number" }).notNull().default(0),
    isPurchased: boolean("is_purchased").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("smart_shopping_items_list_idx").on(table.listId)]
);

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    destination: text("destination").notNull(),
    startDate: text("start_date").notNull(), // YYYY-MM-DD
    endDate: text("end_date").notNull(),
    description: text("description"),
    budgetCents: bigint("budget_cents", { mode: "number" }).notNull().default(0),
    status: text("status").notNull().default("planning"), // planning | booked | ongoing | completed | cancelled
    participants: jsonb("participants").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("trips_ws_date_idx").on(table.workspaceId, table.startDate)]
);

export const tripItineraryItems = pgTable(
  "trip_itinerary_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull().default(1),
    itemDate: text("item_date").notNull(), // YYYY-MM-DD
    startTime: text("start_time").notNull().default("09:00"),
    title: text("title").notNull(),
    location: text("location"),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    estimatedCostCents: bigint("estimated_cost_cents", { mode: "number" }).notNull().default(0),
    notes: text("notes"),
    status: text("status").notNull().default("planned"), // planned | done | skipped
    calendarEventId: uuid("calendar_event_id").references(() => calendarEvents.id, {
      onDelete: "set null",
    }),
  },
  (table) => [index("trip_itinerary_trip_idx").on(table.tripId, table.dayNumber)]
);

export const tripChecklistItems = pgTable(
  "trip_checklist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("packing"), // packing | prep
    title: text("title").notNull(),
    isChecked: boolean("is_checked").notNull().default(false),
    linkedTaskId: uuid("linked_task_id").references(() => tasks.id, { onDelete: "set null" }),
  },
  (table) => [index("trip_checklist_trip_idx").on(table.tripId)]
);

export const tripBookings = pgTable(
  "trip_bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("hotel"), // flight | hotel | transport | activity | other
    provider: text("provider").notNull(),
    referenceCode: text("reference_code"),
    checkIn: text("check_in"),
    checkOut: text("check_out"),
    costCents: bigint("cost_cents", { mode: "number" }).notNull().default(0),
    notes: text("notes"),
  },
  (table) => [index("trip_bookings_trip_idx").on(table.tripId)]
);

export const onboardingStates = pgTable("onboarding_states", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  onboardingVersion: integer("onboarding_version").notNull().default(1),
  welcomeCompleted: boolean("welcome_completed").notNull().default(false),
  tourStatus: text("tour_status").notNull().default("not_started"), // not_started | in_progress | completed | skipped
  currentTourId: text("current_tour_id"),
  currentStepIndex: integer("current_step_index").notNull().default(0),
  completedTours: jsonb("completed_tours").$type<string[]>().notNull().default([]),
  dismissedTours: jsonb("dismissed_tours").$type<string[]>().notNull().default([]),
  dismissedSuggestions: jsonb("dismissed_suggestions").$type<string[]>().notNull().default([]),
  recoveryDismissedUntil: timestamp("recovery_dismissed_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
