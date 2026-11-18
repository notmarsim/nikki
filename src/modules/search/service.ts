import { sql } from "drizzle-orm";
import { withUserRls } from "@/db/rls";

export type SearchEntityType =
  | "note"
  | "task"
  | "project"
  | "course"
  | "event"
  | "deck"
  | "habit";

export interface GlobalSearchResult {
  id: string;
  type: SearchEntityType;
  title: string;
  snippet: string;
  href: string;
  rank: number;
  updatedAt: string;
}

export async function globalSearch(params: {
  userId: string;
  workspaceId: string;
  query: string;
  types?: SearchEntityType[];
  limit?: number;
}): Promise<GlobalSearchResult[]> {
  const q = params.query.trim();
  if (!q) return [];

  const types =
    params.types && params.types.length > 0
      ? params.types
      : ([
          "note",
          "task",
          "project",
          "course",
          "event",
          "deck",
          "habit",
        ] as SearchEntityType[]);
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
  const likePattern = `%${q}%`;

  return withUserRls(params.userId, async (tx) => {
    const results: GlobalSearchResult[] = [];

    if (types.includes("note")) {
      const noteRows = await tx.execute<{
        id: string;
        title: string;
        snippet: string;
        rank: number;
        updated_at: string;
      }>(sql`
        SELECT
          n.id,
          n.title,
          ts_headline('simple', coalesce(n.content_text, ''), plainto_tsquery('simple', ${q}), 'MaxWords=18, MinWords=6') AS snippet,
          ts_rank(to_tsvector('simple', coalesce(n.title, '') || ' ' || coalesce(n.content_text, '')), plainto_tsquery('simple', ${q})) AS rank,
          n.updated_at
        FROM notes n
        WHERE n.user_id = ${params.userId}
          AND n.workspace_id = ${params.workspaceId}
          AND n.deleted_at IS NULL
          AND (
            to_tsvector('simple', coalesce(n.title, '') || ' ' || coalesce(n.content_text, '')) @@ plainto_tsquery('simple', ${q})
            OR n.title ILIKE ${likePattern}
            OR n.content_text ILIKE ${likePattern}
          )
        ORDER BY rank DESC, n.updated_at DESC
        LIMIT ${limit}
      `);

      for (const r of noteRows) {
        results.push({
          id: r.id,
          type: "note",
          title: r.title,
          snippet: r.snippet || "",
          href: `/notes?id=${r.id}`,
          rank: Number(r.rank) || 0.1,
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    if (types.includes("task")) {
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
          AND (
            to_tsvector('simple', coalesce(t.title, '') || ' ' || coalesce(t.description, '')) @@ plainto_tsquery('simple', ${q})
            OR t.title ILIKE ${likePattern}
            OR coalesce(t.description, '') ILIKE ${likePattern}
          )
        ORDER BY rank DESC, t.updated_at DESC
        LIMIT ${limit}
      `);

      for (const r of taskRows) {
        results.push({
          id: r.id,
          type: "task",
          title: r.title,
          snippet: (r.description ?? "").slice(0, 140),
          href: `/tasks?taskId=${r.id}`,
          rank: Number(r.rank) || 0.1,
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    if (types.includes("project")) {
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
        LIMIT ${limit}
      `);

      for (const r of projRows) {
        results.push({
          id: r.id,
          type: "project",
          title: r.name,
          snippet: (r.description ?? "").slice(0, 140),
          href: `/projects?id=${r.id}`,
          rank: Number(r.rank) || 0.1,
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    if (types.includes("course")) {
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
        LIMIT ${limit}
      `);

      for (const r of courseRows) {
        results.push({
          id: r.id,
          type: "course",
          title: r.title,
          snippet: (r.description ?? "").slice(0, 140),
          href: `/learning?courseId=${r.id}`,
          rank: Number(r.rank) || 0.1,
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    if (types.includes("event")) {
      const eventRows = await tx.execute<{
        id: string;
        title: string;
        description: string | null;
        rank: number;
        updated_at: string;
      }>(sql`
        SELECT
          e.id,
          e.title,
          coalesce(e.description, '') AS description,
          ts_rank(to_tsvector('simple', coalesce(e.title, '') || ' ' || coalesce(e.description, '')), plainto_tsquery('simple', ${q})) AS rank,
          e.updated_at
        FROM calendar_events e
        WHERE e.user_id = ${params.userId}
          AND e.workspace_id = ${params.workspaceId}
          AND (
            to_tsvector('simple', coalesce(e.title, '') || ' ' || coalesce(e.description, '')) @@ plainto_tsquery('simple', ${q})
            OR e.title ILIKE ${likePattern}
            OR coalesce(e.description, '') ILIKE ${likePattern}
          )
        ORDER BY rank DESC, e.updated_at DESC
        LIMIT ${limit}
      `);

      for (const r of eventRows) {
        results.push({
          id: r.id,
          type: "event",
          title: r.title,
          snippet: (r.description ?? "").slice(0, 140),
          href: `/calendar?eventId=${r.id}`,
          rank: Number(r.rank) || 0.1,
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    if (types.includes("deck")) {
      const deckRows = await tx.execute<{
        id: string;
        title: string;
        description: string | null;
        rank: number;
        updated_at: string;
      }>(sql`
        SELECT
          d.id,
          d.title,
          coalesce(d.description, '') AS description,
          ts_rank(to_tsvector('simple', coalesce(d.title, '') || ' ' || coalesce(d.description, '')), plainto_tsquery('simple', ${q})) AS rank,
          d.updated_at
        FROM flashcard_decks d
        WHERE d.user_id = ${params.userId}
          AND d.workspace_id = ${params.workspaceId}
          AND (
            to_tsvector('simple', coalesce(d.title, '') || ' ' || coalesce(d.description, '')) @@ plainto_tsquery('simple', ${q})
            OR d.title ILIKE ${likePattern}
            OR coalesce(d.description, '') ILIKE ${likePattern}
          )
        ORDER BY rank DESC, d.updated_at DESC
        LIMIT ${limit}
      `);

      for (const r of deckRows) {
        results.push({
          id: r.id,
          type: "deck",
          title: r.title,
          snippet: (r.description ?? "").slice(0, 140),
          href: `/flashcards?deckId=${r.id}`,
          rank: Number(r.rank) || 0.1,
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    if (types.includes("habit")) {
      const habitRows = await tx.execute<{
        id: string;
        title: string;
        description: string | null;
        rank: number;
        updated_at: string;
      }>(sql`
        SELECT
          h.id,
          h.title,
          coalesce(h.description, '') AS description,
          ts_rank(to_tsvector('simple', coalesce(h.title, '') || ' ' || coalesce(h.description, '')), plainto_tsquery('simple', ${q})) AS rank,
          h.updated_at
        FROM habits h
        WHERE h.user_id = ${params.userId}
          AND h.workspace_id = ${params.workspaceId}
          AND (
            to_tsvector('simple', coalesce(h.title, '') || ' ' || coalesce(h.description, '')) @@ plainto_tsquery('simple', ${q})
            OR h.title ILIKE ${likePattern}
            OR coalesce(h.description, '') ILIKE ${likePattern}
          )
        ORDER BY rank DESC, h.updated_at DESC
        LIMIT ${limit}
      `);

      for (const r of habitRows) {
        results.push({
          id: r.id,
          type: "habit",
          title: r.title,
          snippet: (r.description ?? "").slice(0, 140),
          href: `/habits?habitId=${r.id}`,
          rank: Number(r.rank) || 0.1,
          updatedAt: new Date(r.updated_at).toISOString(),
        });
      }
    }

    return results.sort((a, b) => b.rank - a.rank).slice(0, limit);
  });
}
