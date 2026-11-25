import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { projects, notes, tasks } from "./core-phase2";
import { users } from "./users";
import { workspaces } from "./workspaces";

// ============================================================================
// 1. LEARNING HUB (Learning Paths -> Courses -> Modules -> Lessons)
// ============================================================================

export const learningPaths = pgTable(
  "learning_paths",
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
    icon: text("icon").notNull().default("GraduationCap"),
    color: text("color").notNull().default("#8b5cf6"),
    goal: text("goal"),
    status: text("status").notNull().default("in_progress"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("learning_paths_user_idx").on(table.userId)]
);

export const courses = pgTable(
  "courses",
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
    platform: text("platform"),
    url: text("url"),
    category: text("category"),
    status: text("status").notNull().default("in_progress"),
    estimatedMinutes: integer("estimated_minutes"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    targetDate: timestamp("target_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("courses_user_idx").on(table.userId),
    index("courses_workspace_idx").on(table.workspaceId),
  ]
);

export const learningPathCourses = pgTable(
  "learning_path_courses",
  {
    pathId: uuid("path_id")
      .notNull()
      .references(() => learningPaths.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.pathId, table.courseId] })]
);

export const courseModules = pgTable(
  "course_modules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("course_modules_course_idx").on(table.courseId)]
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => courseModules.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("not_started"),
    difficulty: text("difficulty").notNull().default("intermediate"),
    estimatedMinutes: integer("estimated_minutes"),
    externalUrl: text("external_url"),
    objectives: jsonb("objectives").$type<string[]>().notNull().default([]),
    prerequisites: jsonb("prerequisites").$type<string[]>().notNull().default([]),
    resources: jsonb("resources").$type<Array<{ title: string; url: string }>>().notNull().default([]),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("lessons_module_idx").on(table.moduleId)]
);

export const learningResourceLinks = pgTable(
  "learning_resource_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pathId: uuid("path_id").references(() => learningPaths.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id").references(() => courseModules.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "cascade" }),
    noteId: uuid("note_id").references(() => notes.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull().default("supplementary"),
    isRequired: boolean("is_required").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("learning_links_course_idx").on(table.courseId),
    index("learning_links_module_idx").on(table.moduleId),
    index("learning_links_lesson_idx").on(table.lessonId),
    index("learning_links_note_idx").on(table.noteId),
  ]
);

// ============================================================================
// 2. CALENDAR (Events, Recurrence Exceptions, Time Blocking)
// ============================================================================

export const calendarEvents = pgTable(
  "calendar_events",
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
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    isAllDay: boolean("is_all_day").notNull().default(false),
    allDayDate: text("all_day_date"),
    location: text("location"),
    color: text("color").notNull().default("#3b82f6"),
    category: text("category").notNull().default("event"),
    status: text("status").notNull().default("confirmed"),
    recurrenceRule: text("recurrence_rule"),
    recurrenceTimezone: text("recurrence_timezone"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("calendar_events_user_range_idx").on(table.userId, table.startsAt, table.endsAt),
    index("calendar_events_workspace_idx").on(table.workspaceId),
  ]
);

export const calendarEventExceptions = pgTable(
  "calendar_event_exceptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => calendarEvents.id, { onDelete: "cascade" }),
    originalOccurrence: timestamp("original_occurrence", { withTimezone: true }).notNull(),
    replacementStart: timestamp("replacement_start", { withTimezone: true }),
    replacementEnd: timestamp("replacement_end", { withTimezone: true }),
    replacementTitle: text("replacement_title"),
    isCanceled: boolean("is_canceled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("calendar_exceptions_event_occ_uidx").on(
      table.eventId,
      table.originalOccurrence
    ),
  ]
);

export const scheduledTimeBlocks = pgTable(
  "scheduled_time_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => calendarEvents.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    noteId: uuid("note_id").references(() => notes.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("time_blocks_event_idx").on(table.eventId),
    index("time_blocks_task_idx").on(table.taskId),
  ]
);

// ============================================================================
// 3. FLASHCARDS (Decks -> Flashcard Notes -> Cards -> FSRS Review History)
// ============================================================================

export const flashcardDecks = pgTable(
  "flashcard_decks",
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
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    moduleId: uuid("module_id").references(() => courseModules.id, { onDelete: "set null" }),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("flashcard_decks_user_idx").on(table.userId)]
);

