import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { logHabitEntrySchema } from "@/modules/habits/schemas";
import { HabitServiceError, logHabitEntry } from "@/modules/habits/service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = logHabitEntrySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid habit entry", parsed.error.flatten().fieldErrors);
  }

  try {
    const entry = await logHabitEntry(session.user.id, id, parsed.data);
    return apiOk({ entry }, 201);
  } catch (error) {
    if (error instanceof HabitServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to log entry");
  }
}
