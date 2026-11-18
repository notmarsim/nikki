import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  exportBookmarksToNetscapeHtml,
  listBookmarks,
} from "@/modules/bookmarks/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const format = new URL(request.url).searchParams.get("format") ?? "json";
  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await listBookmarks({
    userId: session.user.id,
    workspaceId: workspace.id,
    limit: 100,
  });

  if (format === "html") {
    const html = exportBookmarksToNetscapeHtml(data.bookmarks);
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": 'attachment; filename="nikki-bookmarks.html"',
      },
    });
  }

  return new NextResponse(JSON.stringify({ bookmarks: data.bookmarks }, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="nikki-bookmarks.json"',
    },
  });
}
