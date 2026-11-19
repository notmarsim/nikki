import { and, asc, eq } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import { subscriptions } from "@/db/schema";

export function computeMonthlyEquivalentCents(amountCents: number, billingCycle: string): number {
  switch (billingCycle) {
    case "weekly":
      return Math.round((amountCents * 52) / 12);
    case "quarterly":
      return Math.round(amountCents / 3);
    case "yearly":
      return Math.round(amountCents / 12);
    case "monthly":
    default:
      return amountCents;
  }
}

export async function listSubscriptionsOverview(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    const rows = await tx
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.workspaceId, workspaceId)))
      .orderBy(asc(subscriptions.nextBillingDate));

    const activeOrTrial = rows.filter((r) => r.status === "active" || r.status === "trial");
    const monthlyTotalCents = activeOrTrial.reduce(
      (sum, r) => sum + computeMonthlyEquivalentCents(r.amountCents, r.billingCycle),
      0
    );
    const annualTotalCents = monthlyTotalCents * 12;

    const nowStr = new Date().toISOString().slice(0, 10);
    const inSevenDays = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const upcoming = activeOrTrial.filter(
      (r) => r.nextBillingDate >= nowStr && r.nextBillingDate <= inSevenDays
    );
    const possibleForgotten = rows.filter(
      (r) =>
        r.status === "active" &&
        !r.recurringRuleId &&
        r.billingCycle === "yearly"
    );

    return {
      subscriptions: rows.map((r) => ({
        ...r,
        monthlyEquivalentCents: computeMonthlyEquivalentCents(r.amountCents, r.billingCycle),
      })),
      monthlyTotalCents,
      annualTotalCents,
      upcomingCount: upcoming.length,
      possibleForgottenCount: possibleForgotten.length,
    };
  });
}

export async function createSubscription(
  userId: string,
  workspaceId: string,
  input: {
    name: string;
    category: string;
    amountCents: number;
    currency?: string;
    billingCycle: "weekly" | "monthly" | "quarterly" | "yearly";
    nextBillingDate: string;
    trialEndsAt?: string | null;
    status?: "active" | "trial" | "paused" | "cancelled";
    paymentLabel?: string | null;
    notes?: string | null;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(subscriptions)
      .values({
        userId,
        workspaceId,
        name: input.name,
        category: input.category,
        amountCents: input.amountCents,
        currency: input.currency ?? "BRL",
        billingCycle: input.billingCycle,
        nextBillingDate: input.nextBillingDate,
        renewalDate: input.nextBillingDate,
        trialEndsAt: input.trialEndsAt ?? null,
        status: input.status ?? (input.trialEndsAt ? "trial" : "active"),
        paymentLabel: input.paymentLabel ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    return created!;
  });
}

export async function updateSubscriptionStatus(
  userId: string,
  id: string,
  status: "active" | "trial" | "paused" | "cancelled"
) {
  return updateSubscription(userId, id, { status });
}

export async function updateSubscription(
  userId: string,
  id: string,
  patch: {
    status?: "active" | "trial" | "paused" | "cancelled";
    name?: string;
    category?: string;
    amountCents?: number;
    billingCycle?: "weekly" | "monthly" | "quarterly" | "yearly";
    nextBillingDate?: string;
  }
) {
  return withUserRls(userId, async (tx) => {
    const updateSet: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.status !== undefined) updateSet.status = patch.status;
    if (patch.name !== undefined) updateSet.name = patch.name;
    if (patch.category !== undefined) updateSet.category = patch.category;
    if (patch.amountCents !== undefined) updateSet.amountCents = patch.amountCents;
    if (patch.billingCycle !== undefined) updateSet.billingCycle = patch.billingCycle;
    if (patch.nextBillingDate !== undefined) {
      updateSet.nextBillingDate = patch.nextBillingDate;
      updateSet.renewalDate = patch.nextBillingDate;
    }

    const [updated] = await tx
      .update(subscriptions)
      .set(updateSet)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
      .returning();
    return updated ?? null;
  });
}

export async function deleteSubscription(userId: string, id: string) {
  return withUserRls(userId, async (tx) => {
    await tx.delete(subscriptions).where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)));
    return { deleted: true };
  });
}
