import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { scheduleTaskBlockSchema } from "@/modules/calendar/schemas";
import {
  CalendarServiceError,
  scheduleTaskOnCalendar,
} from "@/modules/calendar/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = scheduleTaskBlockSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid schedule payload", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const event = await scheduleTaskOnCalendar(
      session.user.id,
      workspace.id,
      parsed.data
    );
    return apiOk({ event }, 201);
  } catch (error) {
    if (error instanceof CalendarServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to schedule task");
  }
}
