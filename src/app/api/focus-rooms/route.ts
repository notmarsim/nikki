import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  createFocusRoom,
  getFocusRoomDetails,
  joinFocusRoomByCode,
  listFocusRooms,
  updateFocusRoomState,
} from "@/modules/focus-rooms/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(300).nullable().optional(),
    mode: z.enum(["synchronized", "independent"]).default("synchronized"),
    focusMinutes: z.number().int().min(5).max(120).default(25),
  }),
  z.object({
    action: z.literal("join"),
    inviteCode: z.string().trim().min(4).max(20),
  }),
  z.object({
    action: z.literal("state"),
    roomId: z.string().uuid(),
    status: z.enum(["idle", "running", "paused", "break", "ended"]),
  }),
]);

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const roomId = new URL(request.url).searchParams.get("roomId");
  if (roomId) {
    try {
      const details = await getFocusRoomDetails(session.user.id, roomId);
      return apiOk(details);
    } catch {
      return apiError(404, "NOT_FOUND", "Focus room not found");
    }
  }

  const rooms = await listFocusRooms(session.user.id);
  return apiOk({ rooms });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid focus room action");
  }

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  if (parsed.data.action === "create") {
    const room = await createFocusRoom(session.user.id, workspace.id, parsed.data);
    return apiOk({ room }, 201);
  }
  if (parsed.data.action === "join") {
    try {
      const room = await joinFocusRoomByCode(session.user.id, parsed.data.inviteCode);
      return apiOk({ room });
    } catch (error) {
      return apiError(404, "ROOM_NOT_FOUND", (error as Error).message);
    }
  }
  try {
    const room = await updateFocusRoomState(
      session.user.id,
      parsed.data.roomId,
      parsed.data.status
    );
    return apiOk({ room });
  } catch (error) {
    return apiError(403, "FORBIDDEN", (error as Error).message);
  }
}
