import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  flashcardDecks,
  flashcardNotes,
  flashcardReviews,
  flashcards,
} from "@/db/schema";
import {
  FSRS_ALGORITHM_VERSION,
  parseClozeCards,
  scheduleNextFsrs,
} from "./fsrs";

export class FlashcardServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export async function getFlashcardsOverview(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [decks, cards, todayReviews] = await Promise.all([
      tx
        .select()
        .from(flashcardDecks)
        .where(
          and(
            eq(flashcardDecks.userId, userId),
            eq(flashcardDecks.workspaceId, workspaceId)
          )
        )
        .orderBy(desc(flashcardDecks.updatedAt)),
      tx.select().from(flashcards).where(eq(flashcards.userId, userId)),
      tx
        .select()
        .from(flashcardReviews)
        .where(
          and(
            eq(flashcardReviews.userId, userId),
            gte(flashcardReviews.reviewedAt, startOfToday)
          )
        ),
    ]);

    const decksWithStats = decks.map((d) => {
      const dCards = cards.filter((c) => c.deckId === d.id);
      const dueCount = dCards.filter((c) => c.dueAt <= now).length;
      const newCount = dCards.filter((c) => c.fsrsState === 0).length;
      return {
        ...d,
        totalCards: dCards.length,
        dueCount,
        newCount,
      };
    });

    const totalDue = cards.filter((c) => c.dueAt <= now).length;
    const totalNew = cards.filter((c) => c.fsrsState === 0).length;
    const reviewedToday = todayReviews.length;
    const passedToday = todayReviews.filter((r) => r.rating >= 2).length;
    const retentionRate =
      reviewedToday > 0 ? Math.round((passedToday / reviewedToday) * 100) : null;

    return {
      decks: decksWithStats,
      stats: {
        totalCards: cards.length,
        totalDue,
        totalNew,
        reviewedToday,
        retentionRate,
      },
    };
  });
}

export async function getDeckCardsAndDue(userId: string, deckId: string) {
  return withUserRls(userId, async (tx) => {
    const deckRows = await tx
      .select()
      .from(flashcardDecks)
      .where(and(eq(flashcardDecks.id, deckId), eq(flashcardDecks.userId, userId)))
      .limit(1);

    if (!deckRows[0]) {
      throw new FlashcardServiceError(404, "DECK_NOT_FOUND", "Deck not found");
    }

    const now = new Date();
    const [allCards, dueCards] = await Promise.all([
      tx
        .select()
        .from(flashcards)
        .where(and(eq(flashcards.deckId, deckId), eq(flashcards.userId, userId)))
        .orderBy(desc(flashcards.createdAt)),
      tx
        .select()
        .from(flashcards)
        .where(
          and(
            eq(flashcards.deckId, deckId),
            eq(flashcards.userId, userId),
            lte(flashcards.dueAt, now)
          )
        )
        .orderBy(asc(flashcards.dueAt))
        .limit(50),
    ]);

    return { deck: deckRows[0], allCards, dueCards };
  });
}

export async function createDeck(
  userId: string,
  workspaceId: string,
  input: {
    title: string;
    description?: string | null;
    courseId?: string | null;
    moduleId?: string | null;
    tags?: string[];
  }
) {
  return withUserRls(userId, async (tx) => {
    const [deck] = await tx
      .insert(flashcardDecks)
      .values({
        userId,
        workspaceId,
        title: input.title,
        description: input.description ?? null,
        courseId: input.courseId ?? null,
        moduleId: input.moduleId ?? null,
        tags: input.tags ?? [],
      })
      .returning();
    return deck!;
  });
}

