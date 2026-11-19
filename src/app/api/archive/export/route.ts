import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { exportHistoryPayload } from "@/modules/archive/service";
import { getCurrentSession } from "@/modules/auth/session";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { searchParams } = new URL(request.url);
  const rawScope = searchParams.get("scope");
  const scope =
    rawScope === "completed" ||
    rawScope === "archived" ||
    rawScope === "project" ||
    rawScope === "archived_projects"
      ? rawScope
      : "all";
  const format = searchParams.get("format") === "json" ? "json" : "csv";
  const projectId = searchParams.get("projectId") ?? undefined;

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const { content } = await exportHistoryPayload(session.user.id, workspace.id, {
    scope,
    format,
    projectId,
  });

  const ext = format === "json" ? "json" : "csv";
  const mime = format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8";

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="nikki-history-${scope}.${ext}"`,
    },
  });
}
