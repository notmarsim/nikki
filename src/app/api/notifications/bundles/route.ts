import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { buildSmartNotificationBundles } from "@/modules/notifications/bundles";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const bundles = await buildSmartNotificationBundles(session.user.id, workspace.id);
  return apiOk({ bundles });
}
