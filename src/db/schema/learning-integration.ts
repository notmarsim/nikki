import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { notes } from "./core-phase2";
import { courseModules, courses, flashcardDecks, lessons } from "./phase3";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const lessonContents = pgTable(
  "lesson_contents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull().default("text"),
    title: text("title").notNull(),
    body: text("body"),
    url: text("url"),
    noteId: uuid("note_id").references(() => notes.id, { onDelete: "set null" }),
    deckId: uuid("deck_id").references(() => flashcardDecks.id, { onDelete: "set null" }),
    quizId: uuid("quiz_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    isRequired: boolean("is_required").notNull().default(true),
    isCompleted: boolean("is_completed").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("lesson_contents_lesson_idx").on(table.lessonId, table.sortOrder),
    index("lesson_contents_note_idx").on(table.noteId),
  ]
);

export const studySessions = pgTable(
  "study_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    moduleId: uuid("module_id").references(() => courseModules.id, { onDelete: "set null" }),
    lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    noteId: uuid("note_id").references(() => notes.id, { onDelete: "set null" }),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    lessonsCompleted: integer("lessons_completed").notNull().default(0),
    flashcardsReviewed: integer("flashcards_reviewed").notNull().default(0),
    quizScorePercent: integer("quiz_score_percent"),
    difficultyRating: text("difficulty_rating"),
    flaggedForReview: boolean("flagged_for_review").notNull().default(false),
    notesText: text("notes_text"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [
    index("study_sessions_user_idx").on(table.userId, table.startedAt),
    index("study_sessions_course_idx").on(table.courseId),
  ]
);

export const learningReviews = pgTable(
  "learning_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    title: text("title").notNull(),
    easeFactor: doublePrecision("ease_factor").notNull().default(2.5),
    intervalDays: integer("interval_days").notNull().default(1),
    repetitions: integer("repetitions").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    lastRating: text("last_rating"),
    paused: boolean("paused").notNull().default(false),
    dueAt: timestamp("due_at", { withTimezone: true }).defaultNow().notNull(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("learning_reviews_user_due_idx").on(table.userId, table.dueAt),
    index("learning_reviews_entity_idx").on(table.entityType, table.entityId),
  ]
);

export const quizzes = pgTable(
  "quizzes",
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
    lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    noteId: uuid("note_id").references(() => notes.id, { onDelete: "set null" }),
    passingScore: integer("passing_score").notNull().default(70),
    shuffleQuestions: boolean("shuffle_questions").notNull().default(false),
    maxAttempts: integer("max_attempts"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("quizzes_user_idx").on(table.userId),
    index("quizzes_course_idx").on(table.courseId),
    index("quizzes_lesson_idx").on(table.lessonId),
    index("quizzes_note_idx").on(table.noteId),
  ]
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    questionType: text("question_type").notNull().default("multiple_choice"),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>().notNull().default([]),
    correctAnswers: jsonb("correct_answers").$type<string[]>().notNull().default([]),
    referenceAnswer: text("reference_answer"),
    explanation: text("explanation"),
    points: integer("points").notNull().default(1),
    difficulty: text("difficulty").notNull().default("medium"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("quiz_questions_quiz_idx").on(table.quizId, table.sortOrder)]
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    scorePercent: integer("score_percent").notNull().default(0),
    passed: boolean("passed").notNull().default(false),
    answers: jsonb("answers")
      .$type<
        Array<{
          questionId: string;
          selected: string[];
          textAnswer?: string;
          isCorrect: boolean;
        }>
      >()
      .notNull()
      .default([]),
    completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("quiz_attempts_quiz_idx").on(table.quizId, table.completedAt)]
);
