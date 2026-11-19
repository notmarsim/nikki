import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import {
  MAX_CSV_UPLOAD_BYTES,
  parseCsvLine,
  sanitizeCsvText,
  sanitizeFileName,
} from "@/lib/file-security";
import { getCurrentSession } from "@/modules/auth/session";
import { parseMoneyToCents } from "@/modules/finances/money";
import { importCsvSchema } from "@/modules/finances/schemas";
import { FinanceServiceError, importCsvTransactions } from "@/modules/finances/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const contentType = request.headers.get("content-type") ?? "";
  let payloadInput: unknown;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    const accountId = formData.get("accountId");

    if (!(file instanceof File) || typeof accountId !== "string") {
      return apiError(400, "VALIDATION_ERROR", "CSV file and accountId are required");
    }
    if (file.size === 0 || file.size > MAX_CSV_UPLOAD_BYTES) {
      return apiError(400, "VALIDATION_ERROR", "CSV file must be between 1 byte and 5 MB");
    }

    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const cleanText = sanitizeCsvText(buf);
      const lines = cleanText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      const rows: Array<{
        date: string;
        description: string;
        amountCents: number;
        type: "income" | "expense";
      }> = [];

      for (const line of lines) {
        const parts = parseCsvLine(line);
        if (parts.length < 3) continue;
        const [dateRaw, descRaw, amountRaw] = parts;
        if (!dateRaw || !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) continue;
        try {
          const cents = parseMoneyToCents(amountRaw!);
          rows.push({
            date: dateRaw,
            description: (descRaw || "Imported").replace(/[\x00-\x1f\x7f]/g, "").slice(0, 200),
            amountCents: Math.abs(cents),
            type: cents >= 0 ? "income" : "expense",
          });
        } catch {
          // skip invalid numeric row
        }
      }

      payloadInput = {
        accountId,
        filename: sanitizeFileName(file.name),
        rows,
      };
    } catch (err) {
      return apiError(
        400,
        "INVALID_CSV_FILE",
        err instanceof Error ? err.message : "Invalid CSV file"
      );
    }
  } else {
    payloadInput = await request.json();
  }

  const parsed = importCsvSchema.safeParse(payloadInput);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid CSV payload", parsed.error.flatten().fieldErrors);
  }

  const sanitizedRows = parsed.data.rows.map((r) => ({
    ...r,
    description: r.description.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 200),
  }));

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const result = await importCsvTransactions(session.user.id, workspace.id, {
      ...parsed.data,
      filename: sanitizeFileName(parsed.data.filename),
      rows: sanitizedRows,
    });
    return apiOk(result);
  } catch (error) {
    if (error instanceof FinanceServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to import CSV");
  }
}
