import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { getOpsDashboardData } from "@/modules/ops/service";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");
  if (!session.user.isAdmin) {
    return apiError(403, "FORBIDDEN", "Admin access required");
  }

  try {
    const data = await getOpsDashboardData(session.user.id);
    return apiOk(data);
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN_OPS") {
      return apiError(403, "FORBIDDEN", "Admin access required");
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to load ops telemetry");
  }
}
