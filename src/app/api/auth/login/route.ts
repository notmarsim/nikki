import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { apiError, apiOk } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyPassword } from "@/modules/auth/password";
import { loginSchema } from "@/modules/auth/schemas";
import { createSession, setSessionCookie } from "@/modules/auth/session";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const rate = checkRateLimit(`login:${ip}`, 15, 60_000);
    if (!rate.allowed) {
      return apiError(429, "RATE_LIMITED", "Too many login attempts. Please wait a minute.");
    }

    const body: unknown = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(400, "VALIDATION_ERROR", "Invalid credentials format", parsed.error.flatten().fieldErrors);
    }

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);

    const user = rows[0];
    if (!user) {
      return apiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return apiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const { rawToken, expiresAt } = await createSession({
      userId: user.id,
      userAgent: request.headers.get("user-agent"),
      ipAddress: ip,
    });

    await setSessionCookie(rawToken, expiresAt);
    logger.info("User logged in", { userId: user.id });

    return apiOk({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        timezone: user.timezone,
        theme: user.theme,
      },
    });
  } catch (error) {
    logger.error("Login failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return apiError(500, "INTERNAL_ERROR", "Unable to sign in");
  }
}
