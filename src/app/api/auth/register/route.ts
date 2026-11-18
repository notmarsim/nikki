import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { apiError, apiOk } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashPassword } from "@/modules/auth/password";
import { registerSchema } from "@/modules/auth/schemas";
import { createSession, setSessionCookie } from "@/modules/auth/session";
import { createUserWithDefaults } from "@/modules/users/service";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const rate = checkRateLimit(`register:${ip}`, 10, 60_000);
    if (!rate.allowed) {
      return apiError(429, "RATE_LIMITED", "Too many registration attempts. Please try again later.");
    }

    const body: unknown = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(400, "VALIDATION_ERROR", "Invalid registration data", parsed.error.flatten().fieldErrors);
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);

    if (existing.length > 0) {
      return apiError(409, "EMAIL_EXISTS", "An account with this email already exists");
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const { user, workspace, settings } = await createUserWithDefaults({
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      timezone: parsed.data.timezone,
    });

    const { rawToken, expiresAt } = await createSession({
      userId: user.id,
      userAgent: request.headers.get("user-agent"),
      ipAddress: ip,
    });

    await setSessionCookie(rawToken, expiresAt);
    logger.info("User registered", { userId: user.id });

    return apiOk({ user, workspace, settings }, 201);
  } catch (error) {
    logger.error("Registration failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return apiError(500, "INTERNAL_ERROR", "Unable to complete registration");
  }
}
