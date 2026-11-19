import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  createSubscription,
  deleteSubscription,
  listSubscriptionsOverview,
  updateSubscription,
} from "@/modules/subscriptions/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const postSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(60).default(""),
  amountCents: z.number().int().positive(),
  currency: z.string().trim().max(10).default("BRL"),
  billingCycle: z.enum(["weekly", "monthly", "quarterly", "yearly"]).default("monthly"),
  nextBillingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  trialEndsAt: z.string().nullable().optional(),
  paymentLabel: z.string().max(60).nullable().optional(),
  notes: z.string().max(400).nullable().optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "trial", "paused", "cancelled"]).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().max(60).optional(),
  amountCents: z.number().int().positive().optional(),
  billingCycle: z.enum(["weekly", "monthly", "quarterly", "yearly"]).optional(),
  nextBillingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await listSubscriptionsOverview(session.user.id, workspace.id);
  return apiOk(data);
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Invalid subscription payload");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const subscription = await createSubscription(session.user.id, workspace.id, parsed.data);
  return apiOk({ subscription }, 201);
}

export async function PATCH(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Invalid subscription update");

  const subscription = await updateSubscription(session.user.id, parsed.data.id, parsed.data);
  return apiOk({ subscription });
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError(400, "VALIDATION_ERROR", "id required");

  return apiOk(await deleteSubscription(session.user.id, id));
}
