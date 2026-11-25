import { and, asc, desc, eq, inArray, isNull, lte } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  calendarEvents,
  courseModules,
  courses,
  flashcardDecks,
  flashcardNotes,
  flashcards,
  learningPaths,
  learningResourceLinks,
  learningReviews,
  lessonContents,
  lessons,
  notes,
  quizAttempts,
  quizQuestions,
  quizzes,
  studySessions,
  tasks,
} from "@/db/schema";
import { recordActivity } from "@/modules/activity/service";
import { LearningServiceError } from "./service";
import {
  computeNextReviewSchedule,
  estimateReadingMinutes,
  type ReviewRating,
} from "./spaced-repetition";

export type NoteLinkPurpose =
  | "main_content"
  | "supplementary"
  | "reference"
  | "exercise"
  | "summary"
  | "personal_annotation";

export async function linkNoteToLearning(
  userId: string,
  input: {
    noteId: string;
    pathId?: string | null;
    courseId?: string | null;
    moduleId?: string | null;
    lessonId?: string | null;
    purpose?: NoteLinkPurpose;
    isRequired?: boolean;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [noteRow] = await tx
      .select({ id: notes.id, title: notes.title })
      .from(notes)
      .where(and(eq(notes.id, input.noteId), eq(notes.userId, userId), isNull(notes.deletedAt)))
      .limit(1);
    if (!noteRow) {
      throw new LearningServiceError(404, "NOTE_NOT_FOUND", "Note not found");
    }

    let resolvedCourseId = input.courseId ?? null;
    let resolvedModuleId = input.moduleId ?? null;

    if (input.lessonId) {
      const [lRow] = await tx
        .select({ id: lessons.id, moduleId: lessons.moduleId })
        .from(lessons)
        .where(and(eq(lessons.id, input.lessonId), eq(lessons.userId, userId)))
        .limit(1);
      if (!lRow) throw new LearningServiceError(404, "LESSON_NOT_FOUND", "Lesson not found");
      resolvedModuleId = lRow.moduleId;
    }

    if (resolvedModuleId) {
      const [mRow] = await tx
        .select({ id: courseModules.id, courseId: courseModules.courseId })
        .from(courseModules)
        .where(and(eq(courseModules.id, resolvedModuleId), eq(courseModules.userId, userId)))
        .limit(1);
      if (!mRow) throw new LearningServiceError(404, "MODULE_NOT_FOUND", "Module not found");
      resolvedCourseId = mRow.courseId;
    }

    if (resolvedCourseId) {
      const [cRow] = await tx
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.id, resolvedCourseId), eq(courses.userId, userId)))
        .limit(1);
      if (!cRow) throw new LearningServiceError(404, "COURSE_NOT_FOUND", "Course not found");
    }

    if (input.pathId) {
      const [pRow] = await tx
        .select({ id: learningPaths.id })
        .from(learningPaths)
        .where(and(eq(learningPaths.id, input.pathId), eq(learningPaths.userId, userId)))
        .limit(1);
      if (!pRow) throw new LearningServiceError(404, "PATH_NOT_FOUND", "Learning path not found");
    }

    // Prevent duplicate link for exact same note + target
    const existingLinks = await tx
      .select()
      .from(learningResourceLinks)
      .where(
        and(
          eq(learningResourceLinks.userId, userId),
          eq(learningResourceLinks.noteId, input.noteId)
        )
      );

    const dup = existingLinks.find(
      (l) =>
        (l.lessonId ?? null) === (input.lessonId ?? null) &&
        (l.moduleId ?? null) === (resolvedModuleId ?? null) &&
        (l.courseId ?? null) === (resolvedCourseId ?? null) &&
        (l.pathId ?? null) === (input.pathId ?? null)
    );
    if (dup) {
      return dup;
    }

    const [created] = await tx
      .insert(learningResourceLinks)
      .values({
        userId,
        noteId: input.noteId,
        pathId: input.pathId ?? null,
        courseId: resolvedCourseId,
        moduleId: resolvedModuleId,
        lessonId: input.lessonId ?? null,
        purpose: input.purpose ?? "supplementary",
        isRequired: input.isRequired ?? true,
        sortOrder: existingLinks.length,
      })
      .returning();

    // If linked to a lesson, also mirror as a lessonContent item of type "note" if not present
    if (input.lessonId) {
      const existingContent = await tx
        .select({ id: lessonContents.id })
        .from(lessonContents)
        .where(
          and(
            eq(lessonContents.lessonId, input.lessonId),
            eq(lessonContents.noteId, input.noteId),
            eq(lessonContents.userId, userId)
          )
        )
        .limit(1);
      if (!existingContent[0]) {
        const countRows = await tx
          .select({ id: lessonContents.id })
          .from(lessonContents)
          .where(eq(lessonContents.lessonId, input.lessonId));
        await tx.insert(lessonContents).values({
          userId,
          lessonId: input.lessonId,
          contentType: "note",
          title: noteRow.title,
          noteId: input.noteId,
          metadata: { purpose: input.purpose ?? "supplementary" },
          isRequired: input.isRequired ?? true,
          sortOrder: countRows.length,
        });
      }
    }

    return created!;
  });
}

