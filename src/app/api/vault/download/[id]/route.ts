import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withUserRls } from "@/db/rls";
import { vaultDocuments } from "@/db/schema";
import { apiError } from "@/lib/api-response";
import { sanitizeFileName } from "@/lib/file-security";
import { getSignedVaultDownloadUrl } from "@/lib/supabase/storage";
import { getCurrentSession } from "@/modules/auth/session";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const doc = await withUserRls(session.user.id, async (tx) => {
    const [row] = await tx
      .select()
      .from(vaultDocuments)
      .where(and(eq(vaultDocuments.id, id), eq(vaultDocuments.userId, session.user.id)))
      .limit(1);
    return row ?? null;
  });

  if (!doc) {
    return apiError(404, "NOT_FOUND", "Document not found");
  }
  if (!doc.storagePath.startsWith("vault/")) {
    return apiError(400, "NO_FILE_ATTACHED", "This entry is metadata-only without an uploaded file");
  }

  try {
    const safeDownloadName = sanitizeFileName(doc.name);
    const signedUrl = await getSignedVaultDownloadUrl(doc.storagePath, safeDownloadName, 120);
    const response = NextResponse.redirect(signedUrl);
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return apiError(
      500,
      "DOWNLOAD_ERROR",
      error instanceof Error ? error.message : "Unable to generate download link"
    );
  }
}
