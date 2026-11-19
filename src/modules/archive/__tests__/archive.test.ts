import { describe, expect, it } from "vitest";
import { computeWeekEndUtc, isEligibleForWeeklyArchive } from "../week";

describe("weekly archive boundary & eligibility", () => {
  it("keeps tasks completed during the current week visible until week end", () => {
    // Wednesday 2026-11-18T15:00:00Z in America/Sao_Paulo (UTC-3 -> Wed 12:00)
    const completedAt = new Date("2026-11-18T15:00:00.000Z");
    const archiveAfter = computeWeekEndUtc(completedAt, "America/Sao_Paulo", "monday");

    // End of Monday-Sunday week in Sao Paulo is Sunday 2026-11-22 23:59:59.999 -03:00 = 2026-11-23T02:59:59.999Z
    expect(archiveAfter.toISOString()).toBe("2026-11-23T02:59:59.999Z");

    // Still Friday: must NOT archive
    expect(
      isEligibleForWeeklyArchive(
        { status: "done", archivedAt: null, deletedAt: null, archiveAfter },
        new Date("2026-11-20T18:00:00.000Z"),
        true
      )
    ).toBe(false);

    // Monday morning after week ends: MUST archive
    expect(
      isEligibleForWeeklyArchive(
        { status: "done", archivedAt: null, deletedAt: null, archiveAfter },
        new Date("2026-11-23T03:05:00.000Z"),
        true
      )
    ).toBe(true);
  });

  it("respects weekStartsOn = sunday", () => {
    // Sunday 2026-11-22T12:00:00Z in UTC -> start of a Sunday-Saturday week!
    const sunday = new Date("2026-11-22T12:00:00.000Z");
    const archiveAfter = computeWeekEndUtc(sunday, "UTC", "sunday");
    expect(archiveAfter.toISOString()).toBe("2026-11-28T23:59:59.999Z");
  });

  it("never archives pending, already archived, deleted, or when disabled", () => {
    const past = new Date("2026-11-01T00:00:00.000Z");
    const now = new Date("2026-11-18T00:00:00.000Z");

    expect(
      isEligibleForWeeklyArchive(
        { status: "todo", archivedAt: null, deletedAt: null, archiveAfter: past },
        now,
        true
      )
    ).toBe(false);

    expect(
      isEligibleForWeeklyArchive(
        { status: "done", archivedAt: past, deletedAt: null, archiveAfter: past },
        now,
        true
      )
    ).toBe(false);

    expect(
      isEligibleForWeeklyArchive(
        { status: "done", archivedAt: null, deletedAt: past, archiveAfter: past },
        now,
        true
      )
    ).toBe(false);

    expect(
      isEligibleForWeeklyArchive(
        { status: "done", archivedAt: null, deletedAt: null, archiveAfter: past },
        now,
        false
      )
    ).toBe(false);
  });
});
