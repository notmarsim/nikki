import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../password";

describe("password hashing", () => {
  it("hashes and verifies a valid password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash).toContain(":");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("my-secret-password");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("produces unique salts for identical passwords", async () => {
    const hash1 = await hashPassword("same-password");
    const hash2 = await hashPassword("same-password");
    expect(hash1).not.toBe(hash2);
  });

  it("returns false for malformed stored hash", async () => {
    expect(await verifyPassword("anything", "invalid-format")).toBe(false);
  });
});
