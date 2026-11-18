import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createInboxItemSchema } from "@/modules/inbox/schemas";
import {
  createInboxItem,
  InboxServiceError,
  listInboxItems,
} from "@/modules/inbox/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;

  const items = await listInboxItems(session.user.id, workspace.id, status);
  return apiOk({ items });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createInboxItemSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid inbox item", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const item = await createInboxItem(session.user.id, workspace.id, parsed.data);
    return apiOk({ item }, 201);
  } catch (error) {
    if (error instanceof InboxServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to capture item");
  }
}
