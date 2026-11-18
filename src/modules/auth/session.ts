import { createHash, randomBytes } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { sessions, users, type UserRecord } from "@/db/schema";
import { getEnv } from "@/lib/env";

export const SESSION_COOKIE_NAME = "pos_session";
const SESSION_TTL_DAYS = 14;

export interface AuthenticatedSession {
  sessionId: string;
  expiresAt: Date;
  user: Omit<UserRecord, "passwordHash">;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(params: {
  userId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    userId: params.userId,
    tokenHash,
    userAgent: params.userAgent ?? null,
    ipAddress: params.ipAddress ?? null,
    expiresAt,
  });

  return { rawToken, expiresAt };
}

export async function setSessionCookie(rawToken: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  const isProd = getEnv().NODE_ENV === "production";

  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function deleteSessionByToken(rawToken: string): Promise<void> {
  const tokenHash = hashSessionToken(rawToken);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export const getCurrentSession = cache(
  async (): Promise<AuthenticatedSession | null> => {
    const cookieStore = await cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!rawToken) return null;

    const tokenHash = hashSessionToken(rawToken);
    const now = new Date();

    const rows = await db
      .select({
        sessionId: sessions.id,
        expiresAt: sessions.expiresAt,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          avatarUrl: users.avatarUrl,
          bio: users.bio,
          timezone: users.timezone,
          theme: users.theme,
          isAdmin: users.isAdmin,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      sessionId: row.sessionId,
      expiresAt: row.expiresAt,
      user: row.user,
    };
  }
);

export async function requireSession(): Promise<AuthenticatedSession> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
