import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  createManualPlannerBlock,
  deleteDayPlannerBlock,
  generateDayPlanForUser,
  getDayPlanOverview,
  updateDayPlannerBlock,
} from "@/modules/day-planner/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    workStartMinute: z.number().int().min(0).max(1435).optional(),
    workEndMinute: z.number().int().min(60).max(1440).optional(),
  }),
  z.object({
    action: z.literal("manual"),
    planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string().trim().min(1).max(120),
    sourceType: z.enum(["custom", "blocked"]),
    startMinute: z.number().int().min(0).max(1425),
    endMinute: z.number().int().min(15).max(1440),
  }),
  z.object({
    action: z.literal("update"),
    blockId: z.string().uuid(),
    startMinute: z.number().int().min(0).max(1425).optional(),
    endMinute: z.number().int().min(15).max(1440).optional(),
    status: z.enum(["suggested", "accepted", "completed", "skipped"]).optional(),
  }),
]);

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const planDate =
    new URL(request.url).searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await getDayPlanOverview(session.user.id, workspace.id, planDate);
  return apiOk(data);
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Invalid day planner payload");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const d = parsed.data;

  if (d.action === "generate") {
    const res = await generateDayPlanForUser(session.user.id, workspace.id, d.planDate, {
      workStartMinute: d.workStartMinute,
      workEndMinute: d.workEndMinute,
    });
    return apiOk(res);
  }
  if (d.action === "manual") {
    const block = await createManualPlannerBlock(session.user.id, workspace.id, d);
    return apiOk({ block }, 201);
  }
  const block = await updateDayPlannerBlock(session.user.id, d.blockId, {
    startMinute: d.startMinute,
    endMinute: d.endMinute,
    status: d.status,
  });
  return apiOk({ block });
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError(400, "VALIDATION_ERROR", "id required");

  return apiOk(await deleteDayPlannerBlock(session.user.id, id));
}
