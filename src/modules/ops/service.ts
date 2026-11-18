import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { withUserRls } from "@/db/rls";
import {
  administrativeAuditEvents,
  applicationErrorEvents,
  diagnosticReports,
  users,
} from "@/db/schema";

export async function createDiagnosticReport(
  userId: string,
  input: { platform: string; appVersion: string; summary: Record<string, unknown> }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(diagnosticReports)
      .values({
        userId,
        platform: input.platform,
        appVersion: input.appVersion,
        summary: input.summary,
      })
      .returning();
    return created!;
  });
}

export async function getOpsDashboardData(adminUserId: string) {
  const [adminRow] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, adminUserId))
    .limit(1);

  if (!adminRow?.isAdmin) {
    throw new Error("FORBIDDEN_OPS");
  }

  const [userCountRes, errorRows, reportRows, auditRows] = await Promise.all([
    db.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM users`),
    db
      .select()
      .from(applicationErrorEvents)
      .orderBy(desc(applicationErrorEvents.createdAt))
      .limit(30),
    db
      .select({
        id: diagnosticReports.id,
        platform: diagnosticReports.platform,
        appVersion: diagnosticReports.appVersion,
        summary: diagnosticReports.summary,
        createdAt: diagnosticReports.createdAt,
      })
      .from(diagnosticReports)
      .orderBy(desc(diagnosticReports.createdAt))
      .limit(20),
    db
      .select()
      .from(administrativeAuditEvents)
      .orderBy(desc(administrativeAuditEvents.createdAt))
      .limit(20),
  ]);

  await db.insert(administrativeAuditEvents).values({
    adminUserId,
    action: "ops.dashboard_viewed",
    metadata: { timestamp: new Date().toISOString() },
  });

  return {
    totalUsers: userCountRes[0]?.count ?? 0,
    errors: errorRows,
    diagnosticReports: reportRows,
    auditEvents: auditRows,
  };
}
