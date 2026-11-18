import { describe, expect, it } from "vitest";
import { parseRssOrAtomXml } from "../service";

describe("parseRssOrAtomXml", () => {
  it("parses valid RSS items and strips HTML/XSS scripts", () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Tech Blog</title>
          <item>
            <title>Hello &amp; World</title>
            <link>https://example.com/post-1</link>
            <guid>post-1</guid>
            <description><![CDATA[<p>Safe text</p><script>alert(1)</script>]]></description>
          </item>
        </channel>
      </rss>`;

    const parsed = parseRssOrAtomXml(rss);
    expect(parsed.feedTitle).toBe("Tech Blog");
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]?.title).toBe("Hello & World");
    expect(parsed.entries[0]?.summary).toBe("Safe text");
    expect(parsed.entries[0]?.summary).not.toContain("script");
  });

  it("rejects XML containing DOCTYPE or ENTITY declarations (XXE prevention)", () => {
    const xxe = `<?xml version="1.0"?>
      <!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
      <rss><channel><title>&xxe;</title></channel></rss>`;

    expect(() => parseRssOrAtomXml(xxe)).toThrow(/external entity/i);
  });
});
