import { describe, expect, it } from "vitest";
import {
  computeStatementPeriod,
  parseMoneyToCents,
  sanitizeCsvCell,
  splitInstallmentsCents,
} from "../money";

describe("Financial precision, installments, and CSV safety", () => {
  it("parses Brazilian and US monetary strings into exact integer cents", () => {
    expect(parseMoneyToCents("R$ 1.234,56")).toBe(123456);
    expect(parseMoneyToCents("1,234.56")).toBe(123456);
    expect(parseMoneyToCents("19,90")).toBe(1990);
    expect(parseMoneyToCents(100.1)).toBe(10010);
  });

  it("splits installments without losing or duplicating cents", () => {
    const parts = splitInstallmentsCents(10000, 3); // R$ 100.00 / 3
    expect(parts).toEqual([3334, 3333, 3333]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it("computes statement periods across closing day and short February", () => {
    const sameCycle = computeStatementPeriod("2026-01-05", 10, 17, 0);
    expect(sameCycle.periodKey).toBe("2026-01");

    const nextCycle = computeStatementPeriod("2026-01-12", 10, 17, 0);
    expect(nextCycle.periodKey).toBe("2026-02");

    // Closing day 31 clamps cleanly to Feb 28 in non-leap year 2026
    const febClamp = computeStatementPeriod("2026-02-15", 31, 5, 0);
    expect(febClamp.closingDate).toBe("2026-02-28");
  });

  it("neutralizes spreadsheet formula injection in CSV exports", () => {
    expect(sanitizeCsvCell("=CMD('calc')")).toBe(`"'=CMD('calc')"`);
    expect(sanitizeCsvCell("+SUM(A1:A2)")).toBe(`"'+SUM(A1:A2)"`);
    expect(sanitizeCsvCell("Normal Expense")).toBe(`"Normal Expense"`);
  });
});
