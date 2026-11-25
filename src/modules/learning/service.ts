import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  courseModules,
  courses,
  flashcardDecks,
  focusSessions,
  learningPathCourses,
  learningPaths,
  learningResourceLinks,
  lessons,
  notes,
  tasks,
} from "@/db/schema";
import { recordActivity } from "@/modules/activity/service";
import { computeLearningProgress } from "./progress";

export class LearningServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export async function getLearningOverview(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    const [paths, courseRows, pathLinks, moduleRows, lessonRows, sessionRows] =
      await Promise.all([
        tx
          .select()
          .from(learningPaths)
          .where(
            and(
              eq(learningPaths.userId, userId),
              eq(learningPaths.workspaceId, workspaceId)
            )
          )
          .orderBy(desc(learningPaths.updatedAt)),
        tx
          .select()
          .from(courses)
          .where(and(eq(courses.userId, userId), eq(courses.workspaceId, workspaceId)))
          .orderBy(desc(courses.updatedAt)),
        tx.select().from(learningPathCourses),
        tx
          .select()
          .from(courseModules)
          .where(eq(courseModules.userId, userId))
          .orderBy(asc(courseModules.sortOrder)),
        tx
          .select()
          .from(lessons)
          .where(eq(lessons.userId, userId))
          .orderBy(asc(lessons.sortOrder)),
        tx
          .select({
            courseId: focusSessions.courseId,
            actualDurationSeconds: focusSessions.actualDurationSeconds,
          })
          .from(focusSessions)
          .where(
            and(eq(focusSessions.userId, userId), eq(focusSessions.status, "completed"))
          ),
      ]);

    const modulesByCourse = new Map<string, string[]>();
    for (const m of moduleRows) {
      const arr = modulesByCourse.get(m.courseId) ?? [];
      arr.push(m.id);
      modulesByCourse.set(m.courseId, arr);
    }

    const lessonsByModule = new Map<string, typeof lessonRows>();
    for (const l of lessonRows) {
      const arr = lessonsByModule.get(l.moduleId) ?? [];
      arr.push(l);
      lessonsByModule.set(l.moduleId, arr);
    }

    const studySecondsByCourse = new Map<string, number>();
    for (const s of sessionRows) {
      if (s.courseId) {
        studySecondsByCourse.set(
          s.courseId,
          (studySecondsByCourse.get(s.courseId) ?? 0) + s.actualDurationSeconds
        );
      }
    }

    const coursesWithProgress = courseRows.map((c) => {
      const modIds = modulesByCourse.get(c.id) ?? [];
      const courseLessons = modIds.flatMap((mid) => lessonsByModule.get(mid) ?? []);
      const stats = computeLearningProgress(courseLessons);
      return {
        ...c,
        modulesCount: modIds.length,
        totalLessons: stats.total,
        completedLessons: stats.completed,
        progress: stats.progress,
        studyMinutes: Math.round((studySecondsByCourse.get(c.id) ?? 0) / 60),
      };
    });

    const courseMap = new Map(coursesWithProgress.map((c) => [c.id, c]));
    const pathsWithProgress = paths.map((p) => {
      const linkedCourseIds = pathLinks
        .filter((pl) => pl.pathId === p.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((pl) => pl.courseId);
      const linkedCourses = linkedCourseIds
        .map((cid) => courseMap.get(cid))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));
      const avgProgress =
        linkedCourses.length === 0
          ? 0
          : Math.round(
              linkedCourses.reduce((acc, c) => acc + c.progress, 0) / linkedCourses.length
            );
      return {
        ...p,
        courses: linkedCourses,
        progress: avgProgress,
      };
    });

    return { paths: pathsWithProgress, courses: coursesWithProgress };
  });
}