export async function unlinkLearningResource(userId: string, linkId: string) {
  return withUserRls(userId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(learningResourceLinks)
      .where(and(eq(learningResourceLinks.id, linkId), eq(learningResourceLinks.userId, userId)))
      .limit(1);
    if (!existing) {
      throw new LearningServiceError(404, "LINK_NOT_FOUND", "Link not found");
    }

    await tx
      .delete(learningResourceLinks)
      .where(and(eq(learningResourceLinks.id, linkId), eq(learningResourceLinks.userId, userId)));

    if (existing.lessonId && existing.noteId) {
      await tx
        .delete(lessonContents)
        .where(
          and(
            eq(lessonContents.lessonId, existing.lessonId),
            eq(lessonContents.noteId, existing.noteId),
            eq(lessonContents.userId, userId)
          )
        );
    }

    return { unlinked: true, id: linkId };
  });
}

export async function getNoteLinkedLearning(userId: string, noteId: string) {
  return withUserRls(userId, async (tx) => {
    const links = await tx
      .select()
      .from(learningResourceLinks)
      .where(
        and(eq(learningResourceLinks.userId, userId), eq(learningResourceLinks.noteId, noteId))
      )
      .orderBy(asc(learningResourceLinks.sortOrder));

    if (links.length === 0) return [];

    const courseIds = Array.from(new Set(links.map((l) => l.courseId).filter((v): v is string => Boolean(v))));
    const moduleIds = Array.from(new Set(links.map((l) => l.moduleId).filter((v): v is string => Boolean(v))));
    const lessonIds = Array.from(new Set(links.map((l) => l.lessonId).filter((v): v is string => Boolean(v))));
    const pathIds = Array.from(new Set(links.map((l) => l.pathId).filter((v): v is string => Boolean(v))));

    const [courseRows, moduleRows, lessonRows, pathRows] = await Promise.all([
      courseIds.length > 0
        ? tx.select().from(courses).where(inArray(courses.id, courseIds))
        : Promise.resolve([]),
      moduleIds.length > 0
        ? tx.select().from(courseModules).where(inArray(courseModules.id, moduleIds))
        : Promise.resolve([]),
      lessonIds.length > 0
        ? tx.select().from(lessons).where(inArray(lessons.id, lessonIds))
        : Promise.resolve([]),
      pathIds.length > 0
        ? tx.select().from(learningPaths).where(inArray(learningPaths.id, pathIds))
        : Promise.resolve([]),
    ]);

    const cMap = new Map(courseRows.map((c) => [c.id, c]));
    const mMap = new Map(moduleRows.map((m) => [m.id, m]));
    const lMap = new Map(lessonRows.map((l) => [l.id, l]));
    const pMap = new Map(pathRows.map((p) => [p.id, p]));

    return links.map((link) => {
      const course = link.courseId ? cMap.get(link.courseId) ?? null : null;
      const mod = link.moduleId ? mMap.get(link.moduleId) ?? null : null;
      const lesson = link.lessonId ? lMap.get(link.lessonId) ?? null : null;
      const path = link.pathId ? pMap.get(link.pathId) ?? null : null;
      return {
        linkId: link.id,
        purpose: link.purpose,
        isRequired: link.isRequired,
        course: course ? { id: course.id, title: course.title, status: course.status } : null,
        module: mod ? { id: mod.id, title: mod.title } : null,
        lesson: lesson
          ? { id: lesson.id, title: lesson.title, status: lesson.status }
          : null,
        path: path ? { id: path.id, title: path.title } : null,
      };
    });
  });
}

