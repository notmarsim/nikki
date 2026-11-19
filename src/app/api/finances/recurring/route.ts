import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createRecurringRuleSchema } from "@/modules/finances/schemas";
import {
  createRecurringRule,
  deleteRecurringRule,
  FinanceServiceError,
  generateDueRecurringTransactions,
} from "@/modules/finances/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  if (
    typeof body === "object" &&
    body !== null &&
    "action" in body &&
    (body as { action?: string }).action === "generate"
  ) {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const result = await generateDueRecurringTransactions(session.user.id, workspace.id);
    return apiOk(result);
  }

  const parsed = createRecurringRuleSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid recurring rule", parsed.error.flatten().fieldErrors);
  }

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const rule = await createRecurringRule(session.user.id, workspace.id, parsed.data);
  return apiOk({ rule }, 201);
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError(400, "VALIDATION_ERROR", "Recurring rule id required");

  try {
    return apiOk(await deleteRecurringRule(session.user.id, id));
  } catch (error) {
    if (error instanceof FinanceServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to delete recurring rule");
  }
}
