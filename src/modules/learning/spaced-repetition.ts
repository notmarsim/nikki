export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface ReviewScheduleInput {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}

export interface ReviewScheduleResult extends ReviewScheduleInput {
  dueAt: Date;
}

/**
 * Pure SM-2 spaced repetition calculation for Notes, Lessons, and Concepts.
 */
export function computeNextReviewSchedule(
  current: ReviewScheduleInput,
  rating: ReviewRating,
  now = new Date()
): ReviewScheduleResult {
  let ease = Math.max(1.3, current.easeFactor || 2.5);
  let reps = current.repetitions || 0;
  let interval = current.intervalDays || 1;
  let lapses = current.lapses || 0;

  if (rating === "again") {
    reps = 0;
    interval = 1;
    lapses += 1;
    ease = Math.max(1.3, ease - 0.2);
  } else if (rating === "hard") {
    reps += 1;
    interval = reps === 1 ? 1 : Math.max(1, Math.round(interval * 1.2));
    ease = Math.max(1.3, ease - 0.15);
  } else if (rating === "good") {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.max(1, Math.round(interval * ease));
  } else {
    // easy
    reps += 1;
    if (reps === 1) interval = 4;
    else if (reps === 2) interval = 10;
    else interval = Math.max(2, Math.round(interval * ease * 1.3));
    ease = Math.min(3.0, ease + 0.15);
  }

  const dueAt = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
  return {
    easeFactor: Number(ease.toFixed(2)),
    intervalDays: interval,
    repetitions: reps,
    lapses,
    dueAt,
  };
}

/**
 * Deterministic reading time estimator from TipTap JSON or plain text (~200 wpm).
 */
export function estimateReadingMinutes(contentJson: unknown): number {
  let text = "";
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { text?: unknown; content?: unknown[] };
    if (typeof n.text === "string") text += ` ${n.text}`;
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  };
  walk(contentJson);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 1;
  return Math.max(1, Math.ceil(words / 200));
}