export async function getNoteDeletionImpact(userId: string, noteId: string) {
  return withUserRls(userId, async (tx) => {
    const [linkedLearning, fcNotes, linkedQuizzes] = await Promise.all([
      getNoteLinkedLearning(userId, noteId),
      tx
        .select({ id: flashcardNotes.id })
        .from(flashcardNotes)
        .where(and(eq(flashcardNotes.userId, userId), eq(flashcardNotes.sourceNoteId, noteId))),
      tx
        .select({ id: quizzes.id, title: quizzes.title })
        .from(quizzes)
        .where(and(eq(quizzes.userId, userId), eq(quizzes.noteId, noteId))),
    ]);

    return {
      hasImpact: linkedLearning.length > 0 || fcNotes.length > 0 || linkedQuizzes.length > 0,
      linkedLearning,
      flashcardsCount: fcNotes.length,
      quizzes: linkedQuizzes,
    };
  });
}

export async function createLessonFromNote(
  userId: string,
  workspaceId: string,
  input: {
    noteId: string;
    courseId?: string | null;
    newCourseTitle?: string;
    moduleId?: string | null;
    newModuleTitle?: string;
    lessonTitle: string;
    description?: string | null;
    estimatedMinutes?: number | null;
    difficulty?: "beginner" | "intermediate" | "advanced";
    objectives?: string[];
    prerequisites?: string[];
    resources?: Array<{ title: string; url: string }>;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [noteRow] = await tx
      .select({ id: notes.id, title: notes.title })
      .from(notes)
      .where(and(eq(notes.id, input.noteId), eq(notes.userId, userId), isNull(notes.deletedAt)))
      .limit(1);
    if (!noteRow) throw new LearningServiceError(404, "NOTE_NOT_FOUND", "Note not found");

    let courseId = input.courseId ?? null;
    if (!courseId) {
      const [createdCourse] = await tx
        .insert(courses)
        .values({
          userId,
          workspaceId,
          title: (input.newCourseTitle || noteRow.title).trim(),
          status: "in_progress",
        })
        .returning();
      courseId = createdCourse!.id;
    }

    let moduleId = input.moduleId ?? null;
    if (!moduleId) {
      const existingMods = await tx
        .select({ id: courseModules.id })
        .from(courseModules)
        .where(eq(courseModules.courseId, courseId));
      const [createdMod] = await tx
        .insert(courseModules)
        .values({
          userId,
          courseId,
          title: (input.newModuleTitle || "Module 1").trim(),
          sortOrder: existingMods.length,
        })
        .returning();
      moduleId = createdMod!.id;
    }

    const existingLessons = await tx
      .select({ id: lessons.id })
      .from(lessons)
      .where(eq(lessons.moduleId, moduleId));

    const [createdLesson] = await tx
      .insert(lessons)
      .values({
        userId,
        moduleId,
        title: input.lessonTitle.trim(),
        description: input.description ?? null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        difficulty: input.difficulty ?? "intermediate",
        objectives: input.objectives ?? [],
        prerequisites: input.prerequisites ?? [],
        resources: input.resources ?? [],
        sortOrder: existingLessons.length,
      })
      .returning();

    await tx.insert(learningResourceLinks).values({
      userId,
      courseId,
      moduleId,
      lessonId: createdLesson!.id,
      noteId: input.noteId,
      purpose: "main_content",
      isRequired: true,
      sortOrder: 0,
    });

    await tx.insert(lessonContents).values({
      userId,
      lessonId: createdLesson!.id,
      contentType: "note",
      title: noteRow.title,
      noteId: input.noteId,
      metadata: { purpose: "main_content" },
      isRequired: true,
      sortOrder: 0,
    });

    return { courseId, moduleId, lesson: createdLesson! };
  });
}

