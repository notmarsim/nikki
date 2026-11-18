import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { updateNoteSchema } from "@/modules/notes/schemas";
import {
  getNoteDetails,
  NoteServiceError,
  softDeleteNote,
  updateNote,
} from "@/modules/notes/service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  try {
    const details = await getNoteDetails(session.user.id, id);
    return apiOk(details);
  } catch (error) {
    if (error instanceof NoteServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to load note");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = updateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid update payload", parsed.error.flatten().fieldErrors);
  }

  try {
    const updated = await updateNote(session.user.id, id, parsed.data);
    return apiOk({ note: updated });
  } catch (error) {
    if (error instanceof NoteServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to update note");
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  try {
    await softDeleteNote(session.user.id, id);
    return apiOk({ deleted: true });
  } catch (error) {
    if (error instanceof NoteServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to delete note");
  }
}
