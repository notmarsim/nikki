import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  acceptSpaceInvitation,
  createSpaceInvitation,
  revokeSpaceInvitation,
  SpaceServiceError,
} from "@/modules/spaces/service";

const inviteSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]).default("editor"),
});

const acceptSchema = z.object({
  token: z.string().min(10),
});

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  if (typeof body === "object" && body !== null && "token" in body) {
    const parsedAccept = acceptSchema.safeParse(body);
    if (!parsedAccept.success) {
      return apiError(400, "VALIDATION_ERROR", "Invalid token");
    }
    try {
      const joined = await acceptSpaceInvitation(session.user.id, parsedAccept.data.token);
      return apiOk(joined);
    } catch (error) {
      if (error instanceof SpaceServiceError) {
        return apiError(error.status, error.code, error.message);
      }
      return apiError(500, "INTERNAL_ERROR", "Failed to accept invitation");
    }
  }

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid invitation", parsed.error.flatten().fieldErrors);
  }

  try {
    const res = await createSpaceInvitation(session.user.id, parsed.data.workspaceId, {
      email: parsed.data.email,
      role: parsed.data.role,
    });
    return apiOk(res, 201);
  } catch (error) {
    if (error instanceof SpaceServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to create invitation");
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const invitationId = searchParams.get("invitationId");
  if (!workspaceId || !invitationId) {
    return apiError(400, "VALIDATION_ERROR", "workspaceId and invitationId required");
  }

  try {
    const res = await revokeSpaceInvitation(session.user.id, workspaceId, invitationId);
    return apiOk(res);
  } catch (error) {
    if (error instanceof SpaceServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to revoke invitation");
  }
}
