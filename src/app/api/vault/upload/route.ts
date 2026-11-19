import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { MAX_VAULT_UPLOAD_BYTES, validateUploadedFileBuffer } from "@/lib/file-security";
import { uploadVaultFile } from "@/lib/supabase/storage";
import { getCurrentSession } from "@/modules/auth/session";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";
import { createVaultDocument } from "@/modules/vault/service";

const VAULT_ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const rawName = typeof formData.get("name") === "string" ? String(formData.get("name")).trim() : "";
    const category =
      typeof formData.get("category") === "string" ? String(formData.get("category")).trim() : "other";
    const description =
      typeof formData.get("description") === "string" ? String(formData.get("description")).trim() : null;
    const expiresAt =
      typeof formData.get("expiresAt") === "string" && String(formData.get("expiresAt")).trim()
        ? String(formData.get("expiresAt")).trim()
        : null;

    if (!(file instanceof File)) {
      return apiError(400, "VALIDATION_ERROR", "File is required");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validated = validateUploadedFileBuffer({
      buffer,
      declaredMime: file.type,
      fileName: file.name,
      maxBytes: MAX_VAULT_UPLOAD_BYTES,
      allowedMimes: VAULT_ALLOWED_MIMES,
    });

    if (!validated.ok) {
      return apiError(400, "UNSUPPORTED_FILE_TYPE", validated.error);
    }

    const { storagePath } = await uploadVaultFile({
      userId: session.user.id,
      safeName: validated.safeName,
      mimeType: validated.detectedMime,
      buffer,
    });

    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const document = await createVaultDocument(session.user.id, workspace.id, {
      name: (rawName || validated.safeName).slice(0, 200),
      description: description ? description.slice(0, 500) : null,
      category: category.slice(0, 50) || "other",
      storagePath,
      mimeType: validated.detectedMime,
      sizeBytes: buffer.byteLength,
      expiresAt,
    });

    return apiOk({ document }, 201);
  } catch (error) {
    return apiError(
      500,
      "VAULT_UPLOAD_ERROR",
      error instanceof Error ? error.message : "Failed to upload document"
    );
  }
}
