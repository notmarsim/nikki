import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../crypto";
import { extractCommandPlaceholders, interpolateCommand } from "../utils";

describe("Developer Hub utilities & secret encryption", () => {
  it("encrypts and decrypts GitHub tokens with AES-256-GCM", () => {
    const token = "ghp_exampleToken1234567890abcdef";
    const encrypted = encryptSecret(token);
    expect(encrypted).not.toContain(token);
    expect(encrypted.split(":")).toHaveLength(3);
    expect(decryptSecret(encrypted)).toBe(token);
  });

  it("extracts and interpolates parameterized command placeholders safely", () => {
    const cmd = "ssh -p {port} {user}@{host}";
    expect(extractCommandPlaceholders(cmd)).toEqual(["port", "user", "host"]);
    expect(
      interpolateCommand(cmd, { port: "2222", user: "admin", host: "10.0.0.5" })
    ).toBe("ssh -p 2222 admin@10.0.0.5");
  });
});
