import { describe, expect, it } from "vitest";
import {
  buildRRuleString,
  expandEventOccurrences,
  markOccurrenceConflicts,
} from "../recurrence";

describe("calendar recurrence & conflict detection", () => {
  it("expands recurring weekly event within visible range and applies exceptions", () => {
    const start = new Date("2026-11-02T09:00:00.000Z");
    const end = new Date("2026-11-02T10:00:00.000Z");
    const rrule = buildRRuleString(start, { frequency: "weekly", interval: 1 });

    const occs = expandEventOccurrences(
      {
        id: "ev-1",
        title: "Study Block",
        description: null,
        startsAt: start,
        endsAt: end,
        timezone: "UTC",
        isAllDay: false,
        allDayDate: null,
        location: null,
        color: "#3b82f6",
        category: "study",
        status: "confirmed",
        recurrenceRule: rrule,
      },
      [
        {
          eventId: "ev-1",
          originalOccurrence: new Date("2026-11-09T09:00:00.000Z"),
          replacementStart: null,
          replacementEnd: null,
          replacementTitle: null,
          isCanceled: true,
        },
        {
          eventId: "ev-1",
          originalOccurrence: new Date("2026-11-16T09:00:00.000Z"),
          replacementStart: new Date("2026-11-16T14:00:00.000Z"),
          replacementEnd: new Date("2026-11-16T15:30:00.000Z"),
          replacementTitle: "Rescheduled Study",
          isCanceled: false,
        },
      ],
      new Date("2026-11-01T00:00:00.000Z"),
      new Date("2026-11-23T23:59:59.000Z")
    );

    expect(occs).toHaveLength(3); // Nov 2, Nov 16 (rescheduled), Nov 23 (Nov 9 canceled)
    expect(occs[1]?.title).toBe("Rescheduled Study");
    expect(occs[1]?.startsAt.toISOString()).toBe("2026-11-16T14:00:00.000Z");
  });

  it("includes events that cross midnight into the visible range", () => {
    const occs = expandEventOccurrences(
      {
        id: "ev-night",
        title: "Late Deploy",
        description: null,
        startsAt: new Date("2026-11-10T23:00:00.000Z"),
        endsAt: new Date("2026-11-11T01:30:00.000Z"),
        timezone: "UTC",
        isAllDay: false,
        allDayDate: null,
        location: null,
        color: "#ef4444",
        category: "event",
        status: "confirmed",
        recurrenceRule: null,
      },
      [],
      new Date("2026-11-11T00:00:00.000Z"),
      new Date("2026-11-11T23:59:59.000Z")
    );

    expect(occs).toHaveLength(1);
  });

  it("detects overlapping timed events as conflicts", () => {
    const marked = markOccurrenceConflicts([
      {
        occurrenceId: "a",
        startsAt: new Date("2026-11-10T09:00:00Z"),
        endsAt: new Date("2026-11-10T10:00:00Z"),
        isAllDay: false,
      },
      {
        occurrenceId: "b",
        startsAt: new Date("2026-11-10T09:30:00Z"),
        endsAt: new Date("2026-11-10T10:30:00Z"),
        isAllDay: false,
      },
      {
        occurrenceId: "c",
        startsAt: new Date("2026-11-10T11:00:00Z"),
        endsAt: new Date("2026-11-10T12:00:00Z"),
        isAllDay: false,
      },
    ]);

    expect(marked.find((x) => x.occurrenceId === "a")?.hasConflict).toBe(true);
    expect(marked.find((x) => x.occurrenceId === "b")?.hasConflict).toBe(true);
    expect(marked.find((x) => x.occurrenceId === "c")?.hasConflict).toBe(false);
  });
});
