import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  userSettings,
  users,
  workspaces,
  type DashboardWidgetConfig,
  type UserRecord,
  type UserSettingsRecord,
  type WorkspaceRecord,
} from "@/db/schema";

export const DEFAULT_DASHBOARD_LAYOUT: DashboardWidgetConfig[] = [
  { id: "greeting", type: "greeting", title: "Overview", size: "lg", order: 0 },
  { id: "tasks-today", type: "tasks_today", title: "Tasks for Today", size: "md", order: 1 },
  { id: "active-projects", type: "active_projects", title: "Active Projects", size: "md", order: 2 },
  { id: "recent-notes", type: "recent_notes", title: "Recent Notes", size: "md", order: 3 },
  { id: "system-modules", type: "module_status", title: "System Modules", size: "md", order: 4 },
];

export async function createUserWithDefaults(params: {
  email: string;
  name: string;
  passwordHash: string;
  timezone?: string;
}): Promise<{
  user: Omit<UserRecord, "passwordHash">;
  workspace: WorkspaceRecord;
  settings: UserSettingsRecord;
}> {
  return db.transaction(async (tx) => {
    const [createdUser] = await tx
      .insert(users)
      .values({
        email: params.email,
        name: params.name,
        passwordHash: params.passwordHash,
        timezone: params.timezone ?? "UTC",
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        timezone: users.timezone,
        theme: users.theme,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    if (!createdUser) {
      throw new Error("Failed to create user record");
    }

    const [createdWorkspace] = await tx
      .insert(workspaces)
      .values({
        ownerId: createdUser.id,
        name: "Personal",
        slug: "personal",
        icon: "Layers",
        description: "Default personal workspace",
      })
      .returning();

    if (!createdWorkspace) {
      throw new Error("Failed to create default workspace");
    }

    const [createdSettings] = await tx
      .insert(userSettings)
      .values({
        userId: createdUser.id,
        defaultWorkspaceId: createdWorkspace.id,
        dashboardLayout: DEFAULT_DASHBOARD_LAYOUT,
      })
      .returning();

    if (!createdSettings) {
      throw new Error("Failed to create user settings");
    }

    return {
      user: createdUser,
      workspace: createdWorkspace,
      settings: createdSettings,
    };
  });
}

export async function getUserWorkspaces(userId: string): Promise<WorkspaceRecord[]> {
  return db.select().from(workspaces).where(eq(workspaces.ownerId, userId));
}

export async function getUserSettings(userId: string): Promise<UserSettingsRecord | null> {
  const rows = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}
