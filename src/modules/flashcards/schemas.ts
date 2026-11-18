import { z } from "zod";

export const createDeckSchema = z.object({
  title: z.string().trim().min(1, "Deck title is required").max(160),
  description: z.string().max(2000).nullable().optional(),
  courseId: z.string().uuid().nullable().optional(),
  moduleId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export const createFlashcardSchema = z.object({
  deckId: z.string().uuid(),
  noteType: z.enum(["basic", "basic_reversed", "cloze"]).default("basic"),
  front: z.string().trim().min(1, "Front content is required").max(5000),
  back: z.string().trim().max(5000).default(""),
  clozeText: z.string().trim().max(5000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  sourceNoteId: z.string().uuid().nullable().optional(),
  courseId: z.string().uuid().nullable().optional(),
});

export const reviewFlashcardSchema = z.object({
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  reviewRequestId: z.string().uuid(),
});
