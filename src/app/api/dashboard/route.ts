import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { getDashboardData } from "@/modules/dashboard/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await getDashboardData(session.user.id, workspace.id);
  return apiOk(data);
}