export async function createFlashcard(
  userId: string,
  input: {
    deckId: string;
    noteType: "basic" | "basic_reversed" | "cloze";
    front: string;
    back: string;
    clozeText?: string | null;
    tags?: string[];
    sourceNoteId?: string | null;
    courseId?: string | null;
  }
) {
  return withUserRls(userId, async (tx) => {
    const deckRow = await tx
      .select({ id: flashcardDecks.id })
      .from(flashcardDecks)
      .where(and(eq(flashcardDecks.id, input.deckId), eq(flashcardDecks.userId, userId)))
      .limit(1);
    if (!deckRow[0]) {
      throw new FlashcardServiceError(404, "DECK_NOT_FOUND", "Deck not found");
    }

    const [note] = await tx
      .insert(flashcardNotes)
      .values({
        userId,
        noteType: input.noteType,
        front: input.front,
        back: input.back,
        clozeText: input.clozeText ?? null,
        tags: input.tags ?? [],
        sourceNoteId: input.sourceNoteId ?? null,
        courseId: input.courseId ?? null,
      })
      .returning();

    if (!note) {
      throw new FlashcardServiceError(500, "CREATE_FAILED", "Failed to create card note");
    }

    const cardsToInsert: Array<{ templateKey: string; front: string; back: string }> = [];
    if (input.noteType === "cloze") {
      const rendered = parseClozeCards(input.clozeText || input.front);
      cardsToInsert.push(...rendered);
    } else if (input.noteType === "basic_reversed") {
      cardsToInsert.push({ templateKey: "forward", front: input.front, back: input.back });
      cardsToInsert.push({ templateKey: "reverse", front: input.back, back: input.front });
    } else {
      cardsToInsert.push({ templateKey: "forward", front: input.front, back: input.back });
    }

    const createdCards = await tx
      .insert(flashcards)
      .values(
        cardsToInsert.map((c) => ({
          userId,
          deckId: input.deckId,
          flashcardNoteId: note.id,
          templateKey: c.templateKey,
          front: c.front,
          back: c.back,
        }))
      )
      .returning();

    return { note, cards: createdCards };
  });
}

export async function reviewFlashcard(
  userId: string,
  cardId: string,
  input: { rating: 1 | 2 | 3 | 4; reviewRequestId: string }
) {
  return withUserRls(userId, async (tx) => {
    // Idempotency guard against double-clicks or retries
    const existingReview = await tx
      .select()
      .from(flashcardReviews)
      .where(
        and(
          eq(flashcardReviews.reviewRequestId, input.reviewRequestId),
          eq(flashcardReviews.userId, userId)
        )
      )
      .limit(1);

    const cardRows = await tx
      .select()
      .from(flashcards)
      .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, userId)))
      .limit(1);

    const card = cardRows[0];
    if (!card) {
      throw new FlashcardServiceError(404, "CARD_NOT_FOUND", "Flashcard not found");
    }

    if (existingReview[0]) {
      return { card, review: existingReview[0], deduplicated: true };
    }

    const now = new Date();
    const { previousState, nextCard, log } = scheduleNextFsrs(
      {
        fsrsState: card.fsrsState,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsedDays: card.elapsedDays,
        scheduledDays: card.scheduledDays,
        reps: card.reps,
        lapses: card.lapses,
        dueAt: card.dueAt,
        lastReviewAt: card.lastReviewAt,
      },
      input.rating,
      now
    );

    const [updatedCard] = await tx
      .update(flashcards)
      .set({
        fsrsState: nextCard.state,
        stability: nextCard.stability,
        difficulty: nextCard.difficulty,
        elapsedDays: nextCard.elapsed_days,
        scheduledDays: nextCard.scheduled_days,
        reps: nextCard.reps,
        lapses: nextCard.lapses,
        dueAt: nextCard.due,
        lastReviewAt: now,
        updatedAt: now,
      })
      .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, userId)))
      .returning();

    const [review] = await tx
      .insert(flashcardReviews)
      .values({
        userId,
        cardId,
        reviewRequestId: input.reviewRequestId,
        rating: input.rating,
        previousState,
        nextState: nextCard.state,
        elapsedDays: log.elapsed_days,
        scheduledDays: log.scheduled_days,
        algorithmVersion: FSRS_ALGORITHM_VERSION,
        reviewedAt: now,
      })
      .returning();

    return { card: updatedCard!, review: review!, deduplicated: false };
  });
}

export async function deleteFlashcard(userId: string, cardId: string) {
  await withUserRls(userId, async (tx) => {
    const existing = await tx
      .select({ id: flashcards.id })
      .from(flashcards)
      .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, userId)))
      .limit(1);
    if (!existing[0]) {
      throw new FlashcardServiceError(404, "CARD_NOT_FOUND", "Flashcard not found");
    }
    await tx
      .delete(flashcards)
      .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, userId)));
  });
}
