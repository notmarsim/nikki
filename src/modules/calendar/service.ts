import { and, asc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  calendarEventExceptions,
  calendarEvents,
  courses,
  lessons,
  notes,
  projects,
  scheduledTimeBlocks,
  tasks,
} from "@/db/schema";
import { recordActivity } from "@/modules/activity/service";
import {
  buildRRuleString,
  expandEventOccurrences,
  markOccurrenceConflicts,
  type CalendarOccurrence,
} from "./recurrence";
import type {
  CreateCalendarEventInput,
  ScheduleTaskBlockInput,
  UpdateCalendarEventInput,
} from "./schemas";

export class CalendarServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export interface CalendarOccurrenceWithLinks extends CalendarOccurrence {
  hasConflict: boolean;
  linkedTask: { id: string; title: string; status: string } | null;
  linkedProject: { id: string; name: string; color: string } | null;
  linkedCourse: { id: string; title: string } | null;
  linkedLesson: { id: string; title: string } | null;
  linkedNote: { id: string; title: string } | null;
}

export async function listCalendarOccurrences(
  userId: string,
  workspaceId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<CalendarOccurrenceWithLinks[]> {
  return withUserRls(userId, async (tx) => {
    const events = await tx
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.userId, userId),
          eq(calendarEvents.workspaceId, workspaceId),
          or(
            // Non-recurring overlapping range
            and(
              isNull(calendarEvents.recurrenceRule),
              lte(calendarEvents.startsAt, rangeEnd),
              gte(calendarEvents.endsAt, rangeStart)
            ),
            // Recurring events started before rangeEnd
            and(
              lte(calendarEvents.startsAt, rangeEnd)
            )
          )
        )
      )
      .orderBy(asc(calendarEvents.startsAt));

    if (events.length === 0) return [];

    const eventIds = events.map((e) => e.id);
    const [exceptions, blocks, userTasks, userProjects, userCourses, userLessons, userNotes] =
      await Promise.all([
        tx
          .select()
          .from(calendarEventExceptions)
          .where(
            and(
              eq(calendarEventExceptions.userId, userId),
              inArray(calendarEventExceptions.eventId, eventIds)
            )
          ),
        tx
          .select()
          .from(scheduledTimeBlocks)
          .where(
            and(
              eq(scheduledTimeBlocks.userId, userId),
              inArray(scheduledTimeBlocks.eventId, eventIds)
            )
          ),
        tx
          .select({ id: tasks.id, title: tasks.title, status: tasks.status })
          .from(tasks)
          .where(eq(tasks.userId, userId)),
        tx
          .select({ id: projects.id, name: projects.name, color: projects.color })
          .from(projects)
          .where(eq(projects.userId, userId)),
        tx
          .select({ id: courses.id, title: courses.title })
          .from(courses)
          .where(eq(courses.userId, userId)),
        tx
          .select({ id: lessons.id, title: lessons.title })
          .from(lessons)
          .where(eq(lessons.userId, userId)),
        tx
          .select({ id: notes.id, title: notes.title })
          .from(notes)
          .where(and(eq(notes.userId, userId), isNull(notes.deletedAt))),
      ]);

    const blockByEvent = new Map(blocks.map((b) => [b.eventId, b]));
    const taskMap = new Map(userTasks.map((t) => [t.id, t]));
    const projectMap = new Map(userProjects.map((p) => [p.id, p]));
    const courseMap = new Map(userCourses.map((c) => [c.id, c]));
    const lessonMap = new Map(userLessons.map((l) => [l.id, l]));
    const noteMap = new Map(userNotes.map((n) => [n.id, n]));

    const rawOccurrences: CalendarOccurrence[] = [];
    for (const ev of events) {
      const expanded = expandEventOccurrences(ev, exceptions, rangeStart, rangeEnd);
      rawOccurrences.push(...expanded);
    }

    const withConflicts = markOccurrenceConflicts(rawOccurrences);

    return withConflicts
      .map((occ) => {
        const block = blockByEvent.get(occ.eventId);
        return {
          ...occ,
          linkedTask: block?.taskId ? taskMap.get(block.taskId) ?? null : null,
          linkedProject: block?.projectId ? projectMap.get(block.projectId) ?? null : null,
          linkedCourse: block?.courseId ? courseMap.get(block.courseId) ?? null : null,
          linkedLesson: block?.lessonId ? lessonMap.get(block.lessonId) ?? null : null,
          linkedNote: block?.noteId ? noteMap.get(block.noteId) ?? null : null,
        };
      })
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  });
}

