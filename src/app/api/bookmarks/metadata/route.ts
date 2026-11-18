import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentSession } from "@/modules/auth/session";
import { fetchSafeBookmarkMetadata } from "@/modules/bookmarks/ssrf";

const schema = z.object({
  url: z.string().trim().min(1).max(2048),
});

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const rl = checkRateLimit(`bookmark-meta:${session.user.id}`, 20, 60_000);
  if (!rl.allowed) {
    return apiError(429, "RATE_LIMITED", "Too many metadata requests. Please wait a moment.");
  }

  const body: unknown = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Valid URL is required");
  }

  try {
    const metadata = await fetchSafeBookmarkMetadata(parsed.data.url);
    return apiOk({ metadata });
  } catch (error) {
    return apiError(
      400,
      "METADATA_FETCH_FAILED",
      error instanceof Error ? error.message : "Could not extract metadata"
    );
  }
}
