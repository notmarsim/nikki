import { z } from "zod";

export const createSnippetSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  language: z.string().trim().min(1).max(40).default("typescript"),
  code: z.string().min(1).max(100_000),
  categoryId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  sourceNoteId: z.string().uuid().nullable().optional(),
  isFavorite: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(48)).max(20).optional(),
});

export const updateSnippetSchema = createSnippetSchema.partial();

export const createCommandSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  command: z.string().trim().min(1).max(4000),
  platform: z.string().trim().min(1).max(40).default("linux"),
  categoryId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  isFavorite: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(48)).max(20).optional(),
});

export const updateCommandSchema = createCommandSchema.partial();

export const createReferenceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  url: z.string().trim().url(),
  technology: z.string().trim().min(1).max(80),
  versionLabel: z.string().trim().max(40).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).nullable().optional(),
});

export const connectGithubSchema = z.object({
  token: z.string().trim().min(10).max(300),
});

export const linkProjectRepoSchema = z.object({
  projectId: z.string().uuid(),
  repositoryIdentifier: z.string().trim().min(3).max(200),
  repositoryUrl: z.string().trim().url(),
  defaultBranch: z.string().trim().max(100).default("main"),
  language: z.string().trim().max(60).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
});