export async function createCourseFromNotes(
  userId: string,
  workspaceId: string,
  input: {
    title: string;
    description?: string | null;
    category?: string | null;
    modules: Array<{
      title: string;
      lessons: Array<{
        title: string;
        noteIds: string[];
      }>;
    }>;
  }
) {
  return withUserRls(userId, async (tx) => {
    const allNoteIds = Array.from(
      new Set(input.modules.flatMap((m) => m.lessons.flatMap((l) => l.noteIds)))
    );
    const ownedNotes =
      allNoteIds.length > 0
        ? await tx
            .select({ id: notes.id, title: notes.title })
            .from(notes)
            .where(and(eq(notes.userId, userId), inArray(notes.id, allNoteIds)))
        : [];
    const noteMap = new Map(ownedNotes.map((n) => [n.id, n]));

    const [createdCourse] = await tx
      .insert(courses)
      .values({
        userId,
        workspaceId,
        title: input.title.trim(),
        description: input.description ?? null,
        category: input.category ?? null,
        status: "in_progress",
      })
      .returning();

    for (let mIdx = 0; mIdx < input.modules.length; mIdx++) {
      const modSpec = input.modules[mIdx]!;
      const [createdMod] = await tx
        .insert(courseModules)
        .values({
          userId,
          courseId: createdCourse!.id,
          title: modSpec.title.trim(),
          sortOrder: mIdx,
        })
        .returning();

      for (let lIdx = 0; lIdx < modSpec.lessons.length; lIdx++) {
        const lessonSpec = modSpec.lessons[lIdx]!;
        const [createdLesson] = await tx
          .insert(lessons)
          .values({
            userId,
            moduleId: createdMod!.id,
            title: lessonSpec.title.trim(),
            sortOrder: lIdx,
          })
          .returning();

        for (let nIdx = 0; nIdx < lessonSpec.noteIds.length; nIdx++) {
          const nid = lessonSpec.noteIds[nIdx]!;
          const nRow = noteMap.get(nid);
          if (!nRow) continue;
          await tx.insert(learningResourceLinks).values({
            userId,
            courseId: createdCourse!.id,
            moduleId: createdMod!.id,
            lessonId: createdLesson!.id,
            noteId: nid,
            purpose: nIdx === 0 ? "main_content" : "supplementary",
            isRequired: true,
            sortOrder: nIdx,
          });
          await tx.insert(lessonContents).values({
            userId,
            lessonId: createdLesson!.id,
            contentType: "note",
            title: nRow.title,
            noteId: nid,
            metadata: { purpose: nIdx === 0 ? "main_content" : "supplementary" },
            isRequired: true,
            sortOrder: nIdx,
          });
        }
      }
    }

    await recordActivity({
      userId,
      workspaceId,
      entityType: "course",
      entityId: createdCourse!.id,
      action: "created_from_notes",
      payload: { title: createdCourse!.title, notesCount: ownedNotes.length },
    });

    return createdCourse!;
  });
}

export async function reorderCurriculum(
  userId: string,
  input: { kind: "modules" | "lessons"; orderedIds: string[] }
) {
  return withUserRls(userId, async (tx) => {
    for (let i = 0; i < input.orderedIds.length; i++) {
      const id = input.orderedIds[i]!;
      if (input.kind === "modules") {
        await tx
          .update(courseModules)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(and(eq(courseModules.id, id), eq(courseModules.userId, userId)));
      } else {
        await tx
          .update(lessons)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(and(eq(lessons.id, id), eq(lessons.userId, userId)));
      }
    }
    return { reordered: true };
  });
}

export async function getLessonRichDetail(userId: string, lessonId: string) {
  return withUserRls(userId, async (tx) => {
    const [lessonRow] = await tx
      .select()
      .from(lessons)
      .where(and(eq(lessons.id, lessonId), eq(lessons.userId, userId)))
      .limit(1);
    if (!lessonRow) throw new LearningServiceError(404, "LESSON_NOT_FOUND", "Lesson not found");

    const [contents, links, lessonQuizzes] = await Promise.all([
      tx
        .select()
        .from(lessonContents)
        .where(and(eq(lessonContents.lessonId, lessonId), eq(lessonContents.userId, userId)))
        .orderBy(asc(lessonContents.sortOrder)),
      tx
        .select()
        .from(learningResourceLinks)
        .where(
          and(
            eq(learningResourceLinks.lessonId, lessonId),
            eq(learningResourceLinks.userId, userId)
          )
        )
        .orderBy(asc(learningResourceLinks.sortOrder)),
      tx
        .select()
        .from(quizzes)
        .where(and(eq(quizzes.lessonId, lessonId), eq(quizzes.userId, userId))),
    ]);

    const noteIds = Array.from(
      new Set([
        ...links.map((l) => l.noteId).filter((v): v is string => Boolean(v)),
        ...contents.map((c) => c.noteId).filter((v): v is string => Boolean(v)),
      ])
    );

    const noteRows =
      noteIds.length > 0
        ? await tx
            .select({
              id: notes.id,
              title: notes.title,
              contentJson: notes.contentJson,
              updatedAt: notes.updatedAt,
              deletedAt: notes.deletedAt,
            })
            .from(notes)
            .where(and(eq(notes.userId, userId), inArray(notes.id, noteIds)))
        : [];
    const noteMap = new Map(noteRows.map((n) => [n.id, n]));

    const linkedNotes = links
      .filter((l) => Boolean(l.noteId))
      .map((l) => {
        const n = noteMap.get(l.noteId!);
        return {
          linkId: l.id,
          noteId: l.noteId!,
          purpose: l.purpose,
          isRequired: l.isRequired,
          deleted: !n || Boolean(n.deletedAt),
          title: n && !n.deletedAt ? n.title : "Deleted Note",
          updatedAt: n?.updatedAt ?? null,
          readingMinutes: n && !n.deletedAt ? estimateReadingMinutes(n.contentJson) : 0,
        };
      });

    return {
      lesson: lessonRow,
      contents: contents.map((c) => {
        const n = c.noteId ? noteMap.get(c.noteId) : null;
        return {
          ...c,
          noteDeleted: c.noteId ? !n || Boolean(n.deletedAt) : false,
          noteTitle: n && !n.deletedAt ? n.title : c.title,
        };
      }),
      linkedNotes,
      quizzes: lessonQuizzes,
    };
  });
}

