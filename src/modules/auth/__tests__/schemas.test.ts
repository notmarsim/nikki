import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "../schemas";

describe("auth schemas", () => {
  it("validates and normalizes registration payload", () => {
    const parsed = registerSchema.safeParse({
      name: "  Alex Morgan  ",
      email: "  ALEX@Example.COM ",
      password: "strongpassword123",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Alex Morgan");
      expect(parsed.data.email).toBe("alex@example.com");
    }
  });

  it("rejects short passwords on registration", () => {
    const parsed = registerSchema.safeParse({
      name: "Alex",
      email: "alex@example.com",
      password: "short",
    });
    expect(parsed.success).toBe(false);
  });

  it("validates login payload", () => {
    const parsed = loginSchema.safeParse({
      email: "alex@example.com",
      password: "password123",
    });
    expect(parsed.success).toBe(true);
  });
});
