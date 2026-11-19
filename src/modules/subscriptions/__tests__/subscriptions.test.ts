import { describe, expect, it } from "vitest";
import { computeMonthlyEquivalentCents } from "../service";

describe("computeMonthlyEquivalentCents", () => {
  it("normalizes weekly, quarterly, and yearly subscriptions to monthly cost", () => {
    expect(computeMonthlyEquivalentCents(12000, "yearly")).toBe(1000);
    expect(computeMonthlyEquivalentCents(9000, "quarterly")).toBe(3000);
    expect(computeMonthlyEquivalentCents(5000, "monthly")).toBe(5000);
    expect(computeMonthlyEquivalentCents(1000, "weekly")).toBe(4333);
  });
});
