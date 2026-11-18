import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { updateCalendarEventSchema } from "@/modules/calendar/schemas";
import {
  CalendarServiceError,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "@/modules/calendar/service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = updateCalendarEventSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid event update", parsed.error.flatten().fieldErrors);
  }

  try {
    const event = await updateCalendarEvent(session.user.id, id, parsed.data);
    return apiOk({ event });
  } catch (error) {
    if (error instanceof CalendarServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to update event");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") === "single" ? "single" : "series";
  const originalOccurrence = searchParams.get("occurrence") ?? undefined;

  try {
    await deleteCalendarEvent(session.user.id, id, { scope, originalOccurrence });
    return apiOk({ deleted: true });
  } catch (error) {
    if (error instanceof CalendarServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to delete event");
  }
}
