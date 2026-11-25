import { describe, expect, it } from "vitest";
import { canCreateWithinLimit, getUserEntitlements } from "@/modules/entitlements";
import {
  computeNextReviewSchedule,
  estimateReadingMinutes,
} from "../spaced-repetition";

describe("Notes & Learning Integration", () => {
  it("computes SM-2 spaced repetition intervals across ratings", () => {
    const now = new Date("2026-11-25T12:00:00Z");
    const base = { easeFactor: 2.5, intervalDays: 1, repetitions: 0, lapses: 0 };

    const firstGood = computeNextReviewSchedule(base, "good", now);
    expect(firstGood.repetitions).toBe(1);
    expect(firstGood.intervalDays).toBe(1);

    const secondGood = computeNextReviewSchedule(firstGood, "good", now);
    expect(secondGood.repetitions).toBe(2);
    expect(secondGood.intervalDays).toBe(6);

    const thirdEasy = computeNextReviewSchedule(secondGood, "easy", now);
    expect(thirdEasy.repetitions).toBe(3);
    expect(thirdEasy.intervalDays).toBeGreaterThan(6);

    const resetAgain = computeNextReviewSchedule(thirdEasy, "again", now);
    expect(resetAgain.repetitions).toBe(0);
    expect(resetAgain.intervalDays).toBe(1);
    expect(resetAgain.lapses).toBe(1);
  });

  it("estimates reading time deterministically from TipTap JSON", () => {
    const words = Array.from({ length: 420 }, (_, i) => `word${i}`).join(" ");
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: words }] }],
    };
    expect(estimateReadingMinutes(doc)).toBe(3);
    expect(estimateReadingMinutes({ type: "doc", content: [] })).toBe(1);
  });

  it("resolves centralized learning entitlements without blocking free tier", async () => {
    const ent = await getUserEntitlements("user-1");
    expect(ent.tier).toBe("free");
    expect(canCreateWithinLimit(100, ent.maxCourses)).toBe(true);
    expect(canCreateWithinLimit(5, 5)).toBe(false);
    expect(canCreateWithinLimit(4, 5)).toBe(true);
  });
});
