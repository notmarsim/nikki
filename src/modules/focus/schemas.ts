import { z } from "zod";

export const startFocusSchema = z.object({
  mode: z.enum(["pomodoro", "stopwatch"]).default("pomodoro"),
  description: z.string().max(500).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  courseId: z.string().uuid().nullable().optional(),
  lessonId: z.string().uuid().nullable().optional(),
  calendarEventId: z.string().uuid().nullable().optional(),
});

export const focusActionSchema = z.object({
  action: z.enum(["pause", "resume", "complete", "discard"]),
});

export const updateFocusPreferencesSchema = z.object({
  focusMinutes: z.number().int().min(1).max(180).optional(),
  shortBreakMinutes: z.number().int().min(1).max(60).optional(),
  longBreakMinutes: z.number().int().min(1).max(90).optional(),
  cyclesBeforeLongBreak: z.number().int().min(1).max(12).optional(),
  soundEnabled: z.boolean().optional(),
});
