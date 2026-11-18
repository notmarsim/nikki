import { z } from "zod";

export const calendarRecurrenceInputSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly"]),
  interval: z.number().int().min(1).max(365).default(1),
  byWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
  until: z.string().datetime().nullable().optional(),
  count: z.number().int().min(1).max(500).nullable().optional(),
});

export const createCalendarEventSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(5000).nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string().trim().min(1).max(64).default("UTC"),
  isAllDay: z.boolean().default(false),
  allDayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  location: z.string().max(250).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3b82f6"),
  category: z.string().trim().min(1).max(40).default("event"),
  recurrence: calendarRecurrenceInputSchema.nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  courseId: z.string().uuid().nullable().optional(),
  lessonId: z.string().uuid().nullable().optional(),
  noteId: z.string().uuid().nullable().optional(),
});

export const updateCalendarEventSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  isAllDay: z.boolean().optional(),
  allDayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  location: z.string().max(250).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  category: z.string().trim().min(1).max(40).optional(),
  recurrence: calendarRecurrenceInputSchema.nullable().optional(),
  scope: z.enum(["series", "single"]).default("series"),
  originalOccurrence: z.string().datetime().optional(),
});

export const scheduleTaskBlockSchema = z.object({
  taskId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string().trim().min(1).max(64).default("UTC"),
});

export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>;
export type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventSchema>;
export type ScheduleTaskBlockInput = z.infer<typeof scheduleTaskBlockSchema>;
