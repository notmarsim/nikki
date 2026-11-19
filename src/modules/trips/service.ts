import { asc, desc, eq } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  calendarEvents,
  tripBookings,
  tripChecklistItems,
  tripItineraryItems,
  trips,
} from "@/db/schema";

export async function listTripsOverview(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    const [tripRows, itineraryRows, checklistRows, bookingRows] = await Promise.all([
      tx
        .select()
        .from(trips)
        .where(eq(trips.workspaceId, workspaceId))
        .orderBy(asc(trips.startDate)),
      tx
        .select()
        .from(tripItineraryItems)
        .where(eq(tripItineraryItems.userId, userId))
        .orderBy(asc(tripItineraryItems.dayNumber), asc(tripItineraryItems.startTime)),
      tx.select().from(tripChecklistItems).where(eq(tripChecklistItems.userId, userId)),
      tx.select().from(tripBookings).where(eq(tripBookings.userId, userId)),
    ]);

    return {
      trips: tripRows,
      itinerary: itineraryRows,
      checklist: checklistRows,
      bookings: bookingRows,
    };
  });
}

export async function createTrip(
  userId: string,
  workspaceId: string,
  input: {
    name: string;
    destination: string;
    startDate: string;
    endDate: string;
    description?: string | null;
    budgetCents?: number;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(trips)
      .values({
        userId,
        workspaceId,
        name: input.name,
        destination: input.destination,
        startDate: input.startDate,
        endDate: input.endDate,
        description: input.description ?? null,
        budgetCents: Math.max(0, input.budgetCents ?? 0),
      })
      .returning();
    return created!;
  });
}

export async function addTripItineraryItem(
  userId: string,
  workspaceId: string,
  input: {
    tripId: string;
    dayNumber: number;
    itemDate: string;
    startTime: string;
    title: string;
    location?: string | null;
    durationMinutes?: number;
    estimatedCostCents?: number;
    syncToCalendar?: boolean;
  }
) {
  return withUserRls(userId, async (tx) => {
    let calendarEventId: string | null = null;
    if (input.syncToCalendar) {
      const startsAt = new Date(`${input.itemDate}T${input.startTime}:00`);
      const endsAt = new Date(startsAt.getTime() + (input.durationMinutes ?? 60) * 60_000);
      const [evt] = await tx
        .insert(calendarEvents)
        .values({
          userId,
          workspaceId,
          title: `Trip: ${input.title}`,
          location: input.location ?? null,
          startsAt,
          endsAt,
          category: "trip",
          color: "#0ea5e9",
        })
        .returning();
      calendarEventId = evt?.id ?? null;
    }

    const [created] = await tx
      .insert(tripItineraryItems)
      .values({
        userId,
        tripId: input.tripId,
        dayNumber: input.dayNumber,
        itemDate: input.itemDate,
        startTime: input.startTime,
        title: input.title,
        location: input.location ?? null,
        durationMinutes: input.durationMinutes ?? 60,
        estimatedCostCents: Math.max(0, input.estimatedCostCents ?? 0),
        calendarEventId,
      })
      .returning();
    return created!;
  });
}

export async function addTripChecklistItem(
  userId: string,
  input: { tripId: string; kind: "packing" | "prep"; title: string }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(tripChecklistItems)
      .values({
        userId,
        tripId: input.tripId,
        kind: input.kind,
        title: input.title,
      })
      .returning();
    return created!;
  });
}

export async function toggleTripChecklistItem(userId: string, id: string, isChecked: boolean) {
  return withUserRls(userId, async (tx) => {
    const [updated] = await tx
      .update(tripChecklistItems)
      .set({ isChecked })
      .where(eq(tripChecklistItems.id, id))
      .returning();
    return updated ?? null;
  });
}

export async function addTripBooking(
  userId: string,
  input: {
    tripId: string;
    kind: "flight" | "hotel" | "transport" | "activity" | "other";
    provider: string;
    referenceCode?: string | null;
    costCents?: number;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(tripBookings)
      .values({
        userId,
        tripId: input.tripId,
        kind: input.kind,
        provider: input.provider,
        referenceCode: input.referenceCode ?? null,
        costCents: Math.max(0, input.costCents ?? 0),
      })
      .returning();
    return created!;
  });
}

export async function deleteTrip(userId: string, tripId: string) {
  return withUserRls(userId, async (tx) => {
    await tx.delete(trips).where(eq(trips.id, tripId));
    return { deleted: true };
  });
}
