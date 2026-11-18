import { describe, expect, it } from "vitest";
import { computeHabitStreaks } from "../utils";

describe("habits streak calculation", () => {
  it("computes specific_days streak without penalizing unscheduled days", () => {
    // 2026-11-16 = Monday (1), 2026-11-18 = Wednesday (3)
    const totals = new Map<string, number>([
      ["2026-11-16", 1],
      ["2026-11-18", 1],
    ]);

    const res = computeHabitStreaks(
      {
        frequency: "specific_days",
        scheduleConfig: { daysOfWeek: [1, 3] }, // Mon & Wed only
        targetValue: 1,
        startDate: "2026-11-16",
      },
      totals,
      "2026-11-18"
    );

    expect(res.currentStreak).toBe(2);
    expect(res.bestStreak).toBe(2);
    expect(res.consistencyRate).toBe(100);
  });

  it("computes weekly_count streaks accurately", () => {
    const totals = new Map<string, number>([
      ["2026-11-02", 1],
      ["2026-11-04", 1],
      ["2026-11-09", 1],
      ["2026-11-11", 1],
    ]);

    const res = computeHabitStreaks(
      {
        frequency: "weekly_count",
        scheduleConfig: { targetPerPeriod: 2 },
        targetValue: 1,
        startDate: "2026-11-02",
      },
      totals,
      "2026-11-12"
    );

    expect(res.currentStreak).toBe(2);
    expect(res.bestStreak).toBe(2);
  });
});
