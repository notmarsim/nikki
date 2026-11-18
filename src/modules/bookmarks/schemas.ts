import { z } from "zod";

export const bookmarkResourceTypeSchema = z.enum([
  "website",
  "article",
  "video",
  "docs",
  "github",
  "pdf",
  "book",
  "tool",
  "other",
]);

export const bookmarkReadingStatusSchema = z.enum([
  "unread",
  "reading",
  "completed",
  "archived",
]);

export const createBookmarkSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  title: z.string().trim().min(1).max(240).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  thumbnailUrl: z.string().url().nullable().optional(),
  faviconUrl: z.string().url().nullable().optional(),
  resourceType: bookmarkResourceTypeSchema.default("website"),
  collectionId: z.string().uuid().nullable().optional(),
  readingStatus: bookmarkReadingStatusSchema.default("unread"),
  isFavorite: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(48)).max(20).optional(),
});

export const updateBookmarkSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  resourceType: bookmarkResourceTypeSchema.optional(),
  collectionId: z.string().uuid().nullable().optional(),
  readingStatus: bookmarkReadingStatusSchema.optional(),
  isFavorite: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(48)).max(20).optional(),
});

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  icon: z.string().trim().max(40).default("Folder"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f97316"),
  parentId: z.string().uuid().nullable().optional(),
});

export const updateCollectionSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  icon: z.string().trim().max(40).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
