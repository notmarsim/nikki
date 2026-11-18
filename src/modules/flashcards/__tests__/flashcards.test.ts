import { describe, expect, it } from "vitest";
import { parseClozeCards, scheduleNextFsrs } from "../fsrs";

describe("flashcards FSRS & cloze", () => {
  it("generates separate cards for multiple cloze occlusions", () => {
    const cards = parseClozeCards(
      "The {{c1::CPU}} executes instructions from {{c2::RAM}}."
    );
    expect(cards).toHaveLength(2);
    expect(cards[0]?.front).toBe("The [...] executes instructions from RAM.");
    expect(cards[0]?.back).toBe("The CPU executes instructions from RAM.");
    expect(cards[1]?.front).toBe("The CPU executes instructions from [...].");
  });

  it("schedules next FSRS review and updates stability & reps", () => {
    const now = new Date("2026-11-18T12:00:00.000Z");
    const first = scheduleNextFsrs(
      {
        fsrsState: 0,
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        dueAt: now,
        lastReviewAt: null,
      },
      3, // Good
      now
    );

    expect(first.previousState).toBe(0);
    expect(first.nextCard.reps).toBe(1);
    expect(first.nextCard.due.getTime()).toBeGreaterThan(now.getTime());

    const second = scheduleNextFsrs(
      {
        fsrsState: first.nextCard.state,
        stability: first.nextCard.stability,
        difficulty: first.nextCard.difficulty,
        elapsedDays: first.nextCard.elapsed_days,
        scheduledDays: first.nextCard.scheduled_days,
        reps: first.nextCard.reps,
        lapses: first.nextCard.lapses,
        dueAt: first.nextCard.due,
        lastReviewAt: now,
      },
      1, // Again -> lapse/relearning
      first.nextCard.due
    );

    expect(second.nextCard.reps).toBe(2);
  });
});
