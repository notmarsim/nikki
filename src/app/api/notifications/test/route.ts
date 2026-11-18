import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createNotification } from "@/modules/notifications/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function POST() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const notification = await createNotification({
    userId: session.user.id,
    workspaceId: workspace.id,
    category: "system",
    title: "Nikki Test Notification",
    body: "Your notification channel is connected to Supabase.",
    href: "/settings",
  });

  return apiOk({
    notification,
    remotePushConfigured: {
      webPushVapid: Boolean(
        (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) &&
          process.env.VAPID_PRIVATE_KEY
      ),
      fcm: Boolean(process.env.FCM_SERVER_KEY),
    },
  });
}
