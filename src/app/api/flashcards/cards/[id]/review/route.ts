import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { reviewFlashcardSchema } from "@/modules/flashcards/schemas";
import {
  FlashcardServiceError,
  reviewFlashcard,
} from "@/modules/flashcards/service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  const body: unknown = await request.json();
  const parsed = reviewFlashcardSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid review", parsed.error.flatten().fieldErrors);
  }

  try {
    const result = await reviewFlashcard(session.user.id, id, parsed.data);
    return apiOk(result);
  } catch (error) {
    if (error instanceof FlashcardServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to submit review");
  }
}
