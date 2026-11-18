import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  listNotifications,
  markNotificationRead,
} from "@/modules/notifications/service";

const readSchema = z.object({
  id: z.string().uuid().optional(),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const data = await listNotifications(session.user.id);
  return apiOk(data);
}

export async function PATCH(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = readSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid notification id");
  }

  const result = await markNotificationRead(session.user.id, parsed.data.id);
  return apiOk(result);
}
