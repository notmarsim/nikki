import { describe, expect, it } from "vitest";
import { scheduleDaySlots } from "../service";

describe("scheduleDaySlots (Day Planner)", () => {
  it("schedules tasks around fixed busy events and skips dependency-blocked tasks", () => {
    const res = scheduleDaySlots({
      workStartMinute: 9 * 60,
      workEndMinute: 18 * 60,
      minBreakMinutes: 10,
      busySlots: [{ startMinute: 14 * 60, endMinute: 16 * 60, title: "Meeting" }],
      tasks: [
        { id: "t1", title: "Study", priority: "high", estimatedMinutes: 60, dueAt: null, blockedBy: [] },
        { id: "t2", title: "Deploy", priority: "urgent", estimatedMinutes: 30, dueAt: null, blockedBy: ["Build"] },
      ],
    });

    expect(res.scheduled).toHaveLength(1);
    expect(res.scheduled[0]?.taskId).toBe("t1");
    expect(res.scheduled[0]?.startMinute).toBe(9 * 60);
    expect(res.scheduled[0]?.endMinute).toBe(10 * 60);
    expect(res.unscheduled).toHaveLength(1);
    expect(res.unscheduled[0]?.reason).toMatch(/Blocked/i);
  });
});
