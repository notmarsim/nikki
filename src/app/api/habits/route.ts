import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createHabitSchema } from "@/modules/habits/schemas";
import { createHabit, getHabitsOverview } from "@/modules/habits/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { searchParams } = new URL(request.url);
  const todayStr =
    searchParams.get("today") ?? new Date().toISOString().slice(0, 10);

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await getHabitsOverview(session.user.id, workspace.id, todayStr);
  return apiOk(data);
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createHabitSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid habit", parsed.error.flatten().fieldErrors);
  }

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const habit = await createHabit(session.user.id, workspace.id, parsed.data);
  return apiOk({ habit }, 201);
}
