import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withUserRls } from "@/db/rls";
import {
  bookmarks,
  financeAccounts,
  financeTransactions,
  habits,
  notes,
  projects,
  tasks,
  userSettings,
} from "@/db/schema";
import { apiError } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const bundle = await withUserRls(session.user.id, async (tx) => {
    const [
      settingsRows,
      noteRows,
      taskRows,
      projectRows,
      habitRows,
      bookmarkRows,
      accountRows,
      txRows,
    ] = await Promise.all([
      tx.select().from(userSettings).where(eq(userSettings.userId, session.user.id)),
      tx.select().from(notes).where(eq(notes.userId, session.user.id)),
      tx.select().from(tasks).where(eq(tasks.userId, session.user.id)),
      tx.select().from(projects).where(eq(projects.userId, session.user.id)),
      tx.select().from(habits).where(eq(habits.userId, session.user.id)),
      tx.select().from(bookmarks).where(eq(bookmarks.userId, session.user.id)),
      tx.select().from(financeAccounts).where(eq(financeAccounts.userId, session.user.id)),
      tx.select().from(financeTransactions).where(eq(financeTransactions.userId, session.user.id)),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        timezone: session.user.timezone,
        theme: session.user.theme,
      },
      settings: settingsRows[0] ?? null,
      data: {
        notes: noteRows,
        tasks: taskRows,
        projects: projectRows,
        habits: habitRows,
        bookmarks: bookmarkRows,
        financeAccounts: accountRows,
        financeTransactions: txRows,
      },
    };
  });

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="nikki-backup.json"',
    },
  });
}
