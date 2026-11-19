import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  applyRecoveryBatch,
  dismissRecoveryPrompt,
  getRecoveryAnalysis,
} from "@/modules/recovery/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("apply"),
    items: z
      .array(
        z.object({
          taskId: z.string().uuid(),
          decision: z.enum(["reschedule", "complete", "cancel", "keep"]),
          newDueAt: z.string().optional(),
        })
      )
      .min(1)
      .max(100),
  }),
  z.object({ action: z.literal("dismiss"), hours: z.number().int().min(1).max(168).default(24) }),
]);

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await getRecoveryAnalysis(session.user.id, workspace.id);
  return apiOk(data);
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Invalid recovery payload");

  if (parsed.data.action === "dismiss") {
    return apiOk(await dismissRecoveryPrompt(session.user.id, parsed.data.hours));
  }
  return apiOk(await applyRecoveryBatch(session.user.id, parsed.data.items));
}
