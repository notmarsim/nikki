import { and, asc, desc, eq, ilike, inArray, isNull, ne, or } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import { bookmarkCollections, bookmarks, entityTags, tags } from "@/db/schema";
import { recordActivity } from "@/modules/activity/service";
import { getTagsMapForEntities, syncEntityTags } from "@/modules/relations/service";
import {
  canonicalizeUrl,
  fetchSafeBookmarkMetadata,
  validateExternalUrl,
} from "./ssrf";

export class BookmarkServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export async function listBookmarks(params: {
  userId: string;
  workspaceId: string;
  collectionId?: string;
  readingStatus?: string;
  resourceType?: string;
  favoritesOnly?: boolean;
  readLater?: boolean;
  tag?: string;
  q?: string;
  sortBy?: "created" | "updated" | "title" | "domain";
  limit?: number;
  offset?: number;
}) {
  const limit = Math.min(Math.max(params.limit ?? 40, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);

  return withUserRls(params.userId, async (tx) => {
    const conditions = [
      eq(bookmarks.userId, params.userId),
      eq(bookmarks.workspaceId, params.workspaceId),
    ];

    if (params.collectionId) {
      conditions.push(eq(bookmarks.collectionId, params.collectionId));
    }
    if (params.readingStatus) {
      conditions.push(eq(bookmarks.readingStatus, params.readingStatus));
    } else if (params.readLater) {
      conditions.push(
        or(
          eq(bookmarks.readingStatus, "unread"),
          eq(bookmarks.readingStatus, "reading")
        )!
      );
      conditions.push(isNull(bookmarks.archivedAt));
    }
    if (params.resourceType) {
      conditions.push(eq(bookmarks.resourceType, params.resourceType));
    }
    if (params.favoritesOnly) {
      conditions.push(eq(bookmarks.isFavorite, true));
    }
    if (params.q && params.q.trim()) {
      const pattern = `%${params.q.trim()}%`;
      conditions.push(
        or(
          ilike(bookmarks.title, pattern),
          ilike(bookmarks.description, pattern),
          ilike(bookmarks.url, pattern),
          ilike(bookmarks.domain, pattern)
        )!
      );
    }

    if (params.tag) {
      const tagged = await tx
        .select({ entityId: entityTags.entityId })
        .from(entityTags)
        .innerJoin(tags, eq(entityTags.tagId, tags.id))
        .where(
          and(
            eq(entityTags.entityType, "bookmark"),
            eq(tags.userId, params.userId),
            eq(tags.name, params.tag.trim().toLowerCase())
          )
        );
      if (tagged.length === 0) {
        return { bookmarks: [], collections: [] };
      }
      conditions.push(
        inArray(
          bookmarks.id,
          tagged.map((r) => r.entityId)
        )
      );
    }

    const orderExpr =
      params.sortBy === "title"
        ? asc(bookmarks.title)
        : params.sortBy === "domain"
          ? asc(bookmarks.domain)
          : params.sortBy === "created"
            ? desc(bookmarks.createdAt)
            : desc(bookmarks.updatedAt);

    const [rows, collections] = await Promise.all([
      tx
        .select()
        .from(bookmarks)
        .where(and(...conditions))
        .orderBy(orderExpr)
        .limit(limit)
        .offset(offset),
      tx
        .select()
        .from(bookmarkCollections)
        .where(
          and(
            eq(bookmarkCollections.userId, params.userId),
            eq(bookmarkCollections.workspaceId, params.workspaceId)
          )
        )
        .orderBy(asc(bookmarkCollections.sortOrder), asc(bookmarkCollections.name)),
    ]);

    const tagsMap = await getTagsMapForEntities(
      params.userId,
      "bookmark",
      rows.map((r) => r.id)
    );

    return {
      bookmarks: rows.map((r) => ({
        ...r,
        tags: tagsMap.get(r.id) ?? [],
      })),
      collections,
    };
  });
}

export async function createBookmark(
  userId: string,
  workspaceId: string,
  input: {
    url: string;
    title?: string;
    description?: string | null;
    thumbnailUrl?: string | null;
    faviconUrl?: string | null;
    resourceType?: string;
    collectionId?: string | null;
    readingStatus?: string;
    isFavorite?: boolean;
    tags?: string[];
  }
) {
  let canonicalUrl: string;
  let domain: string;
  try {
    const parsed = canonicalizeUrl(input.url);
    canonicalUrl = parsed.canonicalUrl;
    domain = parsed.domain;
  } catch (err) {
    throw new BookmarkServiceError(
      400,
      "INVALID_URL",
      err instanceof Error ? err.message : "Invalid URL"
    );
  }

  // Try metadata extraction when title not explicitly supplied
  let fetchedTitle = input.title;
  let fetchedDescription = input.description ?? null;
  let fetchedThumb = input.thumbnailUrl ?? null;
  let fetchedFavicon = input.faviconUrl ?? null;
  let inferredType = input.resourceType ?? "website";

  if (!fetchedTitle) {
    try {
      const meta = await fetchSafeBookmarkMetadata(canonicalUrl);
      fetchedTitle = meta.title;
      fetchedDescription = fetchedDescription ?? meta.description;
      fetchedThumb = fetchedThumb ?? meta.thumbnailUrl;
      fetchedFavicon = fetchedFavicon ?? meta.faviconUrl;
      if (!input.resourceType || input.resourceType === "website") {
        inferredType = meta.resourceType;
      }
    } catch {
      fetchedTitle = domain;
    }
  }

  const created = await withUserRls(userId, async (tx) => {
    const duplicate = await tx
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.workspaceId, workspaceId),
          eq(bookmarks.canonicalUrl, canonicalUrl)
        )
      )
      .limit(1);

    if (duplicate.length > 0) {
      throw new BookmarkServiceError(
        409,
        "DUPLICATE_BOOKMARK",
        "This URL is already saved in your library"
      );
    }

    if (input.collectionId) {
      const col = await tx
        .select({ id: bookmarkCollections.id })
        .from(bookmarkCollections)
        .where(
          and(
            eq(bookmarkCollections.id, input.collectionId),
            eq(bookmarkCollections.userId, userId)
          )
        )
        .limit(1);
      if (col.length === 0) {
        throw new BookmarkServiceError(404, "COLLECTION_NOT_FOUND", "Collection not found");
      }
    }

    const [row] = await tx
      .insert(bookmarks)
      .values({
        userId,
        workspaceId,
        url: input.url.trim(),
        canonicalUrl,
        title: fetchedTitle!,
        description: fetchedDescription,
        domain,
        thumbnailUrl: fetchedThumb,
        faviconUrl: fetchedFavicon,
        resourceType: inferredType,
        collectionId: input.collectionId ?? null,
        readingStatus: input.readingStatus ?? "unread",
        isFavorite: input.isFavorite ?? false,
      })
      .returning();

    return row!;
  });

  const savedTags = input.tags
    ? await syncEntityTags(userId, workspaceId, "bookmark", created.id, input.tags)
    : [];

  await recordActivity({
    userId,
    workspaceId,
    entityType: "bookmark",
    entityId: created.id,
    action: "bookmark.created",
    payload: { title: created.title, domain: created.domain },
  });

  return { ...created, tags: savedTags };
}

