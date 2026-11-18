import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { userSettings, users } from "@/db/schema";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { getUserSettings } from "@/modules/users/service";

const updateSettingsSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  sidebarCollapsed: z.boolean().optional(),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return apiError(401, "UNAUTHORIZED", "Authentication required");
  }

  const settings = await getUserSettings(session.user.id);
  return apiOk({ user: session.user, settings });
}

export async function PATCH(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return apiError(401, "UNAUTHORIZED", "Authentication required");
  }

  const body: unknown = await request.json();
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid settings payload", parsed.error.flatten().fieldErrors);
  }

  const { name, timezone, theme, sidebarCollapsed } = parsed.data;

  if (name !== undefined || timezone !== undefined || theme !== undefined) {
    await db
      .update(users)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
        ...(theme !== undefined ? { theme } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));
  }

  if (sidebarCollapsed !== undefined) {
    await db
      .update(userSettings)
      .set({
        sidebarCollapsed,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, session.user.id));
  }

  const updatedSettings = await getUserSettings(session.user.id);
  return apiOk({ updated: true, settings: updatedSettings });
}