export async function addLessonContent(
  userId: string,
  input: {
    lessonId: string;
    contentType:
      | "note"
      | "text"
      | "video"
      | "external_link"
      | "document"
      | "image"
      | "code_snippet"
      | "exercise"
      | "flashcard_deck"
      | "quiz"
      | "checklist";
    title: string;
    body?: string | null;
    url?: string | null;
    noteId?: string | null;
    deckId?: string | null;
    quizId?: string | null;
    metadata?: Record<string, unknown> | null;
    isRequired?: boolean;
  }
) {
  return withUserRls(userId, async (tx) => {
    const existing = await tx
      .select({ id: lessonContents.id })
      .from(lessonContents)
      .where(and(eq(lessonContents.lessonId, input.lessonId), eq(lessonContents.userId, userId)));

    const [created] = await tx
      .insert(lessonContents)
      .values({
        userId,
        lessonId: input.lessonId,
        contentType: input.contentType,
        title: input.title.trim(),
        body: input.body ?? null,
        url: input.url ?? null,
        noteId: input.noteId ?? null,
        deckId: input.deckId ?? null,
        quizId: input.quizId ?? null,
        metadata: input.metadata ?? null,
        isRequired: input.isRequired ?? true,
        sortOrder: existing.length,
      })
      .returning();
    return created!;
  });
}

export async function updateLessonContent(
  userId: string,
  contentId: string,
  patch: { isCompleted?: boolean; isRequired?: boolean; sortOrder?: number; title?: string; body?: string | null }
) {
  return withUserRls(userId, async (tx) => {
    const [updated] = await tx
      .update(lessonContents)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(lessonContents.id, contentId), eq(lessonContents.userId, userId)))
      .returning();
    if (!updated) throw new LearningServiceError(404, "CONTENT_NOT_FOUND", "Content not found");
    return updated;
  });
}

export async function deleteLessonContent(userId: string, contentId: string) {
  return withUserRls(userId, async (tx) => {
    await tx
      .delete(lessonContents)
      .where(and(eq(lessonContents.id, contentId), eq(lessonContents.userId, userId)));
    return { deleted: true };
  });
}

export async function createStudyTaskFromLearning(
  userId: string,
  workspaceId: string,
  input: {
    title: string;
    courseId?: string | null;
    lessonId?: string | null;
    noteId?: string | null;
    dueAt?: string | null;
    estimatedMinutes?: number | null;
    autoCompleteLesson?: boolean;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [createdTask] = await tx
      .insert(tasks)
      .values({
        userId,
        workspaceId,
        title: input.title.trim(),
        status: "todo",
        priority: "medium",
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        estimatedMinutes: input.estimatedMinutes ?? 30,
        noteId: input.noteId ?? null,
        description: input.autoCompleteLesson
          ? "[learning:auto_complete]"
          : "[learning:study_session]",
      })
      .returning();

    await tx.insert(learningResourceLinks).values({
      userId,
      courseId: input.courseId ?? null,
      lessonId: input.lessonId ?? null,
      noteId: input.noteId ?? null,
      taskId: createdTask!.id,
      purpose: "exercise",
    });

    return createdTask!;
  });
}

