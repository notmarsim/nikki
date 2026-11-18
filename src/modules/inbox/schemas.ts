import { z } from "zod";

export const INBOX_TYPES = ["note", "idea", "link", "task", "quick_note"] as const;
export const INBOX_STATUSES = ["pending", "processed", "archived"] as const;

export const createInboxItemSchema = z.object({
  type: z.enum(INBOX_TYPES).default("note"),
  title: z.string().trim().max(200).nullable().optional(),
  content: z.string().trim().min(1, "Content is required").max(10000),
  url: z.string().trim().url("Invalid URL").nullable().optional().or(z.literal("")),
});

export const updateInboxItemSchema = z.object({
  type: z.enum(INBOX_TYPES).optional(),
  title: z.string().trim().max(200).nullable().optional(),
  content: z.string().trim().min(1).max(10000).optional(),
  url: z.string().trim().url().nullable().optional().or(z.literal("")),
  status: z.enum(INBOX_STATUSES).optional(),
});

export const convertInboxItemSchema = z.object({
  targetType: z.enum(["note", "task", "bookmark"]),
  projectId: z.string().uuid().nullable().optional(),
  collectionId: z.string().uuid().nullable().optional(),
});

export type CreateInboxItemInput = z.infer<typeof createInboxItemSchema>;
export type UpdateInboxItemInput = z.infer<typeof updateInboxItemSchema>;
export type ConvertInboxItemInput = z.infer<typeof convertInboxItemSchema>;
