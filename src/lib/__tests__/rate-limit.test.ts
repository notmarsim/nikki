import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitStore } from "../rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("allows requests up to the limit and blocks beyond it", () => {
    expect(checkRateLimit("ip:1", 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit("ip:1", 2, 60_000).allowed).toBe(true);
    const third = checkRateLimit("ip:1", 2, 60_000);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });
});
