import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { payStatementSchema } from "@/modules/finances/schemas";
import { FinanceServiceError, payStatement } from "@/modules/finances/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = payStatementSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid payment", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const result = await payStatement(session.user.id, workspace.id, parsed.data);
    return apiOk(result);
  } catch (error) {
    if (error instanceof FinanceServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to pay statement");
  }
}
