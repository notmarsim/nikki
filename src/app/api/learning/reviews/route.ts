import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  getReviewQueueOverview,
  scheduleOrGetLearningReview,
  submitLearningReview,
  togglePauseLearningReview,
} from "@/modules/learning/integration-service";
import { LearningServiceError } from "@/modules/learning/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("schedule"),
    entityType: z.enum(["note", "lesson", "concept"]),
    entityId: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
  }),
  z.object({
    action: z.literal("rate"),
    reviewId: z.string().uuid(),
    rating: z.enum(["again", "hard", "good", "easy"]),
  }),
  z.object({
    action: z.literal("pause"),
    reviewId: z.string().uuid(),
    paused: z.boolean(),
  }),
]);

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const queue = await getReviewQueueOverview(session.user.id, workspace.id);
  return apiOk(queue);
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid review payload");
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    if (parsed.data.action === "schedule") {
      const review = await scheduleOrGetLearningReview(
        session.user.id,
        workspace.id,
        parsed.data
      );
      return apiOk({ review }, 201);
    }
    if (parsed.data.action === "rate") {
      const review = await submitLearningReview(
        session.user.id,
        parsed.data.reviewId,
        parsed.data.rating
      );
      return apiOk({ review });
    }
    const review = await togglePauseLearningReview(
      session.user.id,
      parsed.data.reviewId,
      parsed.data.paused
    );
    return apiOk({ review });
  } catch (err) {
    if (err instanceof LearningServiceError) {
      return apiError(err.status, err.code, err.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to process review");
  }
}
