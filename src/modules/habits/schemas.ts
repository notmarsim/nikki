import { z } from "zod";

export const createHabitSchema = z.object({
  title: z.string().trim().min(1, "Habit title is required").max(160),
  description: z.string().max(2000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#10b981"),
  category: z.string().max(60).nullable().optional(),
  habitType: z.enum(["boolean", "quantitative"]).default("boolean"),
  frequency: z
    .enum(["daily", "specific_days", "weekly_count", "monthly_count"])
    .default("daily"),
  scheduleConfig: z
    .object({
      daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
      targetPerPeriod: z.number().int().min(1).max(31).optional(),
    })
    .default({}),
  targetValue: z.number().int().min(1).max(10000).default(1),
  unit: z.string().trim().min(1).max(30).default("times"),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  activityLink: z
    .object({
      activityType: z.enum(["focus_minutes", "lessons_completed", "flashcards_reviewed"]),
      projectId: z.string().uuid().nullable().optional(),
      courseId: z.string().uuid().nullable().optional(),
      category: z.string().max(60).nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const logHabitEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number().int().min(0).max(100000),
});
