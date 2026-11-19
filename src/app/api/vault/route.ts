import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { deleteStorageObject } from "@/lib/supabase/storage";
import { getCurrentSession } from "@/modules/auth/session";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";
import {
  createVaultDocument,
  deleteVaultDocument,
  listVaultDocuments,
} from "@/modules/vault/service";

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().min(1).max(50).default("other"),
  storagePath: z.string().trim().min(1).max(500),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
  expiresAt: z.string().nullable().optional(),
  tags: z.array(z.string().trim().max(40)).max(15).optional(),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const documents = await listVaultDocuments(session.user.id, workspace.id);
  return apiOk({ documents });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid vault document");
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const document = await createVaultDocument(session.user.id, workspace.id, parsed.data);
    return apiOk({ document }, 201);
  } catch (error) {
    return apiError(
      400,
      "VAULT_VALIDATION_ERROR",
      error instanceof Error ? error.message : "Failed to save document"
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError(400, "VALIDATION_ERROR", "id required");

  const res = await deleteVaultDocument(session.user.id, id);
  if (res.storagePath) {
    await deleteStorageObject(res.storagePath);
  }
  return apiOk({ deleted: res.deleted });
}