export const flashcardNotes = pgTable(
  "flashcard_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    noteType: text("note_type").notNull().default("basic"),
    front: text("front").notNull(),
    back: text("back").notNull().default(""),
    clozeText: text("cloze_text"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    sourceNoteId: uuid("source_note_id").references(() => notes.id, { onDelete: "set null" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("flashcard_notes_user_idx").on(table.userId)]
);

export const flashcards = pgTable(
  "flashcards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => flashcardDecks.id, { onDelete: "cascade" }),
    flashcardNoteId: uuid("flashcard_note_id")
      .notNull()
      .references(() => flashcardNotes.id, { onDelete: "cascade" }),
    templateKey: text("template_key").notNull().default("forward"),
    front: text("front").notNull(),
    back: text("back").notNull(),
    fsrsState: integer("fsrs_state").notNull().default(0),
    stability: doublePrecision("stability").notNull().default(0),
    difficulty: doublePrecision("difficulty").notNull().default(0),
    elapsedDays: integer("elapsed_days").notNull().default(0),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).defaultNow().notNull(),
    lastReviewAt: timestamp("last_review_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("flashcards_deck_due_idx").on(table.deckId, table.dueAt),
    index("flashcards_user_due_idx").on(table.userId, table.dueAt),
  ]
);

export const flashcardReviews = pgTable(
  "flashcard_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => flashcards.id, { onDelete: "cascade" }),
    reviewRequestId: text("review_request_id").notNull().unique(),
    rating: integer("rating").notNull(),
    previousState: integer("previous_state").notNull(),
    nextState: integer("next_state").notNull(),
    elapsedDays: integer("elapsed_days").notNull(),
    scheduledDays: integer("scheduled_days").notNull(),
    algorithmVersion: text("algorithm_version").notNull().default("ts-fsrs-4"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("flashcard_reviews_card_idx").on(table.cardId),
    index("flashcard_reviews_user_date_idx").on(table.userId, table.reviewedAt),
  ]
);

// ============================================================================
// 4. FOCUS (Stopwatch, Pomodoro, Intervals, Preferences)
// ============================================================================

export const focusSessions = pgTable(
  "focus_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    mode: text("mode").notNull().default("pomodoro"),
    status: text("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    actualDurationSeconds: integer("actual_duration_seconds").notNull().default(0),
    pomodoroCycle: integer("pomodoro_cycle").notNull().default(1),
    description: text("description"),
    category: text("category"),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    calendarEventId: uuid("calendar_event_id").references(() => calendarEvents.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("focus_sessions_user_status_idx").on(table.userId, table.status),
    index("focus_sessions_user_started_idx").on(table.userId, table.startedAt),
  ]
);

export const focusSessionIntervals = pgTable(
  "focus_session_intervals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => focusSessions.id, { onDelete: "cascade" }),
    intervalType: text("interval_type").notNull().default("focus"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [index("focus_intervals_session_idx").on(table.sessionId)]
);

export const focusPreferences = pgTable("focus_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  focusMinutes: integer("focus_minutes").notNull().default(25),
  shortBreakMinutes: integer("short_break_minutes").notNull().default(5),
  longBreakMinutes: integer("long_break_minutes").notNull().default(15),
  cyclesBeforeLongBreak: integer("cycles_before_long_break").notNull().default(4),
  soundEnabled: boolean("sound_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// 5. HABITS (Habits, Entries, Activity Links)
// ============================================================================

export interface HabitScheduleConfig {
  daysOfWeek?: number[]; // 0 (Sun) .. 6 (Sat)
  targetPerPeriod?: number;
}

export const habits = pgTable(
  "habits",
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
    icon: text("icon").notNull().default("Flame"),
    color: text("color").notNull().default("#10b981"),
    category: text("category"),
    habitType: text("habit_type").notNull().default("boolean"),
    frequency: text("frequency").notNull().default("daily"),
    scheduleConfig: jsonb("schedule_config")
      .$type<HabitScheduleConfig>()
      .notNull()
      .default({}),
    targetValue: integer("target_value").notNull().default(1),
    unit: text("unit").notNull().default("times"),
    status: text("status").notNull().default("active"),
    startDate: text("start_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("habits_user_status_idx").on(table.userId, table.status)]
);

export const habitEntries = pgTable(
  "habit_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    entryDate: text("entry_date").notNull(), // YYYY-MM-DD in user's civil date
    value: integer("value").notNull().default(1),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("habit_entries_habit_date_idx").on(table.habitId, table.entryDate),
    index("habit_entries_user_date_idx").on(table.userId, table.entryDate),
  ]
);

export const habitActivityLinks = pgTable(
  "habit_activity_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    habitId: uuid("habit_id")
      .notNull()
      .unique()
      .references(() => habits.id, { onDelete: "cascade" }),
    activityType: text("activity_type").notNull(), // 'focus_minutes' | 'lessons_completed' | 'flashcards_reviewed'
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    category: text("category"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("habit_links_user_idx").on(table.userId)]
);
