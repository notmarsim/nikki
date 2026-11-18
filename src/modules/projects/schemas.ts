import { z } from "zod";

export const PROJECT_STATUSES = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "archived",
] as const;

export const PROJECT_PRIORITIES = [
  "none",
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export const MILESTONE_STATUSES = [
  "planned",
  "active",
  "completed",
  "cancelled",
] as const;

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(160),
  description: z.string().max(5000).nullable().optional(),
  icon: z.string().trim().min(1).max(40).optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PROJECT_PRIORITIES).optional(),
  startDate: z.string().datetime().nullable().optional(),
  targetDate: z.string().datetime().nullable().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const createMilestoneSchema = z.object({
  name: z.string().trim().min(1, "Milestone name is required").max(160),
  description: z.string().max(3000).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  status: z.enum(MILESTONE_STATUSES).optional(),
});

export const updateMilestoneSchema = createMilestoneSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
