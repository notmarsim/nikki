import { and, desc, eq } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import { vaultDocuments } from "@/db/schema";

const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "image/",
  "text/",
  "application/vnd.openxmlformats-officedocument",
];

export function isAllowedVaultMime(mime: string): boolean {
  const lower = mime.toLowerCase();
  return ALLOWED_MIME_PREFIXES.some((p) => lower.startsWith(p));
}

export async function listVaultDocuments(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    return tx
      .select()
      .from(vaultDocuments)
      .where(
        and(
          eq(vaultDocuments.userId, userId),
          eq(vaultDocuments.workspaceId, workspaceId),
          eq(vaultDocuments.isArchived, false)
        )
      )
      .orderBy(desc(vaultDocuments.updatedAt));
  });
}

export async function createVaultDocument(
  userId: string,
  workspaceId: string,
  input: {
    name: string;
    description?: string | null;
    category: string;
    storagePath: string;
    mimeType: string;
    sizeBytes: number;
    expiresAt?: string | null;
    tags?: string[];
  }
) {
  if (!isAllowedVaultMime(input.mimeType)) {
    throw new Error("Unsupported document MIME type");
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > 20 * 1024 * 1024) {
    throw new Error("Document size must be between 1 byte and 20MB");
  }

  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(vaultDocuments)
      .values({
        userId,
        workspaceId,
        name: input.name,
        description: input.description ?? null,
        category: input.category,
        storagePath: input.storagePath,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        expiresAt: input.expiresAt ?? null,
        tags: input.tags ?? [],
      })
      .returning();
    return created!;
  });
}

export async function deleteVaultDocument(userId: string, docId: string) {
  return withUserRls(userId, async (tx) => {
    const [removed] = await tx
      .delete(vaultDocuments)
      .where(and(eq(vaultDocuments.id, docId), eq(vaultDocuments.userId, userId)))
      .returning({ storagePath: vaultDocuments.storagePath });
    return { deleted: true, storagePath: removed?.storagePath ?? null };
  });
}
