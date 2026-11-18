import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { noteAttachments } from "@/db/schema";
import { apiError } from "@/lib/api-response";
import { getSignedAttachmentUrl } from "@/lib/supabase/storage";
import { getCurrentSession } from "@/modules/auth/session";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;

  const rows = await db
    .select()
    .from(noteAttachments)
    .where(and(eq(noteAttachments.id, id), eq(noteAttachments.userId, session.user.id)))
    .limit(1);

  const attachment = rows[0];
  if (!attachment) {
    return apiError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
  }

  try {
    const signedUrl = await getSignedAttachmentUrl(attachment.storagePath);
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    return apiError(
      500,
      "STORAGE_ERROR",
      error instanceof Error ? error.message : "Unable to load attachment"
    );
  }
}
