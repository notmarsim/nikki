import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { graphNodeTypeSchema } from "@/modules/graph/schemas";
import {
  getLocalGraph,
  getRelatedNotesByTagsOrProject,
  type GraphEntityType,
} from "@/modules/graph/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType") ?? "note";
  const entityId = searchParams.get("entityId");
  const depthNum = Number(searchParams.get("depth") ?? "1");

  const parsedType = graphNodeTypeSchema.safeParse(entityType);
  if (!parsedType.success || !entityId || !z.string().uuid().safeParse(entityId).success) {
    return apiError(400, "VALIDATION_ERROR", "Valid entityType and entityId are required");
  }

  const depth = (depthNum === 2 ? 2 : depthNum === 3 ? 3 : 1) as 1 | 2 | 3;
  const workspace = await getOrCreateDefaultWorkspace(session.user.id);

  const [subgraph, relatedNotes] = await Promise.all([
    getLocalGraph({
      userId: session.user.id,
      workspaceId: workspace.id,
      entityType: parsedType.data as GraphEntityType,
      entityId,
      depth,
    }),
    parsedType.data === "note"
      ? getRelatedNotesByTagsOrProject(session.user.id, workspace.id, entityId)
      : Promise.resolve([]),
  ]);

  return apiOk({ ...subgraph, relatedNotes });
}
