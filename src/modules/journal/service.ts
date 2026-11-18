import { and, desc, eq } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import { activityLogs, journalEntries } from "@/db/schema";

export async function getJournalOverview(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    const [entries, timeline] = await Promise.all([
      tx
        .select()
        .from(journalEntries)
        .where(eq(journalEntries.userId, userId))
        .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
        .limit(60),
      tx
        .select()
        .from(activityLogs)
        .where(
          and(
            eq(activityLogs.userId, userId),
            eq(activityLogs.workspaceId, workspaceId)
          )
        )
        .orderBy(desc(activityLogs.createdAt))
        .limit(20),
    ]);

    return { entries, timeline };
  });
}

export async function createJournalEntry(
  userId: string,
  input: {
    entryDate: string;
    title?: string | null;
    content: string;
    mood?: string | null;
    templateKind?: string;
    tags?: string[];
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(journalEntries)
      .values({
        userId,
        entryDate: input.entryDate,
        title: input.title ?? null,
        content: input.content,
        mood: input.mood ?? null,
        templateKind: input.templateKind ?? "daily",
        tags: input.tags ?? [],
        isPrivate: true,
      })
      .returning();
    return created!;
  });
}

export async function deleteJournalEntry(userId: string, id: string) {
  return withUserRls(userId, async (tx) => {
    await tx
      .delete(journalEntries)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));
    return { deleted: true };
  });
}
