import { describe, expect, it } from "vitest";
import { isAllowedVaultMime } from "../service";

describe("isAllowedVaultMime", () => {
  it("allows safe document and image MIME types", () => {
    expect(isAllowedVaultMime("application/pdf")).toBe(true);
    expect(isAllowedVaultMime("image/png")).toBe(true);
    expect(isAllowedVaultMime("image/jpeg")).toBe(true);
    expect(isAllowedVaultMime("text/plain")).toBe(true);
    expect(
      isAllowedVaultMime("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    ).toBe(true);
  });

  it("blocks executable and script MIME types", () => {
    expect(isAllowedVaultMime("application/x-msdownload")).toBe(false);
    expect(isAllowedVaultMime("application/javascript")).toBe(false);
    expect(isAllowedVaultMime("application/x-sh")).toBe(false);
  });
});
