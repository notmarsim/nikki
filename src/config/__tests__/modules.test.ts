import { describe, expect, it } from "vitest";
import { APP_MODULES, getModuleById } from "../modules";

describe("module registry", () => {
  it("contains all 17 expected Nikki modules with unique ids and hrefs", () => {
    expect(APP_MODULES).toHaveLength(17);
    const ids = new Set(APP_MODULES.map((m) => m.id));
    const hrefs = new Set(APP_MODULES.map((m) => m.href));
    expect(ids.size).toBe(17);
    expect(hrefs.size).toBe(17);
  });

  it("marks dashboard and settings as active in Phase 1", () => {
    expect(getModuleById("dashboard")?.status).toBe("active");
    expect(getModuleById("settings")?.status).toBe("active");
  });
});
