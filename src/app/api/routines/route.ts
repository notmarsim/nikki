import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  createRoutine,
  deleteRoutine,
  duplicateRoutine,
  listRoutines,
  startOrAdvanceRoutineRun,
  toggleRoutinePause,
} from "@/modules/routines/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(400).nullable().optional(),
    scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    recurrenceDays: z.array(z.string()).optional(),
    isTemplate: z.boolean().optional(),
    steps: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(120),
          durationMinutes: z.number().int().min(1).max(240),
          linkedHabitId: z.string().uuid().nullable().optional(),
          linkedTaskId: z.string().uuid().nullable().optional(),
        })
      )
      .min(1)
      .max(30),
  }),
  z.object({ action: z.literal("duplicate"), routineId: z.string().uuid() }),
  z.object({ action: z.literal("pause"), routineId: z.string().uuid(), isPaused: z.boolean() }),
  z.object({
    action: z.literal("run"),
    runAction: z.enum(["start", "step", "finish", "cancel"]),
    routineId: z.string().uuid(),
    runId: z.string().uuid().optional(),
    stepId: z.string().uuid().optional(),
    stepResult: z.enum(["completed", "skipped"]).optional(),
  }),
]);

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const items = await listRoutines(session.user.id, workspace.id);
  return apiOk({ routines: items });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Invalid routine payload");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const d = parsed.data;

  if (d.action === "create") {
    const routine = await createRoutine(session.user.id, workspace.id, d);
    return apiOk({ routine }, 201);
  }
  if (d.action === "duplicate") {
    const routine = await duplicateRoutine(session.user.id, workspace.id, d.routineId);
    return apiOk({ routine }, 201);
  }
  if (d.action === "pause") {
    const routine = await toggleRoutinePause(session.user.id, d.routineId, d.isPaused);
    return apiOk({ routine });
  }
  const run = await startOrAdvanceRoutineRun(session.user.id, {
    action: d.runAction,
    routineId: d.routineId,
    runId: d.runId,
    stepId: d.stepId,
    stepResult: d.stepResult,
  });
  return apiOk({ run });
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError(400, "VALIDATION_ERROR", "id required");

  return apiOk(await deleteRoutine(session.user.id, id));
}
