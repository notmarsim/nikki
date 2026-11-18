import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  FlashcardServiceError,
  getDeckCardsAndDue,
} from "@/modules/flashcards/service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { id } = await context.params;
  try {
    const data = await getDeckCardsAndDue(session.user.id, id);
    return apiOk(data);
  } catch (error) {
    if (error instanceof FlashcardServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to load deck");
  }
}