export async function createCalendarEvent(
  userId: string,
  workspaceId: string,
  input: CreateCalendarEventInput
) {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (endsAt <= startsAt) {
    throw new CalendarServiceError(
      400,
      "INVALID_RANGE",
      "End time must be after start time"
    );
  }

  const recurrenceRule = input.recurrence
    ? buildRRuleString(startsAt, input.recurrence)
    : null;

  const created = await withUserRls(userId, async (tx) => {
    const [event] = await tx
      .insert(calendarEvents)
      .values({
        userId,
        workspaceId,
        title: input.title,
        description: input.description ?? null,
        startsAt,
        endsAt,
        timezone: input.timezone,
        isAllDay: input.isAllDay,
        allDayDate: input.isAllDay ? (input.allDayDate ?? input.startsAt.slice(0, 10)) : null,
        location: input.location ?? null,
        color: input.color,
        category: input.category,
        recurrenceRule,
        recurrenceTimezone: recurrenceRule ? input.timezone : null,
      })
      .returning();

    if (!event) {
      throw new CalendarServiceError(500, "CREATE_FAILED", "Failed to create event");
    }

    if (
      input.taskId ||
      input.projectId ||
      input.courseId ||
      input.lessonId ||
      input.noteId
    ) {
      await tx.insert(scheduledTimeBlocks).values({
        userId,
        eventId: event.id,
        taskId: input.taskId ?? null,
        projectId: input.projectId ?? null,
        courseId: input.courseId ?? null,
        lessonId: input.lessonId ?? null,
        noteId: input.noteId ?? null,
      });
    }

    return event;
  });

  await recordActivity({
    userId,
    workspaceId,
    entityType: "event",
    entityId: created.id,
    action: "event.created",
    payload: { title: created.title },
  });

  return created;
}

export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  input: UpdateCalendarEventInput
) {
  return withUserRls(userId, async (tx) => {
    const rows = await tx
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)))
      .limit(1);

    const existing = rows[0];
    if (!existing) {
      throw new CalendarServiceError(404, "EVENT_NOT_FOUND", "Event not found");
    }

    if (input.scope === "single" && existing.recurrenceRule && input.originalOccurrence) {
      const occDate = new Date(input.originalOccurrence);
      await tx
        .insert(calendarEventExceptions)
        .values({
          userId,
          eventId,
          originalOccurrence: occDate,
          replacementStart: input.startsAt ? new Date(input.startsAt) : null,
          replacementEnd: input.endsAt ? new Date(input.endsAt) : null,
          replacementTitle: input.title ?? null,
          isCanceled: false,
        })
        .onConflictDoUpdate({
          target: [calendarEventExceptions.eventId, calendarEventExceptions.originalOccurrence],
          set: {
            ...(input.startsAt ? { replacementStart: new Date(input.startsAt) } : {}),
            ...(input.endsAt ? { replacementEnd: new Date(input.endsAt) } : {}),
            ...(input.title ? { replacementTitle: input.title } : {}),
          },
        });
      return existing;
    }

    const nextStartsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
    const nextEndsAt = input.endsAt ? new Date(input.endsAt) : existing.endsAt;
    if (nextEndsAt <= nextStartsAt) {
      throw new CalendarServiceError(
        400,
        "INVALID_RANGE",
        "End time must be after start time"
      );
    }

    const nextRecurrenceRule =
      input.recurrence !== undefined
        ? input.recurrence
          ? buildRRuleString(nextStartsAt, input.recurrence)
          : null
        : existing.recurrenceRule;

    const [updated] = await tx
      .update(calendarEvents)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.startsAt !== undefined ? { startsAt: nextStartsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: nextEndsAt } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.isAllDay !== undefined ? { isAllDay: input.isAllDay } : {}),
        ...(input.allDayDate !== undefined ? { allDayDate: input.allDayDate } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        recurrenceRule: nextRecurrenceRule,
        updatedAt: new Date(),
      })
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)))
      .returning();

    return updated ?? existing;
  });
}

export async function deleteCalendarEvent(
  userId: string,
  eventId: string,
  options?: { scope?: "series" | "single"; originalOccurrence?: string }
) {
  await withUserRls(userId, async (tx) => {
    const rows = await tx
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)))
      .limit(1);

    const existing = rows[0];
    if (!existing) {
      throw new CalendarServiceError(404, "EVENT_NOT_FOUND", "Event not found");
    }

    if (
      options?.scope === "single" &&
      existing.recurrenceRule &&
      options.originalOccurrence
    ) {
      await tx
        .insert(calendarEventExceptions)
        .values({
          userId,
          eventId,
          originalOccurrence: new Date(options.originalOccurrence),
          isCanceled: true,
        })
        .onConflictDoUpdate({
          target: [calendarEventExceptions.eventId, calendarEventExceptions.originalOccurrence],
          set: { isCanceled: true },
        });
      return;
    }

    await tx
      .delete(calendarEvents)
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)));
  });
}

export async function scheduleTaskOnCalendar(
  userId: string,
  workspaceId: string,
  input: ScheduleTaskBlockInput
) {
  const taskRows = await withUserRls(userId, async (tx) => {
    return tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, input.taskId), eq(tasks.userId, userId)))
      .limit(1);
  });

  const task = taskRows[0];
  if (!task) {
    throw new CalendarServiceError(404, "TASK_NOT_FOUND", "Task not found");
  }

  return createCalendarEvent(userId, workspaceId, {
    title: task.title,
    description: task.description,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timezone: input.timezone,
    isAllDay: false,
    color: "#8b5cf6",
    category: "time_block",
    taskId: task.id,
    projectId: task.projectId,
    noteId: task.noteId,
  });
}
