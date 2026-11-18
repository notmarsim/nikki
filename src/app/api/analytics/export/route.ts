import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { getAnalyticsOverview } from "@/modules/analytics/service";
import type { AnalyticsPeriod } from "@/modules/analytics/utils";
import { sanitizeCsvCell } from "@/modules/finances/money";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const rawPeriod = new URL(request.url).searchParams.get("period") ?? "30d";
  const period: AnalyticsPeriod = (
    ["today", "7d", "30d", "month", "year"].includes(rawPeriod) ? rawPeriod : "30d"
  ) as AnalyticsPeriod;

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await getAnalyticsOverview({
    userId: session.user.id,
    workspaceId: workspace.id,
    period,
    includeFinances: false,
  });

  const rows = [
    ["Metric", "Value"].map(sanitizeCsvCell).join(","),
    ...Object.entries(data.kpis).map(([k, v]) =>
      [sanitizeCsvCell(k), sanitizeCsvCell(String(v ?? "N/A"))].join(",")
    ),
  ];

  return new NextResponse(rows.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nikki-analytics-${period}.csv"`,
    },
  });
}
