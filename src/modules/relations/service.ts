import { and, eq, inArray, or } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  bookmarks,
  courses,
  developerCommands,
  developerReferences,
  developerSnippets,
  entityRelations,
  entityTags,
  lessons,
  notes,
  projects,
  tags,
  tasks,
} from "@/db/schema";

export type RelatableEntityType =
  | "note"
  | "task"
  | "project"
  | "course"
  | "lesson"
  | "bookmark"
  | "snippet"
  | "command"
  | "reference";

export type RelationKind =
  | "references"
  | "belongs_to"
  | "blocks"
  | "derived_from"
  | "related_to";

export class RelationServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

async function assertEntityOwnedByUser(
  tx: Parameters<Parameters<typeof withUserRls>[1]>[0],
  userId: string,
  entityType: RelatableEntityType,
  entityId: string
): Promise<boolean> {
  switch (entityType) {
    case "note": {
      const rows = await tx
        .select({ id: notes.id })
        .from(notes)
        .where(and(eq(notes.id, entityId), eq(notes.userId, userId)))
        .limit(1);
      return rows.length > 0;
    }
    case "task": {
      const rows = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, entityId), eq(tasks.userId, userId)))
        .limit(1);
      return rows.length > 0;
    }
    case "project": {
      const rows = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, entityId), eq(projects.userId, userId)))
        .limit(1);
      return rows.length > 0;
    }
    case "course": {
      const rows = await tx
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.id, entityId), eq(courses.userId, userId)))
        .limit(1);
      return rows.length > 0;
    }
    case "lesson": {
      const rows = await tx
        .select({ id: lessons.id })
        .from(lessons)
        .where(and(eq(lessons.id, entityId), eq(lessons.userId, userId)))
        .limit(1);
      return rows.length > 0;
    }
    case "bookmark": {
      const rows = await tx
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(and(eq(bookmarks.id, entityId), eq(bookmarks.userId, userId)))
        .limit(1);
      return rows.length > 0;
    }
    case "snippet": {
      const rows = await tx
        .select({ id: developerSnippets.id })
        .from(developerSnippets)
        .where(
          and(
            eq(developerSnippets.id, entityId),
            eq(developerSnippets.userId, userId)
          )
        )
        .limit(1);
      return rows.length > 0;
    }
    case "command": {
      const rows = await tx
        .select({ id: developerCommands.id })
        .from(developerCommands)
        .where(
          and(
            eq(developerCommands.id, entityId),
            eq(developerCommands.userId, userId)
          )
        )
        .limit(1);
      return rows.length > 0;
    }
    case "reference": {
      const rows = await tx
        .select({ id: developerReferences.id })
        .from(developerReferences)
        .where(
          and(
            eq(developerReferences.id, entityId),
            eq(developerReferences.userId, userId)
          )
        )
        .limit(1);
      return rows.length > 0;
    }
  }
}

export async function createEntityRelation(
  userId: string,
  input: {
    sourceType: RelatableEntityType;
    sourceId: string;
    targetType: RelatableEntityType;
    targetId: string;
    relationType: RelationKind;
    metadata?: Record<string, unknown>;
  }
) {
  if (input.sourceType === input.targetType && input.sourceId === input.targetId) {
    throw new RelationServiceError(400, "SELF_RELATION", "Cannot relate an entity to itself");
  }

  return withUserRls(userId, async (tx) => {
    const [sourceOk, targetOk] = await Promise.all([
      assertEntityOwnedByUser(tx, userId, input.sourceType, input.sourceId),
      assertEntityOwnedByUser(tx, userId, input.targetType, input.targetId),
    ]);

    if (!sourceOk || !targetOk) {
      throw new RelationServiceError(404, "NOT_FOUND", "Source or target entity not found");
    }

    const existing = await tx
      .select()
      .from(entityRelations)
      .where(
        and(
          eq(entityRelations.userId, userId),
          eq(entityRelations.sourceType, input.sourceType),
          eq(entityRelations.sourceId, input.sourceId),
          eq(entityRelations.targetType, input.targetType),
          eq(entityRelations.targetId, input.targetId),
          eq(entityRelations.relationType, input.relationType)
        )
      )
      .limit(1);

    if (existing.length > 0) return existing[0]!;

    const [created] = await tx
      .insert(entityRelations)
      .values({
        userId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        targetType: input.targetType,
        targetId: input.targetId,
        relationType: input.relationType,
        metadata: input.metadata ?? null,
      })
      .returning();

    return created!;
  });
}

