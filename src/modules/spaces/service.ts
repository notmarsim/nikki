import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  notes,
  projects,
  tasks,
  users,
  userSettings,
  workspaceInvitations,
  workspaceMembers,
  workspaces,
} from "@/db/schema";

export type SpaceRole = "owner" | "admin" | "editor" | "viewer";

const ROLE_WEIGHT: Record<SpaceRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

export class SpaceServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export function hasRequiredRole(
  actual: string | null | undefined,
  required: SpaceRole
): boolean {
  if (!actual || !(actual in ROLE_WEIGHT)) return false;
  return ROLE_WEIGHT[actual as SpaceRole] >= ROLE_WEIGHT[required];
}

export async function getMemberRole(
  userId: string,
  workspaceId: string
): Promise<SpaceRole | null> {
  return withUserRls(userId, async (tx) => {
    const [member] = await tx
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId)
        )
      )
      .limit(1);
    if (member) return member.role as SpaceRole;

    const [ws] = await tx
      .select({ ownerId: workspaces.ownerId })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (ws?.ownerId === userId) return "owner";
    return null;
  });
}

export async function listUserSpaces(userId: string) {
  return withUserRls(userId, async (tx) => {
    const [memberRows, ownedRows, settingsRows] = await Promise.all([
      tx
        .select({
          workspaceId: workspaceMembers.workspaceId,
          role: workspaceMembers.role,
          workspace: workspaces,
        })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(eq(workspaceMembers.userId, userId)),
      tx.select().from(workspaces).where(eq(workspaces.ownerId, userId)),
      tx
        .select({ defaultWorkspaceId: userSettings.defaultWorkspaceId })
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1),
    ]);

    const map = new Map<
      string,
      typeof workspaces.$inferSelect & { role: SpaceRole }
    >();
    for (const r of memberRows) {
      map.set(r.workspace.id, { ...r.workspace, role: r.role as SpaceRole });
    }
    for (const ws of ownedRows) {
      if (!map.has(ws.id)) {
        map.set(ws.id, { ...ws, role: "owner" });
      }
    }

    const spaces = Array.from(map.values()).filter((s) => s.status !== "archived");
    const activeWorkspaceId =
      settingsRows[0]?.defaultWorkspaceId ?? spaces[0]?.id ?? null;

    return { spaces, activeWorkspaceId };
  });
}

export async function createSharedSpace(
  userId: string,
  input: { name: string; description?: string | null; color?: string; icon?: string }
) {
  return withUserRls(userId, async (tx) => {
    const slug = `${input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${crypto.randomBytes(2).toString("hex")}`;

    const [ws] = await tx
      .insert(workspaces)
      .values({
        ownerId: userId,
        name: input.name,
        slug,
        description: input.description ?? null,
        color: input.color ?? "#3b82f6",
        icon: input.icon ?? "Users",
        spaceType: "shared",
      })
      .returning();

    await tx.insert(workspaceMembers).values({
      workspaceId: ws!.id,
      userId,
      role: "owner",
    });

    return ws!;
  });
}

export async function switchActiveSpace(userId: string, workspaceId: string) {
  const role = await getMemberRole(userId, workspaceId);
  if (!role) {
    throw new SpaceServiceError(403, "FORBIDDEN", "You are not a member of this space");
  }
  return withUserRls(userId, async (tx) => {
    await tx
      .update(userSettings)
      .set({ defaultWorkspaceId: workspaceId, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId));
    return { activeWorkspaceId: workspaceId, role };
  });
}

export async function getSpaceDetails(userId: string, workspaceId: string) {
  const role = await getMemberRole(userId, workspaceId);
  if (!role) {
    throw new SpaceServiceError(403, "FORBIDDEN", "Access denied to this space");
  }

  return withUserRls(userId, async (tx) => {
    const [spaceRows, members, invites] = await Promise.all([
      tx
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1),
      tx
        .select({
          id: workspaceMembers.id,
          userId: workspaceMembers.userId,
          role: workspaceMembers.role,
          joinedAt: workspaceMembers.joinedAt,
          name: users.name,
          email: users.email,
        })
        .from(workspaceMembers)
        .innerJoin(users, eq(workspaceMembers.userId, users.id))
        .where(eq(workspaceMembers.workspaceId, workspaceId)),
      hasRequiredRole(role, "admin")
        ? tx
            .select({
              id: workspaceInvitations.id,
              email: workspaceInvitations.email,
              role: workspaceInvitations.role,
              status: workspaceInvitations.status,
              expiresAt: workspaceInvitations.expiresAt,
              createdAt: workspaceInvitations.createdAt,
            })
            .from(workspaceInvitations)
            .where(eq(workspaceInvitations.workspaceId, workspaceId))
            .orderBy(desc(workspaceInvitations.createdAt))
        : Promise.resolve([]),
    ]);

    const ws = spaceRows[0];
    if (!ws) {
      throw new SpaceServiceError(404, "NOT_FOUND", "Space not found");
    }

    return {
      space: { ...ws, role },
      role,
      members,
      invitations: invites,
    };
  });
}