export async function updateBookmark(
  userId: string,
  workspaceId: string,
  bookmarkId: string,
  input: {
    title?: string;
    description?: string | null;
    resourceType?: string;
    collectionId?: string | null;
    readingStatus?: string;
    isFavorite?: boolean;
    tags?: string[];
  }
) {
  const updated = await withUserRls(userId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)))
      .limit(1);

    if (!existing) {
      throw new BookmarkServiceError(404, "NOT_FOUND", "Bookmark not found");
    }

    const becomingArchived =
      input.readingStatus === "archived" && existing.readingStatus !== "archived";
    const leavingArchived =
      input.readingStatus !== undefined &&
      input.readingStatus !== "archived" &&
      existing.readingStatus === "archived";

    const [row] = await tx
      .update(bookmarks)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.resourceType !== undefined ? { resourceType: input.resourceType } : {}),
        ...(input.collectionId !== undefined ? { collectionId: input.collectionId } : {}),
        ...(input.readingStatus !== undefined
          ? { readingStatus: input.readingStatus }
          : {}),
        ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
        ...(becomingArchived ? { archivedAt: new Date() } : {}),
        ...(leavingArchived ? { archivedAt: null } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)))
      .returning();

    return row!;
  });

  const savedTags = input.tags
    ? await syncEntityTags(userId, workspaceId, "bookmark", bookmarkId, input.tags)
    : (await getTagsMapForEntities(userId, "bookmark", [bookmarkId])).get(bookmarkId) ?? [];

  return { ...updated, tags: savedTags };
}

export async function deleteBookmark(userId: string, bookmarkId: string) {
  return withUserRls(userId, async (tx) => {
    const deleted = await tx
      .delete(bookmarks)
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)))
      .returning({ id: bookmarks.id });

    if (deleted.length === 0) {
      throw new BookmarkServiceError(404, "NOT_FOUND", "Bookmark not found");
    }
    return deleted[0]!;
  });
}

