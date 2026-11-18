import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  createLifeArea,
  createLifeGoal,
  deleteLifeGoal,
  getGoalsOverview,
  updateLifeGoalProgress,
} from "@/modules/goals/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const postSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("area"),
    name: z.string().trim().min(1).max(80),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  }),
  z.object({
    kind: z.literal("goal"),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(500).nullable().optional(),
    areaId: z.string().uuid().nullable().optional(),
    parentGoalId: z.string().uuid().nullable().optional(),
    horizon: z.string().optional(),
    metricSource: z.string().optional(),
    targetValue: z.number().int().min(1).optional(),
    unit: z.string().max(20).optional(),
    targetDate: z.string().nullable().optional(),
  }),
]);

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await getGoalsOverview(session.user.id, workspace.id);
  return apiOk(data);
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid goal payload");
  }

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  if (parsed.data.kind === "area") {
    const area = await createLifeArea(session.user.id, workspace.id, parsed.data);
    return apiOk({ area }, 201);
  }
  const goal = await createLifeGoal(session.user.id, workspace.id, parsed.data);
  return apiOk({ goal }, 201);
}

export async function PATCH(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body = (await request.json()) as { id?: string; currentValue?: number };
  if (!body.id || typeof body.currentValue !== "number") {
    return apiError(400, "VALIDATION_ERROR", "id and currentValue required");
  }
  const goal = await updateLifeGoalProgress(session.user.id, body.id, body.currentValue);
  return apiOk({ goal });
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError(400, "VALIDATION_ERROR", "id required");
  const res = await deleteLifeGoal(session.user.id, id);
  return apiOk(res);
}
