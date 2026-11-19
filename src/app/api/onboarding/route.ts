import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  getContextualSuggestions,
  getOnboardingState,
  updateOnboardingState,
} from "@/modules/onboarding/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const patchSchema = z.object({
  welcomeCompleted: z.boolean().optional(),
  tourStatus: z.enum(["not_started", "in_progress", "completed", "skipped"]).optional(),
  currentTourId: z.string().nullable().optional(),
  currentStepIndex: z.number().int().min(0).optional(),
  completeTourId: z.string().optional(),
  dismissTourId: z.string().optional(),
  dismissSuggestionId: z.string().optional(),
  resetInitialTour: z.boolean().optional(),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const state = await getOnboardingState(session.user.id);
  const suggestions = await getContextualSuggestions(
    session.user.id,
    workspace.id,
    state.dismissedSuggestions
  );

  return apiOk({ state, suggestions });
}

export async function PATCH(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Invalid onboarding payload");

  const state = await updateOnboardingState(session.user.id, parsed.data);
  return apiOk({ state });
}