export async function scheduleStudyOnCalendar(
  userId: string,
  workspaceId: string,
  input: {
    title: string;
    startsAt: string;
    endsAt: string;
    recurrenceRule?: string | null;
    courseId?: string | null;
    lessonId?: string | null;
    noteId?: string | null;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [evt] = await tx
      .insert(calendarEvents)
      .values({
        userId,
        workspaceId,
        title: input.title.trim(),
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        recurrenceRule: input.recurrenceRule ?? null,
        color: "#8b5cf6",
        description: [
          input.courseId ? `course:${input.courseId}` : "",
          input.lessonId ? `lesson:${input.lessonId}` : "",
          input.noteId ? `note:${input.noteId}` : "",
        ]
          .filter(Boolean)
          .join(" "),
      })
      .returning();
    return evt!;
  });
}

export async function recordStudySession(
  userId: string,
  workspaceId: string,
  input: {
    courseId?: string | null;
    moduleId?: string | null;
    lessonId?: string | null;
    noteId?: string | null;
    durationSeconds: number;
    lessonsCompleted?: number;
    flashcardsReviewed?: number;
    quizScorePercent?: number | null;
    difficultyRating?: string | null;
    flaggedForReview?: boolean;
    notesText?: string | null;
  }
) {
  return withUserRls(userId, async (tx) => {
    const now = new Date();
    const startedAt = new Date(now.getTime() - Math.max(0, input.durationSeconds) * 1000);
    const [created] = await tx
      .insert(studySessions)
      .values({
        userId,
        workspaceId,
        courseId: input.courseId ?? null,
        moduleId: input.moduleId ?? null,
        lessonId: input.lessonId ?? null,
        noteId: input.noteId ?? null,
        durationSeconds: Math.max(0, input.durationSeconds),
        lessonsCompleted: input.lessonsCompleted ?? 0,
        flashcardsReviewed: input.flashcardsReviewed ?? 0,
        quizScorePercent: input.quizScorePercent ?? null,
        difficultyRating: input.difficultyRating ?? null,
        flaggedForReview: input.flaggedForReview ?? false,
        notesText: input.notesText ?? null,
        startedAt,
        endedAt: now,
      })
      .returning();
    return created!;
  });
}

export async function listStudySessions(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    return tx
      .select()
      .from(studySessions)
      .where(and(eq(studySessions.userId, userId), eq(studySessions.workspaceId, workspaceId)))
      .orderBy(desc(studySessions.startedAt))
      .limit(50);
  });
}

export async function scheduleOrGetLearningReview(
  userId: string,
  workspaceId: string,
  input: { entityType: "note" | "lesson" | "concept"; entityId: string; title: string }
) {
  return withUserRls(userId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(learningReviews)
      .where(
        and(
          eq(learningReviews.userId, userId),
          eq(learningReviews.entityType, input.entityType),
          eq(learningReviews.entityId, input.entityId)
        )
      )
      .limit(1);
    if (existing) return existing;

    const [created] = await tx
      .insert(learningReviews)
      .values({
        userId,
        workspaceId,
        entityType: input.entityType,
        entityId: input.entityId,
        title: input.title,
        dueAt: new Date(),
      })
      .returning();
    return created!;
  });
}

export async function submitLearningReview(
  userId: string,
  reviewId: string,
  rating: ReviewRating
) {
  return withUserRls(userId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(learningReviews)
      .where(and(eq(learningReviews.id, reviewId), eq(learningReviews.userId, userId)))
      .limit(1);
    if (!existing) throw new LearningServiceError(404, "REVIEW_NOT_FOUND", "Review not found");

    const now = new Date();
    const next = computeNextReviewSchedule(
      {
        easeFactor: existing.easeFactor,
        intervalDays: existing.intervalDays,
        repetitions: existing.repetitions,
        lapses: existing.lapses,
      },
      rating,
      now
    );

    const [updated] = await tx
      .update(learningReviews)
      .set({
        easeFactor: next.easeFactor,
        intervalDays: next.intervalDays,
        repetitions: next.repetitions,
        lapses: next.lapses,
        lastRating: rating,
        dueAt: next.dueAt,
        lastReviewedAt: now,
        updatedAt: now,
      })
      .where(and(eq(learningReviews.id, reviewId), eq(learningReviews.userId, userId)))
      .returning();

    return updated!;
  });
}

