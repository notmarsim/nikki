import { describe, expect, it } from "vitest";
import { DEFAULT_USER_PREFERENCES, mergeUserPreferences } from "../registry";

describe("Settings Preference Registry", () => {
  it("provides sensible defaults and merges partial user overrides cleanly", () => {
    const merged = mergeUserPreferences({
      language: "en-US",
      hideFinancialValues: true,
      pomodoroFocusMinutes: 50,
    });
    expect(merged.language).toBe("en-US");
    expect(merged.hideFinancialValues).toBe(true);
    expect(merged.pomodoroFocusMinutes).toBe(50);
    expect(merged.defaultCurrency).toBe(DEFAULT_USER_PREFERENCES.defaultCurrency);
  });

  it("falls back safely when invalid preference values are stored", () => {
    const fallback = mergeUserPreferences({ language: "invalid-lang" });
    expect(fallback.language).toBe("en-US");
  });
});
