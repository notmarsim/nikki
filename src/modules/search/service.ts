import { sql } from "drizzle-orm";
import { withUserRls } from "@/db/rls";

export type SearchEntityType = "note" | "task" | "project";

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
      : (["note", "task", "project"] as SearchEntityType[]);
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

    return results.sort((a, b) => b.rank - a.rank).slice(0, limit);
  });
}
