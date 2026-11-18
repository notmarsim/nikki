import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { getUserSettings, getUserWorkspaces } from "@/modules/users/service";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return apiError(401, "UNAUTHORIZED", "Authentication required");
  }

  const [workspaces, settings] = await Promise.all([
    getUserWorkspaces(session.user.id),
    getUserSettings(session.user.id),
  ]);

  return apiOk({
    user: session.user,
    workspaces,
    settings,
  });
}