export async function deleteEntityRelation(userId: string, relationId: string) {
  return withUserRls(userId, async (tx) => {
    const deleted = await tx
      .delete(entityRelations)
      .where(and(eq(entityRelations.id, relationId), eq(entityRelations.userId, userId)))
      .returning({ id: entityRelations.id });

    if (deleted.length === 0) {
      throw new RelationServiceError(404, "NOT_FOUND", "Relation not found");
    }
    return deleted[0]!;
  });
}

export async function listEntityRelations(
  userId: string,
  entityType: RelatableEntityType,
  entityId: string
) {
  return withUserRls(userId, async (tx) => {
    return tx
      .select()
      .from(entityRelations)
      .where(
        and(
          eq(entityRelations.userId, userId),
          or(
            and(
              eq(entityRelations.sourceType, entityType),
              eq(entityRelations.sourceId, entityId)
            ),
            and(
              eq(entityRelations.targetType, entityType),
              eq(entityRelations.targetId, entityId)
            )
          )
        )
      );
  });
}

export async function syncEntityTags(
  userId: string,
  workspaceId: string,
  entityType: RelatableEntityType,
  entityId: string,
  tagNames: string[]
) {
  const normalized = Array.from(
    new Set(
      tagNames
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 48)
    )
  );

  return withUserRls(userId, async (tx) => {
    await tx
      .delete(entityTags)
      .where(
        and(eq(entityTags.entityType, entityType), eq(entityTags.entityId, entityId))
      );

    if (normalized.length === 0) return [];

    const existingTags = await tx
      .select()
      .from(tags)
      .where(and(eq(tags.workspaceId, workspaceId), inArray(tags.name, normalized)));

    const tagMap = new Map(existingTags.map((t) => [t.name, t]));
    const missing = normalized.filter((name) => !tagMap.has(name));

    if (missing.length > 0) {
      const inserted = await tx
        .insert(tags)
        .values(
          missing.map((name) => ({
            userId,
            workspaceId,
            name,
          }))
        )
        .onConflictDoNothing()
        .returning();
      for (const row of inserted) {
        tagMap.set(row.name, row);
      }
      if (inserted.length < missing.length) {
        const refetched = await tx
          .select()
          .from(tags)
          .where(and(eq(tags.workspaceId, workspaceId), inArray(tags.name, missing)));
        for (const row of refetched) {
          tagMap.set(row.name, row);
        }
      }
    }

    const tagIds = normalized
      .map((name) => tagMap.get(name)?.id)
      .filter((id): id is string => Boolean(id));

    if (tagIds.length > 0) {
      await tx
        .insert(entityTags)
        .values(
          tagIds.map((tagId) => ({
            tagId,
            entityType,
            entityId,
          }))
        )
        .onConflictDoNothing();
    }

    return normalized;
  });
}

export async function getTagsMapForEntities(
  userId: string,
  entityType: RelatableEntityType,
  entityIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (entityIds.length === 0) return result;

  await withUserRls(userId, async (tx) => {
    const rows = await tx
      .select({
        entityId: entityTags.entityId,
        tagName: tags.name,
      })
      .from(entityTags)
      .innerJoin(tags, eq(entityTags.tagId, tags.id))
      .where(
        and(
          eq(entityTags.entityType, entityType),
          inArray(entityTags.entityId, entityIds),
          eq(tags.userId, userId)
        )
      );

    for (const row of rows) {
      const list = result.get(row.entityId) ?? [];
      list.push(row.tagName);
      result.set(row.entityId, list);
    }
  });

  return result;
}
