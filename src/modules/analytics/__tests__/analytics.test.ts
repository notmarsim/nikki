import { describe, expect, it } from "vitest";
import { computeDeltaPercent, computePeriodRange } from "../utils";

describe("Analytics period ranges and delta comparisons", () => {
  it("computes equivalent previous periods without overlap", () => {
    const ref = new Date("2026-11-18T15:00:00Z");
    const r = computePeriodRange("7d", ref);
    expect(r.daysCount).toBe(7);
    expect(r.prevEnd.getTime()).toBeLessThan(r.start.getTime());
  });

  it("handles zero division cleanly in delta calculations", () => {
    expect(computeDeltaPercent(0, 0)).toBe(0);
    expect(computeDeltaPercent(5, 0)).toBeNull();
    expect(computeDeltaPercent(14, 11)).toBe(27.3);
  });
});
