export const MAX_CSV_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_VAULT_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

const DANGEROUS_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "sh",
  "ps1",
  "psm1",
  "js",
  "mjs",
  "cjs",
  "ts",
  "html",
  "htm",
  "svg",
  "php",
  "phtml",
  "dll",
  "msi",
  "vbs",
  "vbe",
  "jar",
  "scr",
  "hta",
]);

function startsWithBytes(buf: Uint8Array, prefix: number[]): boolean {
  if (buf.byteLength < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (buf[i] !== prefix[i]) return false;
  }
  return true;
}

function hasExecutableOrBinarySignature(buf: Uint8Array): boolean {
  // Windows PE/MZ, Linux ELF, Mach-O, PDF, ZIP/Office, PNG, JPEG, GIF
  if (startsWithBytes(buf, [0x4d, 0x5a])) return true; // MZ
  if (startsWithBytes(buf, [0x7f, 0x45, 0x4c, 0x46])) return true; // ELF
  if (startsWithBytes(buf, [0xca, 0xfe, 0xba, 0xbe])) return true; // Mach-O
  if (startsWithBytes(buf, [0xcf, 0xfa, 0xed, 0xfe])) return true; // Mach-O 64
  if (startsWithBytes(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return true; // %PDF-
  if (startsWithBytes(buf, [0x50, 0x4b, 0x03, 0x04])) return true; // PK (ZIP/DOCX)
  if (startsWithBytes(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return true; // PNG
  if (startsWithBytes(buf, [0xff, 0xd8, 0xff])) return true; // JPEG
  if (startsWithBytes(buf, [0x47, 0x49, 0x46, 0x38])) return true; // GIF8
  return false;
}

export function getSafeExtension(fileName: string): string {
  const base = sanitizeFileName(fileName);
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function sanitizeFileName(rawName: string): string {
  const leaf = rawName.split(/[/\\]/).pop() ?? "file";
  const cleaned = leaf
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/\.\.+/g, ".")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^[._-]+/, "");
  const limited = (cleaned || "file").slice(0, 140);
  return limited;
}

/**
 * Validates file size, extension, and raw binary magic numbers.
 * Never trusts client-supplied MIME types or extensions alone.
 */
export function validateUploadedFileBuffer(params: {
  buffer: Uint8Array;
  declaredMime: string;
  fileName: string;
  maxBytes?: number;
  allowedMimes?: ReadonlySet<string>;
}): { ok: true; detectedMime: string; safeName: string } | { ok: false; error: string } {
  const maxBytes = params.maxBytes ?? MAX_VAULT_UPLOAD_BYTES;
  if (params.buffer.byteLength === 0) {
    return { ok: false, error: "File is empty" };
  }
  if (params.buffer.byteLength > maxBytes) {
    return { ok: false, error: `File exceeds maximum size of ${Math.round(maxBytes / (1024 * 1024))} MB` };
  }

  const safeName = sanitizeFileName(params.fileName);
  const ext = getSafeExtension(safeName);
  if (ext && DANGEROUS_EXTENSIONS.has(ext)) {
    return { ok: false, error: "Executable or script file extensions are not allowed" };
  }

  const buf = params.buffer;
  let detectedMime: string | null = null;

  if (startsWithBytes(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    detectedMime = "application/pdf";
  } else if (startsWithBytes(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    detectedMime = "image/png";
  } else if (startsWithBytes(buf, [0xff, 0xd8, 0xff])) {
    detectedMime = "image/jpeg";
  } else if (startsWithBytes(buf, [0x47, 0x49, 0x46, 0x38])) {
    detectedMime = "image/gif";
  } else if (
    buf.byteLength >= 12 &&
    startsWithBytes(buf, [0x52, 0x49, 0x46, 0x46]) &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    detectedMime = "image/webp";
  } else if (startsWithBytes(buf, [0x50, 0x4b, 0x03, 0x04])) {
    if (ext === "docx") {
      detectedMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else {
      return { ok: false, error: "Archive/ZIP files are only accepted as .docx documents" };
    }
  } else {
    // Plain text / Markdown / CSV check: reject binary/executables/null-bytes and require valid UTF-8
    if (hasExecutableOrBinarySignature(buf) || buf.includes(0x00)) {
      return { ok: false, error: "Unsupported or disguised binary file signature" };
    }
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buf);
    } catch {
      return { ok: false, error: "Invalid UTF-8 text encoding" };
    }
    if (ext === "csv" || params.declaredMime === "text/csv") {
      detectedMime = "text/csv";
    } else if (ext === "md" || params.declaredMime === "text/markdown") {
      detectedMime = "text/markdown";
    } else {
      detectedMime = "text/plain";
    }
  }

  if (params.allowedMimes && !params.allowedMimes.has(detectedMime)) {
    return { ok: false, error: `File signature (${detectedMime}) is not allowed here` };
  }

  return { ok: true, detectedMime, safeName };
}

export function sanitizeCsvText(rawBufferOrText: Uint8Array | string): string {
  let text: string;
  if (typeof rawBufferOrText === "string") {
    text = rawBufferOrText;
  } else {
    if (rawBufferOrText.byteLength > MAX_CSV_UPLOAD_BYTES) {
      throw new Error("CSV file exceeds 5 MB limit");
    }
    if (hasExecutableOrBinarySignature(rawBufferOrText) || rawBufferOrText.includes(0x00)) {
      throw new Error("Invalid CSV file: binary content detected");
    }
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(rawBufferOrText);
    } catch {
      throw new Error("Invalid CSV encoding: UTF-8 required");
    }
  }

  if (text.includes("\u0000")) {
    throw new Error("Invalid CSV content: null bytes are not allowed");
  }

  // Strip UTF-8 BOM and unsafe control characters (preserve \n, \r, \t)
  return text
    .replace(/^\uFEFF/, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/**
 * Parses a single CSV line respecting quoted fields and escaped quotes ("").
 */
export function parseCsvLine(line: string, delimiter?: ";" | ","): string[] {
  const sep = delimiter ?? (line.includes(";") ? ";" : ",");
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}
