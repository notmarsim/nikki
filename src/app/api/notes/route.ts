import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createNoteSchema } from "@/modules/notes/schemas";
import {
  createNote,
  listNotes,
  NoteServiceError,
} from "@/modules/notes/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "true";
  const projectId = searchParams.get("projectId") ?? undefined;

  const items = await listNotes(session.user.id, workspace.id, {
    includeArchived,
    projectId,
  });

  return apiOk({ notes: items });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid note payload", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const created = await createNote(session.user.id, workspace.id, parsed.data);
    return apiOk({ note: created }, 201);
  } catch (error) {
    if (error instanceof NoteServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to create note");
  }
}
