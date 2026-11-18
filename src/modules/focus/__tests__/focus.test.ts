import { describe, expect, it } from "vitest";
import { computeElapsedFocusSeconds } from "../utils";

describe("focus duration calculation", () => {
  it("computes exact focus seconds across pause and resume intervals", () => {
    const t0 = new Date("2026-11-18T10:00:00.000Z");
    const t1 = new Date("2026-11-18T10:10:00.000Z"); // +600s
    const t2 = new Date("2026-11-18T10:15:00.000Z"); // paused 5m
    const t3 = new Date("2026-11-18T10:20:00.000Z"); // +300s

    const elapsed = computeElapsedFocusSeconds(
      [
        { intervalType: "focus", startedAt: t0, endedAt: t1 },
        { intervalType: "short_break", startedAt: t1, endedAt: t2 },
        { intervalType: "focus", startedAt: t2, endedAt: null },
      ],
      t3
    );

    expect(elapsed).toBe(900);
  });
});
