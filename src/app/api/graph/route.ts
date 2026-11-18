import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { graphNodeTypeSchema } from "@/modules/graph/schemas";
import { getGlobalGraph, type GraphEntityType } from "@/modules/graph/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { searchParams } = new URL(request.url);
  const includeTasks = searchParams.get("includeTasks") === "true";
  const favoritesOnly = searchParams.get("favoritesOnly") === "true";
  const tag = searchParams.get("tag") ?? undefined;
  const projectId = searchParams.get("projectId") ?? undefined;
  const courseId = searchParams.get("courseId") ?? undefined;
  const search = searchParams.get("q") ?? undefined;
  const limitParam = Number(searchParams.get("limit") ?? "300");

  const rawTypes = searchParams.get("types")?.split(",").filter(Boolean) ?? [];
  const types: GraphEntityType[] = [];
  for (const t of rawTypes) {
    const parsed = graphNodeTypeSchema.safeParse(t);
    if (parsed.success && parsed.data !== "command") {
      types.push(parsed.data as GraphEntityType);
    }
  }

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const graph = await getGlobalGraph({
    userId: session.user.id,
    workspaceId: workspace.id,
    includeTasks,
    types: types.length > 0 ? types : undefined,
    tag,
    projectId,
    courseId,
    favoritesOnly,
    search,
    limit: Number.isFinite(limitParam) ? limitParam : 300,
  });

  return apiOk(graph);
}
