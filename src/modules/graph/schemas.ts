import { z } from "zod";

export const graphNodeTypeSchema = z.enum([
  "note",
  "project",
  "course",
  "lesson",
  "bookmark",
  "snippet",
  "task",
  "command",
  "reference",
]);

export const saveNodePositionSchema = z.object({
  entityType: graphNodeTypeSchema,
  entityId: z.string().uuid(),
  positionX: z.number().finite(),
  positionY: z.number().finite(),
  isPinned: z.boolean().optional(),
});

export const saveGraphPreferencesSchema = z.object({
  layoutConfig: z
    .object({
      chargeStrength: z.number().min(50).max(1000).optional(),
      linkDistance: z.number().min(30).max(400).optional(),
      includeTasks: z.boolean().optional(),
    })
    .optional(),
  filterConfig: z
    .object({
      entityTypes: z.array(graphNodeTypeSchema).optional(),
      favoritesOnly: z.boolean().optional(),
    })
    .optional(),
});
