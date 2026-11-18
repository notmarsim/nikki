import { describe, expect, it } from "vitest";
import { computeProjectProgress } from "@/modules/projects/progress";
import { calculateNextOccurrence, wouldCreateTaskCycle } from "../utils";

describe("tasks & project progress rules", () => {
  it("computes project progress excluding cancelled tasks and subtasks", () => {
    const progress = computeProjectProgress([
      { status: "done", parentTaskId: null },
      { status: "todo", parentTaskId: null },
      { status: "cancelled", parentTaskId: null },
      { status: "done", parentTaskId: "parent-1" },
    ]);
    expect(progress).toBe(50);
  });

  it("returns 0 progress when project has no active top-level tasks", () => {
    expect(computeProjectProgress([])).toBe(0);
    expect(computeProjectProgress([{ status: "cancelled", parentTaskId: null }])).toBe(0);
  });

  it("calculates next occurrence for daily, weekly, and monthly recurrence", () => {
    const base = new Date("2026-01-10T12:00:00.000Z");
    expect(calculateNextOccurrence(base, "daily", 2).toISOString()).toBe(
      "2026-01-12T12:00:00.000Z"
    );
    expect(calculateNextOccurrence(base, "weekly", 1).toISOString()).toBe(
      "2026-01-17T12:00:00.000Z"
    );
    expect(calculateNextOccurrence(base, "monthly", 1).toISOString()).toBe(
      "2026-02-10T12:00:00.000Z"
    );
  });

  it("prevents subtask cycles", () => {
    const tasks = [
      { id: "t1", parentTaskId: null },
      { id: "t2", parentTaskId: "t1" },
      { id: "t3", parentTaskId: "t2" },
    ];
    expect(wouldCreateTaskCycle(tasks, "t1", "t3")).toBe(true);
    expect(wouldCreateTaskCycle(tasks, "t3", "t1")).toBe(false);
  });
});
