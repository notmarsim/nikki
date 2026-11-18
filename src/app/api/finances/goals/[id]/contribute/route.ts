import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { goalContributionSchema } from "@/modules/finances/schemas";
import { contributeToGoal, FinanceServiceError } from "@/modules/finances/service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = goalContributionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid contribution", parsed.error.flatten().fieldErrors);
  }

  try {
    const goal = await contributeToGoal(session.user.id, id, parsed.data);
    return apiOk({ goal });
  } catch (error) {
    if (error instanceof FinanceServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to update goal");
  }
}
