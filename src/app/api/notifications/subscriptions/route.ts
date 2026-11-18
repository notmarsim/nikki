import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  listDeviceSubscriptions,
  registerDeviceSubscription,
  removeDeviceSubscription,
} from "@/modules/notifications/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const registerSchema = z.object({
  platform: z.enum(["web_push", "capacitor_android", "in_app"]),
  deviceLabel: z.string().trim().min(1).max(100).default("Device"),
  endpoint: z.string().url().nullable().optional(),
  p256dh: z.string().max(500).nullable().optional(),
  authSecret: z.string().max(500).nullable().optional(),
  fcmToken: z.string().max(500).nullable().optional(),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const devices = await listDeviceSubscriptions(session.user.id);
  return apiOk({
    devices,
    vapidConfigured: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
  });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid subscription", parsed.error.flatten().fieldErrors);
  }

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const device = await registerDeviceSubscription({
    userId: session.user.id,
    workspaceId: workspace.id,
    ...parsed.data,
  });

  return apiOk({ device }, 201);
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError(400, "VALIDATION_ERROR", "Subscription id required");

  const result = await removeDeviceSubscription(session.user.id, id);
  return apiOk(result);
}
