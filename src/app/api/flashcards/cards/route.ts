import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createFlashcardSchema } from "@/modules/flashcards/schemas";
import {
  createFlashcard,
  FlashcardServiceError,
} from "@/modules/flashcards/service";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createFlashcardSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid flashcard", parsed.error.flatten().fieldErrors);
  }

  try {
    const result = await createFlashcard(session.user.id, parsed.data);
    return apiOk(result, 201);
  } catch (error) {
    if (error instanceof FlashcardServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to create flashcard");
  }
}