export async function createSpaceInvitation(
  userId: string,
  workspaceId: string,
  input: { email: string; role: "admin" | "editor" | "viewer" }
) {
  const myRole = await getMemberRole(userId, workspaceId);
  if (!hasRequiredRole(myRole, "admin")) {
    throw new SpaceServiceError(403, "FORBIDDEN", "Only admins or owners can invite members");
  }

  const rawToken = crypto.randomBytes(24).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(workspaceInvitations)
      .values({
        workspaceId,
        invitedByUserId: userId,
        email: input.email.trim().toLowerCase(),
        role: input.role,
        tokenHash,
        expiresAt,
      })
      .returning({
        id: workspaceInvitations.id,
        email: workspaceInvitations.email,
        role: workspaceInvitations.role,
        expiresAt: workspaceInvitations.expiresAt,
      });

    return { invitation: created!, inviteToken: rawToken };
  });
}

export async function acceptSpaceInvitation(userId: string, rawToken: string) {
  const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
  return withUserRls(userId, async (tx) => {
    const [inv] = await tx
      .select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.tokenHash, tokenHash))
      .limit(1);

    if (!inv || inv.status !== "pending" || inv.expiresAt < new Date()) {
      throw new SpaceServiceError(400, "INVALID_INVITE", "Invitation is invalid, revoked, or expired");
    }

    await tx
      .insert(workspaceMembers)
      .values({
        workspaceId: inv.workspaceId,
        userId,
        role: inv.role,
      })
      .onConflictDoNothing();

    await tx
      .update(workspaceInvitations)
      .set({ status: "accepted" })
      .where(eq(workspaceInvitations.id, inv.id));

    return { workspaceId: inv.workspaceId, role: inv.role };
  });
}

export async function revokeSpaceInvitation(
  userId: string,
  workspaceId: string,
  invitationId: string
) {
  const myRole = await getMemberRole(userId, workspaceId);
  if (!hasRequiredRole(myRole, "admin")) {
    throw new SpaceServiceError(403, "FORBIDDEN", "Only admins or owners can revoke invitations");
  }
  return withUserRls(userId, async (tx) => {
    await tx
      .update(workspaceInvitations)
      .set({ status: "revoked" })
      .where(
        and(
          eq(workspaceInvitations.id, invitationId),
          eq(workspaceInvitations.workspaceId, workspaceId)
        )
      );
    return { revoked: true };
  });
}

export async function removeSpaceMember(
  userId: string,
  workspaceId: string,
  targetUserId: string
) {
  const myRole = await getMemberRole(userId, workspaceId);
  if (!hasRequiredRole(myRole, "admin")) {
    throw new SpaceServiceError(403, "FORBIDDEN", "Only admins or owners can remove members");
  }
  return withUserRls(userId, async (tx) => {
    const [ws] = await tx
      .select({ ownerId: workspaces.ownerId })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (ws?.ownerId === targetUserId) {
      throw new SpaceServiceError(400, "CANNOT_REMOVE_OWNER", "Cannot remove the space owner");
    }
    await tx
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, targetUserId)
        )
      );
    return { removed: true };
  });
}

export async function moveResourceToSpace(
  userId: string,
  input: {
    entityType: "note" | "task" | "project";
    entityId: string;
    targetWorkspaceId: string;
  }
) {
  const targetRole = await getMemberRole(userId, input.targetWorkspaceId);
  if (!hasRequiredRole(targetRole, "editor")) {
    throw new SpaceServiceError(403, "FORBIDDEN", "Editor role required in target space");
  }

  return withUserRls(userId, async (tx) => {
    if (input.entityType === "note") {
      const [updated] = await tx
        .update(notes)
        .set({ workspaceId: input.targetWorkspaceId, updatedAt: new Date() })
        .where(and(eq(notes.id, input.entityId), eq(notes.userId, userId)))
        .returning({ id: notes.id });
      if (!updated) throw new SpaceServiceError(404, "NOT_FOUND", "Note not found");
      return updated;
    }
    if (input.entityType === "task") {
      const [updated] = await tx
        .update(tasks)
        .set({ workspaceId: input.targetWorkspaceId, updatedAt: new Date() })
        .where(and(eq(tasks.id, input.entityId), eq(tasks.userId, userId)))
        .returning({ id: tasks.id });
      if (!updated) throw new SpaceServiceError(404, "NOT_FOUND", "Task not found");
      return updated;
    }
    const [updated] = await tx
      .update(projects)
      .set({ workspaceId: input.targetWorkspaceId, updatedAt: new Date() })
      .where(and(eq(projects.id, input.entityId), eq(projects.userId, userId)))
      .returning({ id: projects.id });
    if (!updated) throw new SpaceServiceError(404, "NOT_FOUND", "Project not found");
    return updated;
  });
}
