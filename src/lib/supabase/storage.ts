import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const ATTACHMENTS_BUCKET = "nikki-attachments";
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
]);

function getServerSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase Storage is not configured (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required on server)"
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensurePrivateBucketExists(client: SupabaseClient): Promise<void> {
  const { data: buckets } = await client.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === ATTACHMENTS_BUCKET);
  if (!exists) {
    await client.storage.createBucket(ATTACHMENTS_BUCKET, {
      public: false,
      fileSizeLimit: MAX_UPLOAD_BYTES,
    });
  }
}

export async function uploadNoteAttachment(params: {
  userId: string;
  noteId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ storagePath: string }> {
  if (!ALLOWED_MIME_TYPES.has(params.mimeType)) {
    throw new Error("Unsupported file type");
  }
  if (params.buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("File exceeds 10 MB limit");
  }

  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${params.userId}/${params.noteId}/${Date.now()}-${safeName}`;

  const client = getServerSupabaseAdmin();
  await ensurePrivateBucketExists(client);

  const { error } = await client.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(storagePath, params.buffer, {
      contentType: params.mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return { storagePath };
}

export async function getSignedAttachmentUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string> {
  const client = getServerSupabaseAdmin();
  const { data, error } = await client.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${error?.message ?? "Unknown"}`);
  }

  return data.signedUrl;
}
