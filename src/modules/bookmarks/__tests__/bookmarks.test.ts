import { describe, expect, it } from "vitest";
import { parseNetscapeBookmarksHtml } from "../service";
import {
  canonicalizeUrl,
  isPrivateOrReservedIp,
  validateExternalUrl,
} from "../ssrf";

describe("Bookmarks SSRF & URL safety", () => {
  it("blocks private, loopback, link-local, and metadata IP addresses", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("10.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("1.1.1.1")).toBe(false);
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
  });

  it("rejects non-HTTP protocols, credentials, and internal hostnames", () => {
    expect(() => validateExternalUrl("file:///etc/passwd")).toThrow();
    expect(() => validateExternalUrl("javascript:alert(1)")).toThrow();
    expect(() => validateExternalUrl("http://user:pass@example.com")).toThrow();
    expect(() => validateExternalUrl("http://localhost:3000")).toThrow();
    expect(() => validateExternalUrl("http://metadata.google.internal")).toThrow();
    expect(() => validateExternalUrl("http://169.254.169.254/latest")).toThrow();
    expect(validateExternalUrl("https://nextjs.org/docs").hostname).toBe("nextjs.org");
  });

  it("canonicalizes tracking parameters while preserving functional query params", () => {
    const { canonicalUrl, domain } = canonicalizeUrl(
      "https://www.example.com/article?id=42&utm_source=twitter&fbclid=abc#section"
    );
    expect(domain).toBe("example.com");
    expect(canonicalUrl).toBe("https://www.example.com/article?id=42");
  });

  it("parses Netscape HTML bookmark exports and skips unsafe URLs", () => {
    const html = `
      <DL><p>
        <DT><A HREF="https://nextjs.org/docs">Next.js Docs</A>
        <DT><A HREF="javascript:alert(1)">XSS</A>
        <DT><A HREF="http://127.0.0.1:8080/admin">Local</A>
      </DL><p>
    `;
    const parsed = parseNetscapeBookmarksHtml(html);
    expect(parsed).toEqual([{ url: "https://nextjs.org/docs", title: "Next.js Docs" }]);
  });
});