export async function getCourseDetails(userId: string, courseId: string) {
  return withUserRls(userId, async (tx) => {
    const rows = await tx
      .select()
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
      .limit(1);

    const course = rows[0];
    if (!course) {
      throw new LearningServiceError(404, "COURSE_NOT_FOUND", "Course not found");
    }

    const [mods, links, decks, sessions] = await Promise.all([
      tx
        .select()
        .from(courseModules)
        .where(and(eq(courseModules.courseId, courseId), eq(courseModules.userId, userId)))
        .orderBy(asc(courseModules.sortOrder), asc(courseModules.createdAt)),
      tx
        .select()
        .from(learningResourceLinks)
        .where(
          and(
            eq(learningResourceLinks.courseId, courseId),
            eq(learningResourceLinks.userId, userId)
          )
        ),
      tx
        .select()
        .from(flashcardDecks)
        .where(
          and(eq(flashcardDecks.courseId, courseId), eq(flashcardDecks.userId, userId))
        ),
      tx
        .select()
        .from(focusSessions)
        .where(
          and(eq(focusSessions.courseId, courseId), eq(focusSessions.userId, userId))
        )
        .orderBy(desc(focusSessions.startedAt))
        .limit(20),
    ]);

    const modIds = mods.map((m) => m.id);
    const lessonRows =
      modIds.length > 0
        ? await tx
            .select()
            .from(lessons)
            .where(and(eq(lessons.userId, userId), inArray(lessons.moduleId, modIds)))
            .orderBy(asc(lessons.sortOrder), asc(lessons.createdAt))
        : [];

    const noteIds = links.map((l) => l.noteId).filter((id): id is string => Boolean(id));
    const taskIds = links.map((l) => l.taskId).filter((id): id is string => Boolean(id));

    const [linkedNotes, linkedTasks] = await Promise.all([
      noteIds.length > 0
        ? tx
            .select({ id: notes.id, title: notes.title, updatedAt: notes.updatedAt })
            .from(notes)
            .where(
              and(
                eq(notes.userId, userId),
                inArray(notes.id, noteIds),
                isNull(notes.deletedAt)
              )
            )
        : Promise.resolve([]),
      taskIds.length > 0
        ? tx
            .select({
              id: tasks.id,
              title: tasks.title,
              status: tasks.status,
              priority: tasks.priority,
            })
            .from(tasks)
            .where(and(eq(tasks.userId, userId), inArray(tasks.id, taskIds)))
        : Promise.resolve([]),
    ]);

    const modulesWithLessons = mods.map((m) => {
      const mLessons = lessonRows.filter((l) => l.moduleId === m.id);
      const stats = computeLearningProgress(mLessons);
      return {
        ...m,
        lessons: mLessons,
        progress: stats.progress,
        completedLessons: stats.completed,
        totalLessons: stats.total,
      };
    });

    const courseStats = computeLearningProgress(lessonRows);
    const totalStudyMinutes = Math.round(
      sessions
        .filter((s) => s.status === "completed")
        .reduce((acc, s) => acc + s.actualDurationSeconds, 0) / 60
    );

    return {
      course: {
        ...course,
        progress: courseStats.progress,
        totalLessons: courseStats.total,
        completedLessons: courseStats.completed,
        studyMinutes: totalStudyMinutes,
      },
      modules: modulesWithLessons,
      linkedNotes,
      linkedTasks,
      decks,
      sessions,
    };
  });
}

export async function createLearningPath(
  userId: string,
  workspaceId: string,
  input: { title: string; description?: string | null; color: string; goal?: string | null }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(learningPaths)
      .values({
        userId,
        workspaceId,
        title: input.title,
        description: input.description ?? null,
        color: input.color,
        goal: input.goal ?? null,
      })
      .returning();
    return created!;
  });
}

export async function createCourse(
  userId: string,
  workspaceId: string,
  input: {
    title: string;
    description?: string | null;
    platform?: string | null;
    url?: string | null;
    category?: string | null;
    estimatedMinutes?: number | null;
    pathId?: string | null;
  }
) {
  const created = await withUserRls(userId, async (tx) => {
    const [course] = await tx
      .insert(courses)
      .values({
        userId,
        workspaceId,
        title: input.title,
        description: input.description ?? null,
        platform: input.platform ?? null,
        url: input.url || null,
        category: input.category ?? null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        startedAt: new Date(),
      })
      .returning();

    if (!course) {
      throw new LearningServiceError(500, "CREATE_FAILED", "Failed to create course");
    }

    if (input.pathId) {
      const pathRow = await tx
        .select({ id: learningPaths.id })
        .from(learningPaths)
        .where(and(eq(learningPaths.id, input.pathId), eq(learningPaths.userId, userId)))
        .limit(1);
      if (pathRow[0]) {
        await tx
          .insert(learningPathCourses)
          .values({ pathId: input.pathId, courseId: course.id, sortOrder: 0 });
      }
    }

    return course;
  });

  await recordActivity({
    userId,
    workspaceId,
    entityType: "course",
    entityId: created.id,
    action: "course.created",
    payload: { title: created.title },
  });

  return created;
}

export async function createCourseModule(
  userId: string,
  input: { courseId: string; title: string; description?: string | null }
) {
  return withUserRls(userId, async (tx) => {
    const courseRow = await tx
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, input.courseId), eq(courses.userId, userId)))
      .limit(1);
    if (!courseRow[0]) {
      throw new LearningServiceError(404, "COURSE_NOT_FOUND", "Course not found");
    }

    const existing = await tx
      .select({ id: courseModules.id })
      .from(courseModules)
      .where(eq(courseModules.courseId, input.courseId));

    const [created] = await tx
      .insert(courseModules)
      .values({
        userId,
        courseId: input.courseId,
        title: input.title,
        description: input.description ?? null,
        sortOrder: existing.length,
      })
      .returning();
    return created!;
  });
}

