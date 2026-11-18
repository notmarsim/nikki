import { describe, expect, it } from "vitest";
import { hasRequiredRole } from "../service";

describe("Nikki Spaces RBAC hierarchy", () => {
  it("enforces owner > admin > editor > viewer permissions", () => {
    expect(hasRequiredRole("owner", "admin")).toBe(true);
    expect(hasRequiredRole("admin", "editor")).toBe(true);
    expect(hasRequiredRole("editor", "viewer")).toBe(true);
    expect(hasRequiredRole("viewer", "editor")).toBe(false);
    expect(hasRequiredRole("editor", "admin")).toBe(false);
    expect(hasRequiredRole(null, "viewer")).toBe(false);
  });
});