export async function getReviewQueueOverview(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const [reviews, dueFlashcards] = await Promise.all([
      tx
        .select()
        .from(learningReviews)
        .where(and(eq(learningReviews.userId, userId), eq(learningReviews.workspaceId, workspaceId)))
        .orderBy(asc(learningReviews.dueAt)),
      tx
        .select({ id: flashcards.id, front: flashcards.front, dueAt: flashcards.dueAt, lapses: flashcards.lapses })
        .from(flashcards)
        .where(and(eq(flashcards.userId, userId), lte(flashcards.dueAt, endOfToday)))
        .limit(50),
    ]);

    const active = reviews.filter((r) => !r.paused);
    const overdue = active.filter((r) => r.dueAt.getTime() < now.getTime());
    const dueToday = active.filter(
      (r) => r.dueAt.getTime() >= now.getTime() && r.dueAt.getTime() <= endOfToday.getTime()
    );
    const upcoming = active.filter((r) => r.dueAt.getTime() > endOfToday.getTime()).slice(0, 20);
    const difficult = active.filter((r) => r.lapses > 0 || r.lastRating === "again");

    return {
      overdue,
      dueToday,
      upcoming,
      difficult,
      paused: reviews.filter((r) => r.paused),
      dueFlashcardsCount: dueFlashcards.length,
    };
  });
}

export async function togglePauseLearningReview(userId: string, reviewId: string, paused: boolean) {
  return withUserRls(userId, async (tx) => {
    const [updated] = await tx
      .update(learningReviews)
      .set({ paused, updatedAt: new Date() })
      .where(and(eq(learningReviews.id, reviewId), eq(learningReviews.userId, userId)))
      .returning();
    if (!updated) throw new LearningServiceError(404, "REVIEW_NOT_FOUND", "Review not found");
    return updated;
  });
}

export async function listQuizzesOverview(
  userId: string,
  workspaceId: string,
  filter?: { courseId?: string; lessonId?: string; noteId?: string }
) {
  return withUserRls(userId, async (tx) => {
    const quizRows = await tx
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.userId, userId), eq(quizzes.workspaceId, workspaceId)))
      .orderBy(desc(quizzes.updatedAt));

    const filtered = quizRows.filter((q) => {
      if (filter?.courseId && q.courseId !== filter.courseId) return false;
      if (filter?.lessonId && q.lessonId !== filter.lessonId) return false;
      if (filter?.noteId && q.noteId !== filter.noteId) return false;
      return true;
    });

    if (filtered.length === 0) return [];
    const quizIds = filtered.map((q) => q.id);

    const [questions, attempts] = await Promise.all([
      tx
        .select()
        .from(quizQuestions)
        .where(inArray(quizQuestions.quizId, quizIds))
        .orderBy(asc(quizQuestions.sortOrder)),
      tx
        .select()
        .from(quizAttempts)
        .where(inArray(quizAttempts.quizId, quizIds))
        .orderBy(desc(quizAttempts.completedAt)),
    ]);

    return filtered.map((q) => ({
      ...q,
      questions: questions.filter((qq) => qq.quizId === q.id),
      attempts: attempts.filter((a) => a.quizId === q.id).slice(0, 10),
    }));
  });
}

export async function createQuizWithQuestion(
  userId: string,
  workspaceId: string,
  input: {
    title: string;
    description?: string | null;
    courseId?: string | null;
    lessonId?: string | null;
    noteId?: string | null;
    passingScore?: number;
    shuffleQuestions?: boolean;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(quizzes)
      .values({
        userId,
        workspaceId,
        title: input.title.trim(),
        description: input.description ?? null,
        courseId: input.courseId ?? null,
        lessonId: input.lessonId ?? null,
        noteId: input.noteId ?? null,
        passingScore: input.passingScore ?? 70,
        shuffleQuestions: input.shuffleQuestions ?? false,
      })
      .returning();
    return created!;
  });
}

export async function addQuizQuestion(
  userId: string,
  input: {
    quizId: string;
    questionType: "multiple_choice" | "multiple_answers" | "true_false" | "short_answer" | "self_assessed";
    prompt: string;
    options?: string[];
    correctAnswers?: string[];
    referenceAnswer?: string | null;
    explanation?: string | null;
    points?: number;
  }
) {
  return withUserRls(userId, async (tx) => {
    const existing = await tx
      .select({ id: quizQuestions.id })
      .from(quizQuestions)
      .where(and(eq(quizQuestions.quizId, input.quizId), eq(quizQuestions.userId, userId)));

    const [created] = await tx
      .insert(quizQuestions)
      .values({
        userId,
        quizId: input.quizId,
        questionType: input.questionType,
        prompt: input.prompt.trim(),
        options: input.options ?? [],
        correctAnswers: input.correctAnswers ?? [],
        referenceAnswer: input.referenceAnswer ?? null,
        explanation: input.explanation ?? null,
        points: input.points ?? 1,
        sortOrder: existing.length,
      })
      .returning();
    return created!;
  });
}

