import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  createEntityRelation,
  deleteEntityRelation,
  listEntityRelations,
  RelationServiceError,
  type RelatableEntityType,
} from "@/modules/relations/service";

const entityTypeSchema = z.enum([
  "note",
  "task",
  "project",
  "course",
  "lesson",
  "bookmark",
  "snippet",
  "command",
  "reference",
]);

const createRelationSchema = z.object({
  sourceType: entityTypeSchema,
  sourceId: z.string().uuid(),
  targetType: entityTypeSchema,
  targetId: z.string().uuid(),
  relationType: z
    .enum(["references", "belongs_to", "blocks", "derived_from", "related_to"])
    .default("related_to"),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  const parsedType = entityTypeSchema.safeParse(entityType);
  if (!parsedType.success || !entityId || !z.string().uuid().safeParse(entityId).success) {
    return apiError(400, "VALIDATION_ERROR", "Valid entityType and entityId are required");
  }

  const relations = await listEntityRelations(
    session.user.id,
    parsedType.data as RelatableEntityType,
    entityId
  );
  return apiOk({ relations });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createRelationSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid relation", parsed.error.flatten().fieldErrors);
  }

  try {
    const relation = await createEntityRelation(session.user.id, parsed.data);
    return apiOk({ relation }, 201);
  } catch (error) {
    if (error instanceof RelationServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to create relation");
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) {
    return apiError(400, "VALIDATION_ERROR", "Valid relation id is required");
  }

  try {
    const deleted = await deleteEntityRelation(session.user.id, id);
    return apiOk({ deleted });
  } catch (error) {
    if (error instanceof RelationServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to delete relation");
  }
}