export async function createLesson(
  userId: string,
  input: {
    moduleId: string;
    title: string;
    description?: string | null;
    estimatedMinutes?: number | null;
    externalUrl?: string | null;
  }
) {
  return withUserRls(userId, async (tx) => {
    const modRow = await tx
      .select({ id: courseModules.id })
      .from(courseModules)
      .where(and(eq(courseModules.id, input.moduleId), eq(courseModules.userId, userId)))
      .limit(1);
    if (!modRow[0]) {
      throw new LearningServiceError(404, "MODULE_NOT_FOUND", "Module not found");
    }

    const existing = await tx
      .select({ id: lessons.id })
      .from(lessons)
      .where(eq(lessons.moduleId, input.moduleId));

    const [created] = await tx
      .insert(lessons)
      .values({
        userId,
        moduleId: input.moduleId,
        title: input.title,
        description: input.description ?? null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        externalUrl: input.externalUrl || null,
        sortOrder: existing.length,
      })
      .returning();
    return created!;
  });
}

export async function updateLesson(
  userId: string,
  lessonId: string,
  input: {
    title?: string;
    description?: string | null;
    status?: "not_started" | "in_progress" | "completed";
    estimatedMinutes?: number | null;
    externalUrl?: string | null;
    sortOrder?: number;
  }
) {
  return withUserRls(userId, async (tx) => {
    const rows = await tx
      .select()
      .from(lessons)
      .where(and(eq(lessons.id, lessonId), eq(lessons.userId, userId)))
      .limit(1);

    const existing = rows[0];
    if (!existing) {
      throw new LearningServiceError(404, "LESSON_NOT_FOUND", "Lesson not found");
    }

    const becomingCompleted =
      existing.status !== "completed" && input.status === "completed";
    const leavingCompleted =
      existing.status === "completed" &&
      input.status !== undefined &&
      input.status !== "completed";

    const [updated] = await tx
      .update(lessons)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.estimatedMinutes !== undefined
          ? { estimatedMinutes: input.estimatedMinutes }
          : {}),
        ...(input.externalUrl !== undefined
          ? { externalUrl: input.externalUrl || null }
          : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(becomingCompleted ? { completedAt: new Date() } : {}),
        ...(leavingCompleted ? { completedAt: null } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(lessons.id, lessonId), eq(lessons.userId, userId)))
      .returning();

    return updated!;
  });
}

export async function linkLearningResource(
  userId: string,
  input: {
    courseId?: string | null;
    lessonId?: string | null;
    noteId?: string | null;
    taskId?: string | null;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(learningResourceLinks)
      .values({
        userId,
        courseId: input.courseId ?? null,
        lessonId: input.lessonId ?? null,
        noteId: input.noteId ?? null,
        taskId: input.taskId ?? null,
      })
      .returning();
    return created!;
  });
}

export async function updateLearningPath(
  userId: string,
  pathId: string,
  input: { title?: string; description?: string | null; color?: string; goal?: string | null }
) {
  return withUserRls(userId, async (tx) => {
    const [updated] = await tx
      .update(learningPaths)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.goal !== undefined ? { goal: input.goal } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(learningPaths.id, pathId), eq(learningPaths.userId, userId)))
      .returning();

    if (!updated) {
      throw new LearningServiceError(404, "NOT_FOUND", "Learning path not found");
    }
    return updated;
  });
}

export async function updateCourse(
  userId: string,
  courseId: string,
  input: {
    title?: string;
    description?: string | null;
    platform?: string | null;
    url?: string | null;
    category?: string | null;
    status?: "not_started" | "in_progress" | "on_hold" | "completed" | "archived";
    estimatedMinutes?: number | null;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [updated] = await tx
      .update(courses)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.platform !== undefined ? { platform: input.platform } : {}),
        ...(input.url !== undefined ? { url: input.url || null } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.estimatedMinutes !== undefined
          ? { estimatedMinutes: input.estimatedMinutes }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
      .returning();

    if (!updated) {
      throw new LearningServiceError(404, "NOT_FOUND", "Course not found");
    }
    return updated;
  });
}

export async function deleteLearningPath(userId: string, pathId: string) {
  return withUserRls(userId, async (tx) => {
    const deleted = await tx
      .delete(learningPaths)
      .where(and(eq(learningPaths.id, pathId), eq(learningPaths.userId, userId)))
      .returning({ id: learningPaths.id });

    if (deleted.length === 0) {
      throw new LearningServiceError(404, "NOT_FOUND", "Learning path not found");
    }
    return deleted[0]!;
  });
}

export async function deleteCourse(userId: string, courseId: string) {
  return withUserRls(userId, async (tx) => {
    const deleted = await tx
      .delete(courses)
      .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
      .returning({ id: courses.id });

    if (deleted.length === 0) {
      throw new LearningServiceError(404, "NOT_FOUND", "Course not found");
    }
    return deleted[0]!;
  });
}
