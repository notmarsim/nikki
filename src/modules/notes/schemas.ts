import { z } from "zod";
import type { NoteBlockDocument } from "@/db/schema";

const noteBlockNodeSchema: z.ZodType<Record<string, unknown>> = z.record(z.unknown());

export const noteDocumentSchema = z.object({
  version: z.literal(1).default(1),
  type: z.literal("doc").default("doc"),
  content: z.array(noteBlockNodeSchema).default([]),
}) as unknown as z.ZodType<NoteBlockDocument>;

export const createNoteSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  icon: z.string().trim().min(1).max(40).optional(),
  parentId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  templateId: z
    .enum(["blank", "study", "tech_doc", "meeting", "journal", "project_plan"])
    .optional(),
  docKind: z.enum(["note", "cheatsheet", "documentation"]).optional(),
  contentJson: noteDocumentSchema.optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  icon: z.string().trim().min(1).max(40).nullable().optional(),
  coverPath: z.string().trim().max(500).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  contentJson: noteDocumentSchema.optional(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  expectedVersion: z.number().int().min(1).optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
