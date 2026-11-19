import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  addTripBooking,
  addTripChecklistItem,
  addTripItineraryItem,
  createTrip,
  deleteTrip,
  listTripsOverview,
  toggleTripChecklistItem,
} from "@/modules/trips/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_trip"),
    name: z.string().trim().min(1).max(120),
    destination: z.string().trim().min(1).max(120),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string().max(400).nullable().optional(),
    budgetCents: z.number().int().min(0).optional(),
  }),
  z.object({
    action: z.literal("add_itinerary"),
    tripId: z.string().uuid(),
    dayNumber: z.number().int().min(1).max(90),
    itemDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
    title: z.string().trim().min(1).max(120),
    location: z.string().max(120).nullable().optional(),
    durationMinutes: z.number().int().min(15).max(720).optional(),
    estimatedCostCents: z.number().int().min(0).optional(),
    syncToCalendar: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("add_checklist"),
    tripId: z.string().uuid(),
    kind: z.enum(["packing", "prep"]),
    title: z.string().trim().min(1).max(120),
  }),
  z.object({
    action: z.literal("toggle_checklist"),
    id: z.string().uuid(),
    isChecked: z.boolean(),
  }),
  z.object({
    action: z.literal("add_booking"),
    tripId: z.string().uuid(),
    kind: z.enum(["flight", "hotel", "transport", "activity", "other"]),
    provider: z.string().trim().min(1).max(120),
    referenceCode: z.string().max(60).nullable().optional(),
    costCents: z.number().int().min(0).optional(),
  }),
]);

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await listTripsOverview(session.user.id, workspace.id);
  return apiOk(data);
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Invalid trip payload");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const d = parsed.data;

  switch (d.action) {
    case "create_trip":
      return apiOk({ trip: await createTrip(session.user.id, workspace.id, d) }, 201);
    case "add_itinerary":
      return apiOk({ item: await addTripItineraryItem(session.user.id, workspace.id, d) }, 201);
    case "add_checklist":
      return apiOk({ item: await addTripChecklistItem(session.user.id, d) }, 201);
    case "toggle_checklist":
      return apiOk({ item: await toggleTripChecklistItem(session.user.id, d.id, d.isChecked) });
    case "add_booking":
      return apiOk({ booking: await addTripBooking(session.user.id, d) }, 201);
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError(400, "VALIDATION_ERROR", "id required");

  return apiOk(await deleteTrip(session.user.id, id));
}
