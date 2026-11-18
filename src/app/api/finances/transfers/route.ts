import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createTransferSchema } from "@/modules/finances/schemas";
import { createTransfer, FinanceServiceError } from "@/modules/finances/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createTransferSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid transfer", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const transfer = await createTransfer(session.user.id, workspace.id, parsed.data);
    return apiOk({ transfer }, 201);
  } catch (error) {
    if (error instanceof FinanceServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to create transfer");
  }
}
