import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { userSettings, users } from "@/db/schema";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  DEFAULT_USER_PREFERENCES,
  mergeUserPreferences,
  userPreferencesSchema,
} from "@/modules/settings/registry";
import { getUserSettings } from "@/modules/users/service";

const updateSettingsSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  sidebarCollapsed: z.boolean().optional(),
  preferences: userPreferencesSchema.partial().optional(),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return apiError(401, "UNAUTHORIZED", "Authentication required");
  }

  const settings = await getUserSettings(session.user.id);
  const preferences = mergeUserPreferences(settings?.preferences);
  return apiOk({
    user: session.user,
    settings,
    preferences,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return apiError(401, "UNAUTHORIZED", "Authentication required");
  }

  const body: unknown = await request.json();
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Invalid settings payload",
      parsed.error.flatten().fieldErrors
    );
  }

  const { name, bio, timezone, theme, sidebarCollapsed, preferences } = parsed.data;

  if (
    name !== undefined ||
    bio !== undefined ||
    timezone !== undefined ||
    theme !== undefined
  ) {
    await db
      .update(users)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
        ...(theme !== undefined ? { theme } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));
  }

  const current = await getUserSettings(session.user.id);
  const mergedPrefs = preferences
    ? mergeUserPreferences({
        ...(typeof current?.preferences === "object" && current?.preferences
          ? current.preferences
          : {}),
        ...preferences,
      })
    : mergeUserPreferences(current?.preferences);

  if (sidebarCollapsed !== undefined || preferences !== undefined) {
    await db
      .update(userSettings)
      .set({
        ...(sidebarCollapsed !== undefined ? { sidebarCollapsed } : {}),
        ...(preferences !== undefined ? { preferences: mergedPrefs } : {}),
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, session.user.id));
  }

  return apiOk({ updated: true, preferences: mergedPrefs });
}

export async function DELETE() {
  const session = await getCurrentSession();
  if (!session) {
    return apiError(401, "UNAUTHORIZED", "Authentication required");
  }

  await db
    .update(userSettings)
    .set({
      preferences: DEFAULT_USER_PREFERENCES,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, session.user.id));

  return apiOk({ reset: true, preferences: DEFAULT_USER_PREFERENCES });
}
