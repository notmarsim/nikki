import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { getFinanceOverview } from "@/modules/finances/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { searchParams } = new URL(request.url);
  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await getFinanceOverview({
    userId: session.user.id,
    workspaceId: workspace.id,
    month: searchParams.get("month") ?? undefined,
    accountId: searchParams.get("accountId") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined,
  });
  return apiOk(data);
}
