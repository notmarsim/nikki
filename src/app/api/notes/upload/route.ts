import { and, eq, isNull } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { noteAttachments, notes } from "@/db/schema";
import { apiError, apiOk } from "@/lib/api-response";
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  uploadNoteAttachment,
} from "@/lib/supabase/storage";
import { getCurrentSession } from "@/modules/auth/session";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const noteId = formData.get("noteId");

    if (!(file instanceof File) || typeof noteId !== "string") {
      return apiError(400, "VALIDATION_ERROR", "File and noteId are required");
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return apiError(400, "UNSUPPORTED_FILE_TYPE", "File type is not allowed");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return apiError(400, "FILE_TOO_LARGE", "File exceeds 10 MB limit");
    }

    const ownedNote = await db
      .select({ id: notes.id })
      .from(notes)
      .where(
        and(
          eq(notes.id, noteId),
          eq(notes.userId, session.user.id),
          isNull(notes.deletedAt)
        )
      )
      .limit(1);

    if (!ownedNote[0]) {
      return apiError(404, "NOTE_NOT_FOUND", "Target note not found");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { storagePath } = await uploadNoteAttachment({
      userId: session.user.id,
      noteId,
      fileName: file.name,
      mimeType: file.type,
      buffer,
    });

    const [attachment] = await db
      .insert(noteAttachments)
      .values({
        userId: session.user.id,
        noteId,
        storagePath,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      })
      .returning();

    if (!attachment) {
      return apiError(500, "UPLOAD_FAILED", "Failed to save attachment metadata");
    }

    return apiOk(
      {
        attachment,
        url: `/api/notes/attachments/${attachment.id}`,
      },
      201
    );
  } catch (error) {
    return apiError(
      500,
      "UPLOAD_ERROR",
      error instanceof Error ? error.message : "Upload failed"
    );
  }
}
