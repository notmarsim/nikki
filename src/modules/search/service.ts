import { sql } from "drizzle-orm";
import { withUserRls } from "@/db/rls";

export type SearchEntityType =
  | "note"
  | "task"
  | "project"
  | "course"
  | "lesson"
  | "event"
  | "deck"
  | "habit"
  | "bookmark"
  | "snippet"
  | "command"
  | "reference";

export const ALL_SEARCH_TYPES: SearchEntityType[] = [
  "note",
  "task",
  "project",
  "course",
  "lesson",
  "event",
  "deck",
  "habit",
  "bookmark",
  "snippet",
  "command",
  "reference",
];

export interface GlobalSearchResult {
  id: string;
  type: SearchEntityType;
  title: string;
  snippet: string;
  context?: string;
  href: string;
  rank: number;
  updatedAt: string;
}

export async function globalSearch(params: {
  userId: string;
  workspaceId: string;
  query: string;
  types?: SearchEntityType[];
  tag?: string;
  projectId?: string;
  collectionId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<GlobalSearchResult[]> {
  const q = params.query.trim();
  if (!q) return [];

  const types =
    params.types && params.types.length > 0 ? params.types : ALL_SEARCH_TYPES;
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);
  const perSourceLimit = Math.min(limit + offset, 50);
  const likePattern = `%${q}%`;
  const tagName = params.tag?.trim().toLowerCase() || null;
  const dateFromIso = params.dateFrom ? new Date(params.dateFrom).toISOString() : null;
  const dateToIso = params.dateTo ? new Date(params.dateTo).toISOString() : null;

  return withUserRls(params.userId, async (tx) => {
    const results: GlobalSearchResult[] = [];

    const boostTitleRank = (title: string, baseRank: number) => {
      const lowerTitle = title.toLowerCase();
      const lowerQ = q.toLowerCase();
      if (lowerTitle === lowerQ) return baseRank + 2.0;
      if (lowerTitle.startsWith(lowerQ)) return baseRank + 0.8;
      if (lowerTitle.includes(lowerQ)) return baseRank + 0.3;
      return baseRank;
    };

    if (types.includes("note") && !params.collectionId) {
      const noteRows = await tx.execute<{
        id: string;
        title: string;
        doc_kind: string;
        snippet: string;
        rank: number;
        updated_at: string;
      }>(sql`
        SELECT
          n.id,
          n.title,
          n.doc_kind,
          ts_headline('simple', coalesce(n.content_text, ''), plainto_tsquery('simple', ${q}), 'MaxWords=18, MinWords=6') AS snippet,
          GREATEST(
            ts_rank(to_tsvector('simple', coalesce(n.title, '') || ' ' || coalesce(n.content_text, '')), plainto_tsquery('simple', ${q})),
            similarity(coalesce(n.title, ''), ${q})
          ) AS rank,
          n.updated_at
        FROM notes n
        WHERE n.user_id = ${params.userId}
          AND n.workspace_id = ${params.workspaceId}
          AND n.deleted_at IS NULL
          AND (${params.projectId ?? null}::uuid IS NULL OR n.project_id = ${params.projectId ?? null}::uuid)
          AND (${dateFromIso}::timestamptz IS NULL OR n.updated_at >= ${dateFromIso}::timestamptz)
          AND (${dateToIso}::timestamptz IS NULL OR n.updated_at <= ${dateToIso}::timestamptz)
          AND (
            ${tagName}::text IS NULL OR EXISTS (
              SELECT 1 FROM entity_tags et
              JOIN tags tg ON tg.id = et.tag_id
              WHERE et.entity_type = 'note' AND et.entity_id = n.id AND tg.name = ${tagName}
            )
          )
          AND (
            to_tsvector('simple', coalesce(n.title, '') || ' ' || coalesce(n.content_text, '')) @@ plainto_tsquery('simple', ${q})
            OR n.title ILIKE ${likePattern}
            OR n.content_text ILIKE ${likePattern}
            OR similarity(coalesce(n.title, ''), ${q}) > 0.25
          )
        ORDER BY rank DESC, n.updated_at DESC
        LIMIT ${perSourceLimit}
      `);

      for (const r of noteRows) {
        results.push({
          id: r.id,
          type: "note",
          title: r.title,
          snippet: r.snippet || "",
          context: r.doc_kind !== "note" ? r.doc_kind : undefined,
          href: `/notes?id=${r.id}`,
          rank: boostTitleRank(r.title, Number(r.rank) || 0.1),
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    if (types.includes("task") && !params.collectionId && !tagName) {
      const taskRows = await tx.execute<{
        id: string;
        title: string;
        description: string | null;
        rank: number;
        updated_at: string;
      }>(sql`
        SELECT
          t.id,
          t.title,
          coalesce(t.description, '') AS description,
          ts_rank(to_tsvector('simple', coalesce(t.title, '') || ' ' || coalesce(t.description, '')), plainto_tsquery('simple', ${q})) AS rank,
          t.updated_at
        FROM tasks t
        WHERE t.user_id = ${params.userId}
          AND t.workspace_id = ${params.workspaceId}
          AND (${params.projectId ?? null}::uuid IS NULL OR t.project_id = ${params.projectId ?? null}::uuid)
          AND (
            to_tsvector('simple', coalesce(t.title, '') || ' ' || coalesce(t.description, '')) @@ plainto_tsquery('simple', ${q})
            OR t.title ILIKE ${likePattern}
            OR coalesce(t.description, '') ILIKE ${likePattern}
          )
        ORDER BY rank DESC, t.updated_at DESC
        LIMIT ${perSourceLimit}
      `);

      for (const r of taskRows) {
        results.push({
          id: r.id,
          type: "task",
          title: r.title,
          snippet: (r.description ?? "").slice(0, 140),
          href: `/tasks?taskId=${r.id}`,
          rank: boostTitleRank(r.title, Number(r.rank) || 0.1),
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    if (types.includes("project") && !params.collectionId && !params.projectId && !tagName) {
      const projRows = await tx.execute<{
        id: string;
        name: string;
        description: string | null;
        rank: number;
        updated_at: string;
      }>(sql`
        SELECT
          p.id,
          p.name,
          coalesce(p.description, '') AS description,
          ts_rank(to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.description, '')), plainto_tsquery('simple', ${q})) AS rank,
          p.updated_at
        FROM projects p
        WHERE p.user_id = ${params.userId}
          AND p.workspace_id = ${params.workspaceId}
          AND (
            to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.description, '')) @@ plainto_tsquery('simple', ${q})
            OR p.name ILIKE ${likePattern}
            OR coalesce(p.description, '') ILIKE ${likePattern}
          )
        ORDER BY rank DESC, p.updated_at DESC
        LIMIT ${perSourceLimit}
      `);

      for (const r of projRows) {
        results.push({
          id: r.id,
          type: "project",
          title: r.name,
          snippet: (r.description ?? "").slice(0, 140),
          href: `/projects?id=${r.id}`,
          rank: boostTitleRank(r.name, Number(r.rank) || 0.1),
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    if (types.includes("bookmark") && !params.projectId) {
      const bookmarkRows = await tx.execute<{
        id: string;
        title: string;
        description: string | null;
        domain: string;
        rank: number;
        updated_at: string;
      }>(sql`
        SELECT
          b.id,
          b.title,
          coalesce(b.description, '') AS description,
          b.domain,
          GREATEST(
            ts_rank(to_tsvector('simple', coalesce(b.title, '') || ' ' || coalesce(b.description, '') || ' ' || coalesce(b.domain, '')), plainto_tsquery('simple', ${q})),
            similarity(coalesce(b.title, ''), ${q})
          ) AS rank,
          b.updated_at
        FROM bookmarks b
        WHERE b.user_id = ${params.userId}
          AND b.workspace_id = ${params.workspaceId}
          AND (${params.collectionId ?? null}::uuid IS NULL OR b.collection_id = ${params.collectionId ?? null}::uuid)
          AND (
            ${tagName}::text IS NULL OR EXISTS (
              SELECT 1 FROM entity_tags et
              JOIN tags tg ON tg.id = et.tag_id
              WHERE et.entity_type = 'bookmark' AND et.entity_id = b.id AND tg.name = ${tagName}
            )
          )
          AND (
            to_tsvector('simple', coalesce(b.title, '') || ' ' || coalesce(b.description, '') || ' ' || coalesce(b.domain, '')) @@ plainto_tsquery('simple', ${q})
            OR b.title ILIKE ${likePattern}
            OR b.url ILIKE ${likePattern}
            OR b.domain ILIKE ${likePattern}
            OR similarity(coalesce(b.title, ''), ${q}) > 0.25
          )
        ORDER BY rank DESC, b.updated_at DESC
        LIMIT ${perSourceLimit}
      `);

      for (const r of bookmarkRows) {
        results.push({
          id: r.id,
          type: "bookmark",
          title: r.title,
          snippet: r.description ? r.description.slice(0, 140) : r.domain,
          context: r.domain,
          href: `/bookmarks?id=${r.id}`,
          rank: boostTitleRank(r.title, Number(r.rank) || 0.1),
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    if (types.includes("snippet") && !params.collectionId) {
      const snippetRows = await tx.execute<{
        id: string;
        title: string;
        language: string;
        description: string | null;
        rank: number;
        updated_at: string;
      }>(sql`
        SELECT
          s.id,
          s.title,
          s.language,
          coalesce(s.description, '') AS description,
          GREATEST(
            ts_rank(to_tsvector('simple', coalesce(s.title, '') || ' ' || coalesce(s.description, '') || ' ' || coalesce(s.language, '') || ' ' || coalesce(s.code, '')), plainto_tsquery('simple', ${q})),
            similarity(coalesce(s.title, ''), ${q})
          ) AS rank,
          s.updated_at
        FROM developer_snippets s
        WHERE s.user_id = ${params.userId}
          AND s.workspace_id = ${params.workspaceId}
          AND (${params.projectId ?? null}::uuid IS NULL OR s.project_id = ${params.projectId ?? null}::uuid)
          AND (
            ${tagName}::text IS NULL OR EXISTS (
              SELECT 1 FROM entity_tags et
              JOIN tags tg ON tg.id = et.tag_id
              WHERE et.entity_type = 'snippet' AND et.entity_id = s.id AND tg.name = ${tagName}
            )
          )
          AND (
            to_tsvector('simple', coalesce(s.title, '') || ' ' || coalesce(s.description, '') || ' ' || coalesce(s.language, '') || ' ' || coalesce(s.code, '')) @@ plainto_tsquery('simple', ${q})
            OR s.title ILIKE ${likePattern}
            OR s.code ILIKE ${likePattern}
            OR s.language ILIKE ${likePattern}
            OR similarity(coalesce(s.title, ''), ${q}) > 0.25
          )
        ORDER BY rank DESC, s.updated_at DESC
        LIMIT ${perSourceLimit}
      `);

      for (const r of snippetRows) {
        results.push({
          id: r.id,
          type: "snippet",
          title: r.title,
          snippet: (r.description ?? "").slice(0, 140),
          context: r.language,
          href: `/developer-hub?tab=snippets&id=${r.id}`,
          rank: boostTitleRank(r.title, Number(r.rank) || 0.1),
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    if (types.includes("command") && !params.collectionId && !params.projectId && !tagName) {
      const cmdRows = await tx.execute<{
        id: string;
        title: string;
        command: string;
        platform: string;
        rank: number;
        updated_at: string;
      }>(sql`
        SELECT
          c.id,
          c.title,
          c.command,
          c.platform,
          ts_rank(to_tsvector('simple', coalesce(c.title, '') || ' ' || coalesce(c.description, '') || ' ' || coalesce(c.command, '')), plainto_tsquery('simple', ${q})) AS rank,
          c.updated_at
        FROM developer_commands c
        WHERE c.user_id = ${params.userId}
          AND c.workspace_id = ${params.workspaceId}
          AND (
            to_tsvector('simple', coalesce(c.title, '') || ' ' || coalesce(c.description, '') || ' ' || coalesce(c.command, '')) @@ plainto_tsquery('simple', ${q})
            OR c.title ILIKE ${likePattern}
            OR c.command ILIKE ${likePattern}
          )
        ORDER BY rank DESC, c.updated_at DESC
        LIMIT ${perSourceLimit}
      `);

      for (const r of cmdRows) {
        results.push({
          id: r.id,
          type: "command",
          title: r.title,
          snippet: r.command.slice(0, 140),
          context: r.platform,
          href: `/developer-hub?tab=commands&id=${r.id}`,
          rank: boostTitleRank(r.title, Number(r.rank) || 0.1),
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    if (types.includes("reference") && !params.collectionId && !tagName) {
      const refRows = await tx.execute<{
        id: string;
        title: string;
        technology: string;
        description: string | null;
        rank: number;
        updated_at: string;
      }>(sql`
        SELECT
          r.id,
          r.title,
          r.technology,
          coalesce(r.description, '') AS description,
          ts_rank(to_tsvector('simple', coalesce(r.title, '') || ' ' || coalesce(r.technology, '') || ' ' || coalesce(r.description, '')), plainto_tsquery('simple', ${q})) AS rank,
          r.updated_at
        FROM developer_references r
        WHERE r.user_id = ${params.userId}
          AND r.workspace_id = ${params.workspaceId}
          AND (${params.projectId ?? null}::uuid IS NULL OR r.project_id = ${params.projectId ?? null}::uuid)
          AND (
            to_tsvector('simple', coalesce(r.title, '') || ' ' || coalesce(r.technology, '') || ' ' || coalesce(r.description, '')) @@ plainto_tsquery('simple', ${q})
            OR r.title ILIKE ${likePattern}
            OR r.technology ILIKE ${likePattern}
          )
        ORDER BY rank DESC, r.updated_at DESC
        LIMIT ${perSourceLimit}
      `);

      for (const r of refRows) {
        results.push({
          id: r.id,
          type: "reference",
          title: r.title,
          snippet: (r.description ?? "").slice(0, 140),
          context: r.technology,
          href: `/developer-hub?tab=documentation&id=${r.id}`,
          rank: boostTitleRank(r.title, Number(r.rank) || 0.1),
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    if (types.includes("course") && !params.collectionId && !params.projectId && !tagName) {
      const courseRows = await tx.execute<{
        id: string;
        title: string;
        description: string | null;
        rank: number;
        updated_at: string;
      }>(sql`
        SELECT
          c.id,
          c.title,
          coalesce(c.description, '') AS description,
          ts_rank(to_tsvector('simple', coalesce(c.title, '') || ' ' || coalesce(c.description, '')), plainto_tsquery('simple', ${q})) AS rank,
          c.updated_at
        FROM courses c
        WHERE c.user_id = ${params.userId}
          AND c.workspace_id = ${params.workspaceId}
          AND (
            to_tsvector('simple', coalesce(c.title, '') || ' ' || coalesce(c.description, '')) @@ plainto_tsquery('simple', ${q})
            OR c.title ILIKE ${likePattern}
            OR coalesce(c.description, '') ILIKE ${likePattern}
          )
        ORDER BY rank DESC, c.updated_at DESC
        LIMIT ${perSourceLimit}
      `);

      for (const r of courseRows) {
        results.push({
          id: r.id,
          type: "course",
          title: r.title,
          snippet: (r.description ?? "").slice(0, 140),
          href: `/learning?courseId=${r.id}`,
          rank: boostTitleRank(r.title, Number(r.rank) || 0.1),
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    if (types.includes("lesson") && !params.collectionId && !params.projectId && !tagName) {
      const lessonRows = await tx.execute<{
        id: string;
        title: string;
        description: string | null;
        course_id: string;
        updated_at: string;
      }>(sql`
        SELECT
          l.id,
          l.title,
          coalesce(l.description, '') AS description,
          cm.course_id,
          l.updated_at
        FROM lessons l
        JOIN course_modules cm ON cm.id = l.module_id
        WHERE l.user_id = ${params.userId}
          AND (l.title ILIKE ${likePattern} OR coalesce(l.description, '') ILIKE ${likePattern})
        ORDER BY l.updated_at DESC
        LIMIT ${perSourceLimit}
      `);

      for (const r of lessonRows) {
        results.push({
          id: r.id,
          type: "lesson",
          title: r.title,
          snippet: (r.description ?? "").slice(0, 140),
          href: `/learning?courseId=${r.course_id}`,
          rank: boostTitleRank(r.title, 0.2),
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    if (types.includes("event") && !params.collectionId && !params.projectId && !tagName) {
      const eventRows = await tx.execute<{
        id: string;
        title: string;
        description: string | null;
        updated_at: string;
      }>(sql`
        SELECT id, title, coalesce(description, '') AS description, updated_at
        FROM calendar_events
        WHERE user_id = ${params.userId}
          AND workspace_id = ${params.workspaceId}
          AND (title ILIKE ${likePattern} OR coalesce(description, '') ILIKE ${likePattern})
        ORDER BY updated_at DESC
        LIMIT ${perSourceLimit}
      `);

      for (const r of eventRows) {
        results.push({
          id: r.id,
          type: "event",
          title: r.title,
          snippet: (r.description ?? "").slice(0, 140),
          href: `/calendar?eventId=${r.id}`,
          rank: boostTitleRank(r.title, 0.15),
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    if (types.includes("deck") && !params.collectionId && !params.projectId && !tagName) {
      const deckRows = await tx.execute<{
        id: string;
        title: string;
        description: string | null;
        updated_at: string;
      }>(sql`
        SELECT id, title, coalesce(description, '') AS description, updated_at
        FROM flashcard_decks
        WHERE user_id = ${params.userId}
          AND workspace_id = ${params.workspaceId}
          AND (title ILIKE ${likePattern} OR coalesce(description, '') ILIKE ${likePattern})
        ORDER BY updated_at DESC
        LIMIT ${perSourceLimit}
      `);

      for (const r of deckRows) {
        results.push({
          id: r.id,
          type: "deck",
          title: r.title,
          snippet: (r.description ?? "").slice(0, 140),
          href: `/flashcards?deckId=${r.id}`,
          rank: boostTitleRank(r.title, 0.15),
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    if (types.includes("habit") && !params.collectionId && !params.projectId && !tagName) {
      const habitRows = await tx.execute<{
        id: string;
        title: string;
        description: string | null;
        updated_at: string;
      }>(sql`
        SELECT id, title, coalesce(description, '') AS description, updated_at
        FROM habits
        WHERE user_id = ${params.userId}
          AND workspace_id = ${params.workspaceId}
          AND (title ILIKE ${likePattern} OR coalesce(description, '') ILIKE ${likePattern})
        ORDER BY updated_at DESC
        LIMIT ${perSourceLimit}
      `);

      for (const r of habitRows) {
        results.push({
          id: r.id,
          type: "habit",
          title: r.title,
          snippet: (r.description ?? "").slice(0, 140),
          href: `/habits?habitId=${r.id}`,
          rank: boostTitleRank(r.title, 0.15),
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    return results.sort((a, b) => b.rank - a.rank).slice(offset, offset + limit);
  });
}
