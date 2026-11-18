import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createCalendarEventSchema } from "@/modules/calendar/schemas";
import {
  CalendarServiceError,
  createCalendarEvent,
  listCalendarOccurrences,
} from "@/modules/calendar/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  const now = new Date();
  const rangeStart = startParam
    ? new Date(startParam)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeEnd = endParam
    ? new Date(endParam)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    return apiError(400, "INVALID_RANGE", "Invalid start or end date");
  }

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const occurrences = await listCalendarOccurrences(
    session.user.id,
    workspace.id,
    rangeStart,
    rangeEnd
  );

  return apiOk({ occurrences });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createCalendarEventSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid event payload", parsed.error.flatten().fieldErrors);
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const event = await createCalendarEvent(session.user.id, workspace.id, parsed.data);
    return apiOk({ event }, 201);
  } catch (error) {
    if (error instanceof CalendarServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to create event");
  }
}
