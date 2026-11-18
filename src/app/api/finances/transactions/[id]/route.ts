import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  FinanceServiceError,
  updateTransactionStatus,
} from "@/modules/finances/service";

const statusSchema = z.object({
  status: z.enum(["pending", "confirmed", "canceled"]),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid status");
  }

  try {
    const transaction = await updateTransactionStatus(
      session.user.id,
      id,
      parsed.data.status
    );
    return apiOk({ transaction });
  } catch (error) {
    if (error instanceof FinanceServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to update transaction");
  }
}
