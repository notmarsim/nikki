import dns from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata",
]);

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((p) => Number(p));
  return (
    (((parts[0] ?? 0) << 24) >>> 0) +
    ((parts[1] ?? 0) << 16) +
    ((parts[2] ?? 0) << 8) +
    (parts[3] ?? 0)
  );
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.trim().toLowerCase();

  // Handle IPv4-mapped IPv6 like ::ffff:127.0.0.1
  if (normalized.startsWith("::ffff:")) {
    const v4 = normalized.slice(7);
    if (net.isIPv4(v4)) return isPrivateOrReservedIp(v4);
  }

  if (net.isIPv4(normalized)) {
    const n = ipv4ToInt(normalized);
    const inCidr = (base: string, maskBits: number) => {
      const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    };

    return (
      inCidr("0.0.0.0", 8) || // "This" network
      inCidr("10.0.0.0", 8) || // Private RFC1918
      inCidr("100.64.0.0", 10) || // CGNAT RFC6598
      inCidr("127.0.0.0", 8) || // Loopback
      inCidr("169.254.0.0", 16) || // Link-local & cloud metadata
      inCidr("172.16.0.0", 12) || // Private RFC1918
      inCidr("192.0.0.0", 24) || // IETF protocol assignments
      inCidr("192.168.0.0", 16) || // Private RFC1918
      inCidr("198.18.0.0", 15) || // Benchmarking
      inCidr("224.0.0.0", 4) || // Multicast
      inCidr("240.0.0.0", 4) // Reserved
    );
  }

  if (net.isIPv6(normalized)) {
    if (normalized === "::" || normalized === "::1") return true;
    // Unique local address fc00::/7
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    // Link-local fe80::/10
    if (
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    ) {
      return true;
    }
    // Multicast ff00::/8
    if (normalized.startsWith("ff")) return true;
    return false;
  }

  return true;
}

export function validateExternalUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("Invalid URL format");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are allowed");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Credentials in URL are not allowed");
  }

  const host = parsed.hostname.toLowerCase();
  if (!host) {
    throw new Error("URL hostname is required");
  }
  if (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost")
  ) {
    throw new Error("Blocked internal or local hostname");
  }

  if (net.isIP(host) && isPrivateOrReservedIp(host)) {
    throw new Error("Blocked private or reserved IP address");
  }

  return parsed;
}

export async function assertSafeResolvedHost(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error("Blocked private or reserved IP address");
    }
    return;
  }

  const records = await dns.lookup(hostname, { all: true });
  if (records.length === 0) {
    throw new Error("Could not resolve hostname");
  }
  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new Error("Resolved IP belongs to a private or reserved network");
    }
  }
}

export function canonicalizeUrl(rawUrl: string): {
  canonicalUrl: string;
  domain: string;
} {
  const url = validateExternalUrl(rawUrl);
  const trackingParams = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
  ];
  for (const param of trackingParams) {
    url.searchParams.delete(param);
  }
  url.hash = "";
  const domain = url.hostname.replace(/^www\./, "").toLowerCase();
  return { canonicalUrl: url.toString(), domain };
}

export interface ExtractedMetadata {
  url: string;
  domain: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  faviconUrl: string | null;
  resourceType: "website" | "article" | "video" | "docs" | "github" | "pdf";
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractMetaTag(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }
  return null;
}

function inferResourceType(
  url: URL
): "website" | "article" | "video" | "docs" | "github" | "pdf" {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (path.endsWith(".pdf")) return "pdf";
  if (host === "github.com" || host.endsWith(".github.com")) return "github";
  if (
    host.includes("youtube.com") ||
    host === "youtu.be" ||
    host.includes("vimeo.com")
  ) {
    return "video";
  }
  if (host.startsWith("docs.") || path.includes("/docs/")) return "docs";
  return "website";
}

export async function fetchSafeBookmarkMetadata(
  rawUrl: string
): Promise<ExtractedMetadata> {
  let currentUrl = validateExternalUrl(rawUrl);
  const maxRedirects = 3;
  let response: Response | null = null;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertSafeResolvedHost(currentUrl.hostname);
    const res = await fetch(currentUrl.toString(), {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent": "NikkiBot/1.0 (+https://nikki.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location || hop === maxRedirects) {
        throw new Error("Too many redirects or missing redirect target");
      }
      const nextUrl = new URL(location, currentUrl);
      currentUrl = validateExternalUrl(nextUrl.toString());
      continue;
    }

    response = res;
    break;
  }

  if (!response || !response.ok) {
    throw new Error(`Upstream returned HTTP ${response?.status ?? "error"}`);
  }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  const domain = currentUrl.hostname.replace(/^www\./, "").toLowerCase();
  const baseType = inferResourceType(currentUrl);

  if (contentType.includes("application/pdf")) {
    return {
      url: currentUrl.toString(),
      domain,
      title: decodeURIComponent(currentUrl.pathname.split("/").pop() || domain),
      description: null,
      thumbnailUrl: null,
      faviconUrl: `${currentUrl.origin}/favicon.ico`,
      resourceType: "pdf",
    };
  }

  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new Error("Unsupported content type for metadata extraction");
  }

  // Read at most 1MB
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const maxBytes = 1024 * 1024;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          chunks.push(value.subarray(0, value.byteLength - (totalBytes - maxBytes)));
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
  }

  const html = Buffer.concat(chunks).toString("utf8");
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle =
    extractMetaTag(html, "og:title") ??
    extractMetaTag(html, "twitter:title") ??
    (titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1]) : null) ??
    domain;

  const description =
    extractMetaTag(html, "og:description") ??
    extractMetaTag(html, "twitter:description") ??
    extractMetaTag(html, "description");

  const rawImage =
    extractMetaTag(html, "og:image") ?? extractMetaTag(html, "twitter:image");
  let thumbnailUrl: string | null = null;
  if (rawImage) {
    try {
      const imgUrl = validateExternalUrl(new URL(rawImage, currentUrl).toString());
      thumbnailUrl = imgUrl.toString();
    } catch {
      thumbnailUrl = null;
    }
  }

  const iconMatch = html.match(
    /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i
  );
  let faviconUrl: string | null = `${currentUrl.origin}/favicon.ico`;
  if (iconMatch?.[1]) {
    try {
      faviconUrl = validateExternalUrl(
        new URL(iconMatch[1], currentUrl).toString()
      ).toString();
    } catch {
      faviconUrl = null;
    }
  }

  return {
    url: currentUrl.toString(),
    domain,
    title: rawTitle.slice(0, 200),
    description: description ? description.slice(0, 500) : null,
    thumbnailUrl,
    faviconUrl,
    resourceType: baseType,
  };
}
