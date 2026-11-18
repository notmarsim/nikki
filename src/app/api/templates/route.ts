import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { installBuiltinTemplate, listTemplates } from "@/modules/templates/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const postSchema = z.object({
  templateId: z.string().min(1).max(80),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const data = await listTemplates(session.user.id);
  return apiOk(data);
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid template payload");
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const result = await installBuiltinTemplate(
      session.user.id,
      workspace.id,
      parsed.data.templateId
    );
    return apiOk(result, 201);
  } catch (err) {
    return apiError(404, "NOT_FOUND", err instanceof Error ? err.message : "Template not found");
  }
}
