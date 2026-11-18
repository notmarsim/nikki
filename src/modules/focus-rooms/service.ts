import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import { focusRoomMembers, focusRooms, users } from "@/db/schema";

export async function listFocusRooms(userId: string) {
  return withUserRls(userId, async (tx) => {
    const memberships = await tx
      .select({ roomId: focusRoomMembers.roomId })
      .from(focusRoomMembers)
      .where(eq(focusRoomMembers.userId, userId));

    const rooms = await tx
      .select()
      .from(focusRooms)
      .orderBy(desc(focusRooms.createdAt))
      .limit(30);

    const memberIds = new Set(memberships.map((m) => m.roomId));
    return rooms.filter((r) => r.creatorId === userId || memberIds.has(r.id));
  });
}

export async function createFocusRoom(
  userId: string,
  workspaceId: string,
  input: { name: string; description?: string | null; mode?: string; focusMinutes?: number }
) {
  const inviteCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  return withUserRls(userId, async (tx) => {
    const [room] = await tx
      .insert(focusRooms)
      .values({
        creatorId: userId,
        workspaceId,
        name: input.name,
        description: input.description ?? null,
        mode: input.mode ?? "synchronized",
        focusMinutes: input.focusMinutes ?? 25,
        inviteCode,
      })
      .returning();

    await tx.insert(focusRoomMembers).values({
      roomId: room!.id,
      userId,
      statusLabel: "Ready",
    });

    return room!;
  });
}

export async function joinFocusRoomByCode(userId: string, inviteCode: string) {
  return withUserRls(userId, async (tx) => {
    const [room] = await tx
      .select()
      .from(focusRooms)
      .where(eq(focusRooms.inviteCode, inviteCode.trim().toUpperCase()))
      .limit(1);
    if (!room) throw new Error("Focus room not found");

    await tx
      .insert(focusRoomMembers)
      .values({ roomId: room.id, userId, statusLabel: "Focusing" })
      .onConflictDoNothing();

    return room;
  });
}

export async function getFocusRoomDetails(userId: string, roomId: string) {
  return withUserRls(userId, async (tx) => {
    const [room] = await tx
      .select()
      .from(focusRooms)
      .where(eq(focusRooms.id, roomId))
      .limit(1);
    if (!room) throw new Error("Room not found");

    const members = await tx
      .select({
        id: focusRoomMembers.id,
        userId: focusRoomMembers.userId,
        name: users.name,
        hideActivity: focusRoomMembers.hideActivity,
        statusLabel: focusRoomMembers.statusLabel,
        lastSeenAt: focusRoomMembers.lastSeenAt,
      })
      .from(focusRoomMembers)
      .innerJoin(users, eq(focusRoomMembers.userId, users.id))
      .where(eq(focusRoomMembers.roomId, roomId));

    return {
      room,
      members: members.map((m) => ({
        ...m,
        statusLabel: m.hideActivity ? "Focusing (Private)" : m.statusLabel,
      })),
    };
  });
}

export async function updateFocusRoomState(
  userId: string,
  roomId: string,
  status: "idle" | "running" | "paused" | "break" | "ended"
) {
  return withUserRls(userId, async (tx) => {
    const [updated] = await tx
      .update(focusRooms)
      .set({
        status,
        ...(status === "running" || status === "break"
          ? { cycleStartedAt: new Date() }
          : {}),
      })
      .where(and(eq(focusRooms.id, roomId), eq(focusRooms.creatorId, userId)))
      .returning();
    if (!updated) throw new Error("Only the room creator can change room timer state");
    return updated;
  });
}