export async function submitQuizAttempt(
  userId: string,
  quizId: string,
  answers: Array<{ questionId: string; selected: string[]; textAnswer?: string; selfCorrect?: boolean }>
) {
  return withUserRls(userId, async (tx) => {
    const [quizRow] = await tx
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)))
      .limit(1);
    if (!quizRow) throw new LearningServiceError(404, "QUIZ_NOT_FOUND", "Quiz not found");

    const qRows = await tx
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId));

    let earned = 0;
    let total = 0;
    const evaluated = qRows.map((q) => {
      total += q.points;
      const ans = answers.find((a) => a.questionId === q.id);
      let isCorrect = false;
      if (ans) {
        if (q.questionType === "self_assessed") {
          isCorrect = Boolean(ans.selfCorrect);
        } else if (q.questionType === "short_answer") {
          const ref = (q.referenceAnswer ?? "").trim().toLowerCase();
          const given = (ans.textAnswer ?? "").trim().toLowerCase();
          isCorrect = Boolean(ref && given && ref === given);
        } else {
          const expected = [...q.correctAnswers].sort();
          const given = [...ans.selected].sort();
          isCorrect =
            expected.length > 0 &&
            expected.length === given.length &&
            expected.every((v, i) => v === given[i]);
        }
      }
      if (isCorrect) earned += q.points;
      return {
        questionId: q.id,
        selected: ans?.selected ?? [],
        textAnswer: ans?.textAnswer,
        isCorrect,
      };
    });

    const scorePercent = total > 0 ? Math.round((earned / total) * 100) : 0;
    const passed = scorePercent >= quizRow.passingScore;

    const [attempt] = await tx
      .insert(quizAttempts)
      .values({
        userId,
        quizId,
        scorePercent,
        passed,
        answers: evaluated,
      })
      .returning();

    return attempt!;
  });
}

export async function deleteQuiz(userId: string, quizId: string) {
  return withUserRls(userId, async (tx) => {
    await tx.delete(quizzes).where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)));
    return { deleted: true };
  });
}

export async function getLearningKnowledgeOverview(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    const [noteLinks, recentNotes, allDecks, allCards, sessions, reviews] = await Promise.all([
      tx
        .select({ noteId: learningResourceLinks.noteId })
        .from(learningResourceLinks)
        .where(eq(learningResourceLinks.userId, userId)),
      tx
        .select({ id: notes.id, title: notes.title, updatedAt: notes.updatedAt })
        .from(notes)
        .where(
          and(
            eq(notes.userId, userId),
            eq(notes.workspaceId, workspaceId),
            isNull(notes.deletedAt),
            eq(notes.isArchived, false)
          )
        )
        .orderBy(desc(notes.updatedAt))
        .limit(6),
      tx
        .select({ id: flashcardDecks.id })
        .from(flashcardDecks)
        .where(and(eq(flashcardDecks.userId, userId), eq(flashcardDecks.workspaceId, workspaceId))),
      tx
        .select({ id: flashcards.id, dueAt: flashcards.dueAt })
        .from(flashcards)
        .where(eq(flashcards.userId, userId)),
      tx
        .select()
        .from(studySessions)
        .where(and(eq(studySessions.userId, userId), eq(studySessions.workspaceId, workspaceId)))
        .orderBy(desc(studySessions.startedAt))
        .limit(20),
      tx
        .select()
        .from(learningReviews)
        .where(and(eq(learningReviews.userId, userId), eq(learningReviews.workspaceId, workspaceId))),
    ]);

    const linkedNotesCount = new Set(
      noteLinks.map((l) => l.noteId).filter((v): v is string => Boolean(v))
    ).size;
    const now = Date.now();
    const pendingReviewsCount =
      reviews.filter((r) => !r.paused && r.dueAt.getTime() <= now).length +
      allCards.filter((c) => c.dueAt.getTime() <= now).length;
    const totalStudyMinutes = Math.round(
      sessions.reduce((acc, s) => acc + s.durationSeconds, 0) / 60
    );

    return {
      linkedNotesCount,
      decksCount: allDecks.length,
      flashcardsCount: allCards.length,
      pendingReviewsCount,
      totalStudyMinutes,
      recentSessions: sessions.slice(0, 5),
      recentNotes,
    };
  });
}
