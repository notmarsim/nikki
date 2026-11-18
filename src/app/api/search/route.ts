import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { globalSearch, type SearchEntityType } from "@/modules/search/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const typeParam = searchParams.get("type");
  const limitParam = Number(searchParams.get("limit") ?? "20");

  const allowedTypes: SearchEntityType[] = [
    "note",
    "task",
    "project",
    "course",
    "event",
    "deck",
    "habit",
  ];
  const types: SearchEntityType[] | undefined =
    typeParam && allowedTypes.includes(typeParam as SearchEntityType)
      ? [typeParam as SearchEntityType]
      : undefined;

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const results = await globalSearch({
    userId: session.user.id,
    workspaceId: workspace.id,
    query,
    types,
    limit: Number.isFinite(limitParam) ? limitParam : 20,
  });

  return apiOk({ results });
}
