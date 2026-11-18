import { describe, expect, it } from "vitest";
import { computeLearningProgress } from "../progress";

describe("learning progress calculation", () => {
  it("computes progress from unique lessons without double-counting", () => {
    const res = computeLearningProgress([
      { id: "l1", status: "completed" },
      { id: "l1", status: "completed" }, // duplicate ignored
      { id: "l2", status: "in_progress" },
      { id: "l3", status: "not_started" },
      { id: "l4", status: "completed" },
    ]);

    expect(res).toEqual({ total: 4, completed: 2, progress: 50 });
  });

  it("handles zero lessons safely without NaN", () => {
    expect(computeLearningProgress([])).toEqual({ total: 0, completed: 0, progress: 0 });
  });
});
