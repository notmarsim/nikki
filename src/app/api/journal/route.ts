import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalOverview,
} from "@/modules/journal/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const createSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().max(160).nullable().optional(),
  content: z.string().trim().min(1).max(20_000),
  mood: z.string().trim().max(40).nullable().optional(),
  templateKind: z.string().trim().max(40).optional(),
  tags: z.array(z.string().trim().max(40)).max(15).optional(),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await getJournalOverview(session.user.id, workspace.id);
  return apiOk(data);
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid journal entry");
  }

  const entry = await createJournalEntry(session.user.id, parsed.data);
  return apiOk({ entry }, 201);
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError(400, "VALIDATION_ERROR", "id required");

  const res = await deleteJournalEntry(session.user.id, id);
  return apiOk(res);
}
