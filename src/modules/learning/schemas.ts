import { z } from "zod";

export const createLearningPathSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  description: z.string().max(3000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8b5cf6"),
  goal: z.string().max(500).nullable().optional(),
});

export const updateLearningPathSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160).optional(),
  description: z.string().max(3000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  goal: z.string().max(500).nullable().optional(),
});

export const createCourseSchema = z.object({
  title: z.string().trim().min(1, "Course title is required").max(200),
  description: z.string().max(5000).nullable().optional(),
  platform: z.string().max(100).nullable().optional(),
  url: z.string().url().nullable().optional().or(z.literal("")),
  category: z.string().max(80).nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(100000).nullable().optional(),
  pathId: z.string().uuid().nullable().optional(),
});

export const updateCourseSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  platform: z.string().max(100).nullable().optional(),
  url: z.string().url().nullable().optional().or(z.literal("")),
  category: z.string().max(80).nullable().optional(),
  status: z
    .enum(["not_started", "in_progress", "on_hold", "completed", "archived"])
    .optional(),
  estimatedMinutes: z.number().int().min(1).max(100000).nullable().optional(),
});

export const createModuleSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(1, "Module title is required").max(200),
  description: z.string().max(2000).nullable().optional(),
});

export const createLessonSchema = z.object({
  moduleId: z.string().uuid(),
  title: z.string().trim().min(1, "Lesson title is required").max(200),
  description: z.string().max(5000).nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(10000).nullable().optional(),
  externalUrl: z.string().url().nullable().optional().or(z.literal("")),
});

export const updateLessonSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(["not_started", "in_progress", "completed"]).optional(),
  estimatedMinutes: z.number().int().min(1).max(10000).nullable().optional(),
  externalUrl: z.string().url().nullable().optional().or(z.literal("")),
  sortOrder: z.number().int().min(0).optional(),
});

export const linkLearningResourceSchema = z.object({
  courseId: z.string().uuid().nullable().optional(),
  lessonId: z.string().uuid().nullable().optional(),
  noteId: z.string().uuid().nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
});
