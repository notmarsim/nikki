import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  ALLOWED_REPORT_MODULES,
  createSavedReport,
  deleteSavedReport,
} from "@/modules/analytics/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const createReportSchema = z.object({
  name: z.string().trim().min(1).max(120),
  module: z.enum(ALLOWED_REPORT_MODULES),
  metric: z.string().trim().min(1).max(60),
  groupBy: z.enum(["day", "week", "month", "category", "project"]).default("day"),
  chartType: z.enum(["bar", "line", "donut", "table"]).default("bar"),
  period: z.enum(["today", "7d", "30d", "month", "year"]).default("30d"),
});

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createReportSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid report", parsed.error.flatten().fieldErrors);
  }

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const report = await createSavedReport(session.user.id, workspace.id, parsed.data);
  return apiOk({ report }, 201);
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError(400, "VALIDATION_ERROR", "Report id required");

  const result = await deleteSavedReport(session.user.id, id);
  return apiOk(result);
}
