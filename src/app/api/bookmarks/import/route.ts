import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  createBookmark,
  parseNetscapeBookmarksHtml,
} from "@/modules/bookmarks/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const importSchema = z.object({
  html: z.string().min(1).max(2_000_000),
  collectionId: z.string().uuid().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Valid Netscape HTML export is required");
  }

  const items = parseNetscapeBookmarksHtml(parsed.data.html);
  const workspace = await getOrCreateDefaultWorkspace(session.user.id);

  let imported = 0;
  let skipped = 0;
  for (const item of items) {
    try {
      await createBookmark(session.user.id, workspace.id, {
        url: item.url,
        title: item.title,
        collectionId: parsed.data.collectionId ?? null,
        resourceType: "website",
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  return apiOk({ totalFound: items.length, imported, skipped });
}
