import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createDiagnosticReport } from "@/modules/ops/service";

const postSchema = z.object({
  platform: z.string().trim().min(1).max(40).default("web"),
  appVersion: z.string().trim().min(1).max(40).default("2.0.0"),
  summary: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid diagnostics payload");
  }

  // Strip potentially sensitive keys before persistence
  const sanitizedSummary: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data.summary)) {
    if (!/token|secret|password|cookie|authorization|key/i.test(k)) {
      sanitizedSummary[k] = v;
    }
  }

  const report = await createDiagnosticReport(session.user.id, {
    platform: parsed.data.platform,
    appVersion: parsed.data.appVersion,
    summary: sanitizedSummary,
  });

  return apiOk({ report }, 201);
}
