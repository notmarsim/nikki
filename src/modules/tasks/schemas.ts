import { z } from "zod";

export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
] as const;

export const TASK_PRIORITIES = [
  "none",
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export const recurrenceInputSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly"]),
  interval: z.number().int().min(1).max(365).default(1),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(250),
  description: z.string().max(10000).nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  startAt: z.string().datetime().nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(10000).nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  noteId: z.string().uuid().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  milestoneId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  recurrence: recurrenceInputSchema.nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(250).optional(),
  description: z.string().max(10000).nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  startAt: z.string().datetime().nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(10000).nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  noteId: z.string().uuid().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  milestoneId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  recurrence: recurrenceInputSchema.nullable().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
