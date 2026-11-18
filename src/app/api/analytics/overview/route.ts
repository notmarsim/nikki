import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { getAnalyticsOverview } from "@/modules/analytics/service";
import type { AnalyticsPeriod } from "@/modules/analytics/utils";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { searchParams } = new URL(request.url);
  const rawPeriod = searchParams.get("period") ?? "30d";
  const period: AnalyticsPeriod = (
    ["today", "7d", "30d", "month", "year"].includes(rawPeriod) ? rawPeriod : "30d"
  ) as AnalyticsPeriod;
  const includeFinances = searchParams.get("includeFinances") !== "false";

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await getAnalyticsOverview({
    userId: session.user.id,
    workspaceId: workspace.id,
    period,
    includeFinances,
  });

  return apiOk(data);
}
