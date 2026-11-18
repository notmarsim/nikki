import crypto from "node:crypto";

function getEncryptionKey(): Buffer {
  const secret =
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    "nikki-local-fallback-key-change-in-prod";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plainText: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token payload");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64!, "base64");
  const tag = Buffer.from(tagB64!, "base64");
  const encrypted = Buffer.from(dataB64!, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
