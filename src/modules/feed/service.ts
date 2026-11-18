import { and, desc, eq } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import { feedEntries, feedSources } from "@/db/schema";
import { assertSafeResolvedHost, validateExternalUrl } from "@/modules/bookmarks/ssrf";

function stripHtmlAndXss(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRssOrAtomXml(xml: string): {
  feedTitle: string;
  entries: Array<{ guid: string; title: string; link: string; summary: string }>;
} {
  // Reject DOCTYPE / ENTITY declarations to prevent XXE
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new Error("XML external entity declarations are forbidden");
  }

  const feedTitleMatch = xml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const feedTitle = feedTitleMatch?.[1] ? stripHtmlAndXss(feedTitleMatch[1]) : "Feed";

  const entries: Array<{ guid: string; title: string; link: string; summary: string }> = [];

  // RSS <item>
  const rssRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = rssRegex.exec(xml)) !== null && entries.length < 30) {
    const block = m[1]!;
    const title = stripHtmlAndXss(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "Untitled");
    const link = stripHtmlAndXss(block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? "");
    const guid = stripHtmlAndXss(block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ?? link);
    const descText = stripHtmlAndXss(
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? ""
    );
    if (link) {
      entries.push({ guid: guid || link, title, link, summary: descText.slice(0, 300) });
    }
  }

  // Atom <entry>
  if (entries.length === 0) {
    const atomRegex = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
    while ((m = atomRegex.exec(xml)) !== null && entries.length < 30) {
      const block = m[1]!;
      const title = stripHtmlAndXss(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "Untitled");
      const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      const link = hrefMatch?.[1]?.trim() ?? "";
      const guid = stripHtmlAndXss(block.match(/<id[^>]*>([\s\S]*?)<\/id>/i)?.[1] ?? link);
      const summary = stripHtmlAndXss(
        block.match(/<(?:summary|content)[^>]*>([\s\S]*?)<\/(?:summary|content)>/i)?.[1] ?? ""
      );
      if (link) {
        entries.push({ guid: guid || link, title, link, summary: summary.slice(0, 300) });
      }
    }
  }

  return { feedTitle, entries };
}

export async function listFeedOverview(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    const [sources, entries] = await Promise.all([
      tx
        .select()
        .from(feedSources)
        .where(
          and(eq(feedSources.userId, userId), eq(feedSources.workspaceId, workspaceId))
        )
        .orderBy(desc(feedSources.createdAt)),
      tx
        .select()
        .from(feedEntries)
        .where(eq(feedEntries.userId, userId))
        .orderBy(desc(feedEntries.publishedAt))
        .limit(80),
    ]);

    return { sources, entries };
  });
}

export async function addAndFetchFeedSource(
  userId: string,
  workspaceId: string,
  rawUrl: string,
  category = "Tech"
) {
  const url = validateExternalUrl(rawUrl);
  await assertSafeResolvedHost(url.hostname);

  const res = await fetch(url.toString(), {
    redirect: "manual",
    signal: AbortSignal.timeout(6000),
    headers: { "User-Agent": "Nikki-FeedReader/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Feed returned HTTP ${res.status}`);
  }
  const xml = await res.text();
  if (xml.length > 2_000_000) {
    throw new Error("Feed XML exceeds 2MB safety limit");
  }

  const parsed = parseRssOrAtomXml(xml);

  return withUserRls(userId, async (tx) => {
    const [source] = await tx
      .insert(feedSources)
      .values({
        userId,
        workspaceId,
        url: url.toString(),
        title: parsed.feedTitle,
        category,
        lastFetchedAt: new Date(),
      })
      .returning();

    for (const entry of parsed.entries) {
      try {
        validateExternalUrl(entry.link);
      } catch {
        continue;
      }
      await tx
        .insert(feedEntries)
        .values({
          userId,
          sourceId: source!.id,
          guid: entry.guid,
          title: entry.title,
          link: entry.link,
          summary: entry.summary,
        })
        .onConflictDoNothing();
    }

    return source!;
  });
}

export async function updateFeedEntryState(
  userId: string,
  entryId: string,
  input: { isRead?: boolean; isFavorite?: boolean }
) {
  return withUserRls(userId, async (tx) => {
    const [updated] = await tx
      .update(feedEntries)
      .set({
        ...(input.isRead !== undefined ? { isRead: input.isRead } : {}),
        ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
      })
      .where(and(eq(feedEntries.id, entryId), eq(feedEntries.userId, userId)))
      .returning();
    return updated;
  });
}

export async function deleteFeedSource(userId: string, sourceId: string) {
  return withUserRls(userId, async (tx) => {
    await tx
      .delete(feedSources)
      .where(and(eq(feedSources.id, sourceId), eq(feedSources.userId, userId)));
    return { deleted: true };
  });
}