export async function createCollection(
  userId: string,
  workspaceId: string,
  input: {
    name: string;
    description?: string | null;
    icon?: string;
    color?: string;
    parentId?: string | null;
  }
) {
  return withUserRls(userId, async (tx) => {
    if (input.parentId) {
      const parent = await tx
        .select({ id: bookmarkCollections.id })
        .from(bookmarkCollections)
        .where(
          and(
            eq(bookmarkCollections.id, input.parentId),
            eq(bookmarkCollections.userId, userId)
          )
        )
        .limit(1);
      if (parent.length === 0) {
        throw new BookmarkServiceError(404, "PARENT_NOT_FOUND", "Parent collection not found");
      }
    }

    const [created] = await tx
      .insert(bookmarkCollections)
      .values({
        userId,
        workspaceId,
        name: input.name,
        description: input.description ?? null,
        icon: input.icon ?? "Folder",
        color: input.color ?? "#f97316",
        parentId: input.parentId ?? null,
      })
      .returning();

    return created!;
  });
}

export async function updateCollection(
  userId: string,
  collectionId: string,
  input: {
    name?: string;
    description?: string | null;
    icon?: string;
    color?: string;
    parentId?: string | null;
    sortOrder?: number;
  }
) {
  return withUserRls(userId, async (tx) => {
    if (input.parentId !== undefined && input.parentId !== null) {
      if (input.parentId === collectionId) {
        throw new BookmarkServiceError(400, "CYCLE_DETECTED", "Collection cannot be its own parent");
      }
      // Walk ancestors to prevent cycles
      const allCols = await tx
        .select({ id: bookmarkCollections.id, parentId: bookmarkCollections.parentId })
        .from(bookmarkCollections)
        .where(eq(bookmarkCollections.userId, userId));
      const parentMap = new Map(allCols.map((c) => [c.id, c.parentId]));
      let cursor: string | null | undefined = input.parentId;
      let steps = 0;
      while (cursor && steps < 50) {
        if (cursor === collectionId) {
          throw new BookmarkServiceError(
            400,
            "CYCLE_DETECTED",
            "Cannot set a descendant as parent collection"
          );
        }
        cursor = parentMap.get(cursor);
        steps++;
      }
    }

    const [updated] = await tx
      .update(bookmarkCollections)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookmarkCollections.id, collectionId),
          eq(bookmarkCollections.userId, userId)
        )
      )
      .returning();

    if (!updated) {
      throw new BookmarkServiceError(404, "NOT_FOUND", "Collection not found");
    }
    return updated;
  });
}

export async function deleteCollection(userId: string, collectionId: string) {
  return withUserRls(userId, async (tx) => {
    // Reparent children to null before deleting
    await tx
      .update(bookmarkCollections)
      .set({ parentId: null })
      .where(
        and(
          eq(bookmarkCollections.parentId, collectionId),
          eq(bookmarkCollections.userId, userId),
          ne(bookmarkCollections.id, collectionId)
        )
      );

    const deleted = await tx
      .delete(bookmarkCollections)
      .where(
        and(
          eq(bookmarkCollections.id, collectionId),
          eq(bookmarkCollections.userId, userId)
        )
      )
      .returning({ id: bookmarkCollections.id });

    if (deleted.length === 0) {
      throw new BookmarkServiceError(404, "NOT_FOUND", "Collection not found");
    }
    return deleted[0]!;
  });
}

export function parseNetscapeBookmarksHtml(
  html: string
): Array<{ url: string; title: string }> {
  const items: Array<{ url: string; title: string }> = [];
  const regex = /<A\s+[^>]*HREF=["']([^"']+)["'][^>]*>([\s\S]*?)<\/A>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null && items.length < 500) {
    const rawUrl = match[1]?.trim();
    const rawTitle = match[2]?.replace(/<[^>]+>/g, "").trim();
    if (!rawUrl) continue;
    try {
      validateExternalUrl(rawUrl);
      items.push({ url: rawUrl, title: rawTitle || rawUrl });
    } catch {
      // Skip invalid or non-HTTP(S) links
    }
  }
  return items;
}

export function exportBookmarksToNetscapeHtml(
  rows: Array<{ url: string; title: string; createdAt: Date | string }>
): string {
  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    "<META HTTP-EQUIV=\"Content-Type\" CONTENT=\"text/html; charset=UTF-8\">",
    "<TITLE>Nikki Bookmarks</TITLE>",
    "<H1>Nikki Bookmarks</H1>",
    "<DL><p>",
  ];
  for (const b of rows) {
    const addDate = Math.floor(new Date(b.createdAt).getTime() / 1000);
    const safeUrl = b.url.replace(/"/g, "&quot;");
    const safeTitle = b.title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    lines.push(`    <DT><A HREF="${safeUrl}" ADD_DATE="${addDate}">${safeTitle}</A>`);
  }
  lines.push("</DL><p>");
  return lines.join("\n");
}
