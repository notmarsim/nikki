import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  bookmarks,
  courseModules,
  courses,
  developerReferences,
  developerSnippets,
  entityRelations,
  entityTags,
  graphNodePositions,
  graphPreferences,
  learningResourceLinks,
  lessons,
  noteLinks,
  notes,
  projects,
  tags,
  tasks,
} from "@/db/schema";

export type GraphEntityType =
  | "note"
  | "project"
  | "course"
  | "lesson"
  | "bookmark"
  | "snippet"
  | "task"
  | "reference";

export interface GraphNode {
  key: string; // `${entityType}:${entityId}`
  entityType: GraphEntityType;
  entityId: string;
  title: string;
  description: string | null;
  href: string;
  isFavorite: boolean;
  tags: string[];
  inDegree: number;
  outDegree: number;
  positionX: number | null;
  positionY: number | null;
  isPinned: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: string;
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
  preferences: {
    layoutConfig: {
      chargeStrength?: number;
      linkDistance?: number;
      includeTasks?: boolean;
    };
    filterConfig: {
      entityTypes?: string[];
      favoritesOnly?: boolean;
    };
  };
  availableTags: string[];
  truncated: boolean;
}

export function makeNodeKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export function extractLocalSubgraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  centerKey: string,
  depth: 1 | 2 | 3
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodeMap = new Map(nodes.map((n) => [n.key, n]));
  if (!nodeMap.has(centerKey)) {
    return { nodes: [], edges: [] };
  }

  const visited = new Set<string>([centerKey]);
  let frontier = new Set<string>([centerKey]);

  for (let level = 0; level < depth; level++) {
    const nextFrontier = new Set<string>();
    for (const edge of edges) {
      if (frontier.has(edge.source) && !visited.has(edge.target) && nodeMap.has(edge.target)) {
        visited.add(edge.target);
        nextFrontier.add(edge.target);
      }
      if (frontier.has(edge.target) && !visited.has(edge.source) && nodeMap.has(edge.source)) {
        visited.add(edge.source);
        nextFrontier.add(edge.source);
      }
    }
    frontier = nextFrontier;
    if (frontier.size === 0) break;
  }

  const subNodes = Array.from(visited)
    .map((k) => nodeMap.get(k))
    .filter((n): n is GraphNode => Boolean(n));
  const subEdges = edges.filter((e) => visited.has(e.source) && visited.has(e.target));

  return { nodes: subNodes, edges: subEdges };
}

export async function getGlobalGraph(params: {
  userId: string;
  workspaceId: string;
  includeTasks?: boolean;
  types?: GraphEntityType[];
  tag?: string;
  projectId?: string;
  courseId?: string;
  noteId?: string;
  isolatedOnly?: boolean;
  favoritesOnly?: boolean;
  search?: string;
  limit?: number;
}): Promise<GraphPayload> {
  const limit = Math.min(Math.max(params.limit ?? 300, 10), 1000);

  return withUserRls(params.userId, async (tx) => {
    const [
      noteRows,
      projectRows,
      courseRows,
      moduleRows,
      lessonRows,
      bookmarkRows,
      snippetRows,
      referenceRows,
      taskRows,
      noteLinkRows,
      relationRows,
      learningLinkRows,
      tagRows,
      positionRows,
      prefRows,
    ] = await Promise.all([
      tx
        .select({
          id: notes.id,
          title: notes.title,
          contentText: notes.contentText,
          projectId: notes.projectId,
          isFavorite: notes.isFavorite,
        })
        .from(notes)
        .where(
          and(
            eq(notes.userId, params.userId),
            eq(notes.workspaceId, params.workspaceId),
            isNull(notes.deletedAt),
            eq(notes.isArchived, false)
          )
        )
        .orderBy(desc(notes.updatedAt))
        .limit(limit),
      tx
        .select({
          id: projects.id,
          name: projects.name,
          description: projects.description,
        })
        .from(projects)
        .where(
          and(eq(projects.userId, params.userId), eq(projects.workspaceId, params.workspaceId))
        )
        .orderBy(desc(projects.updatedAt))
        .limit(150),
      tx
        .select({
          id: courses.id,
          title: courses.title,
          description: courses.description,
        })
        .from(courses)
        .where(
          and(eq(courses.userId, params.userId), eq(courses.workspaceId, params.workspaceId))
        )
        .orderBy(desc(courses.updatedAt))
        .limit(150),
      tx
        .select({
          id: courseModules.id,
          courseId: courseModules.courseId,
        })
        .from(courseModules)
        .where(eq(courseModules.userId, params.userId)),
      tx
        .select({
          id: lessons.id,
          moduleId: lessons.moduleId,
          title: lessons.title,
          description: lessons.description,
        })
        .from(lessons)
        .where(eq(lessons.userId, params.userId))
        .limit(200),
      tx
        .select({
          id: bookmarks.id,
          title: bookmarks.title,
          description: bookmarks.description,
          domain: bookmarks.domain,
          isFavorite: bookmarks.isFavorite,
        })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, params.userId),
            eq(bookmarks.workspaceId, params.workspaceId),
            isNull(bookmarks.archivedAt)
          )
        )
        .orderBy(desc(bookmarks.updatedAt))
        .limit(limit),
      tx
        .select({
          id: developerSnippets.id,
          title: developerSnippets.title,
          description: developerSnippets.description,
          language: developerSnippets.language,
          projectId: developerSnippets.projectId,
          sourceNoteId: developerSnippets.sourceNoteId,
          isFavorite: developerSnippets.isFavorite,
        })
        .from(developerSnippets)
        .where(
          and(
            eq(developerSnippets.userId, params.userId),
            eq(developerSnippets.workspaceId, params.workspaceId)
          )
        )
        .orderBy(desc(developerSnippets.updatedAt))
        .limit(limit),
      tx
        .select({
          id: developerReferences.id,
          title: developerReferences.title,
          technology: developerReferences.technology,
          description: developerReferences.description,
          projectId: developerReferences.projectId,
        })
        .from(developerReferences)
        .where(
          and(
            eq(developerReferences.userId, params.userId),
            eq(developerReferences.workspaceId, params.workspaceId)
          )
        )
        .limit(150),
      params.includeTasks
        ? tx
            .select({
              id: tasks.id,
              title: tasks.title,
              description: tasks.description,
              projectId: tasks.projectId,
            })
            .from(tasks)
            .where(
              and(eq(tasks.userId, params.userId), eq(tasks.workspaceId, params.workspaceId))
            )
            .orderBy(desc(tasks.updatedAt))
            .limit(200)
        : Promise.resolve([]),
      tx
        .select({
          sourceNoteId: noteLinks.sourceNoteId,
          targetNoteId: noteLinks.targetNoteId,
        })
        .from(noteLinks)
        .where(eq(noteLinks.userId, params.userId)),
      tx
        .select()
        .from(entityRelations)
        .where(eq(entityRelations.userId, params.userId)),
      tx
        .select()
        .from(learningResourceLinks)
        .where(eq(learningResourceLinks.userId, params.userId)),
      tx
        .select({
          entityType: entityTags.entityType,
          entityId: entityTags.entityId,
          tagName: tags.name,
        })
        .from(entityTags)
        .innerJoin(tags, eq(entityTags.tagId, tags.id))
        .where(
          and(eq(tags.userId, params.userId), eq(tags.workspaceId, params.workspaceId))
        ),
      tx
        .select()
        .from(graphNodePositions)
        .where(eq(graphNodePositions.userId, params.userId)),
      tx
        .select()
        .from(graphPreferences)
        .where(
          and(
            eq(graphPreferences.userId, params.userId),
            eq(graphPreferences.workspaceId, params.workspaceId)
          )
        )
        .limit(1),
    ]);

    const tagsByKey = new Map<string, string[]>();
    const allTagNames = new Set<string>();
    for (const row of tagRows) {
      allTagNames.add(row.tagName);
      const key = makeNodeKey(row.entityType, row.entityId);
      const arr = tagsByKey.get(key) ?? [];
      arr.push(row.tagName);
      tagsByKey.set(key, arr);
    }

    const posByKey = new Map(
      positionRows.map((p) => [makeNodeKey(p.entityType, p.entityId), p])
    );

    const rawNodes: GraphNode[] = [];
    const addNode = (
      entityType: GraphEntityType,
      entityId: string,
      title: string,
      description: string | null,
      href: string,
      isFavorite = false
    ) => {
      const key = makeNodeKey(entityType, entityId);
      const pos = posByKey.get(key);
      rawNodes.push({
        key,
        entityType,
        entityId,
        title,
        description,
        href,
        isFavorite,
        tags: tagsByKey.get(key) ?? [],
        inDegree: 0,
        outDegree: 0,
        positionX: pos?.positionX ?? null,
        positionY: pos?.positionY ?? null,
        isPinned: pos?.isPinned ?? false,
      });
    };

    for (const n of noteRows) {
      addNode(
        "note",
        n.id,
        n.title,
        n.contentText.slice(0, 140) || null,
        `/notes?id=${n.id}`,
        n.isFavorite
      );
    }
    for (const p of projectRows) {
      addNode("project", p.id, p.name, p.description, `/projects?id=${p.id}`, false);
    }
    for (const c of courseRows) {
      addNode("course", c.id, c.title, c.description, `/learning?courseId=${c.id}`, false);
    }
    const moduleToCourse = new Map(moduleRows.map((m) => [m.id, m.courseId]));
    for (const l of lessonRows) {
      const courseId = moduleToCourse.get(l.moduleId);
      addNode(
        "lesson",
        l.id,
        l.title,
        l.description,
        courseId ? `/learning?courseId=${courseId}` : "/learning",
        false
      );
    }
    for (const b of bookmarkRows) {
      addNode(
        "bookmark",
        b.id,
        b.title,
        b.description ?? b.domain,
        `/bookmarks?id=${b.id}`,
        b.isFavorite
      );
    }
    for (const s of snippetRows) {
      addNode(
        "snippet",
        s.id,
        s.title,
        s.description ?? s.language,
        `/developer-hub?tab=snippets&id=${s.id}`,
        s.isFavorite
      );
    }
    for (const r of referenceRows) {
      addNode(
        "reference",
        r.id,
        r.title,
        r.description ?? r.technology,
        `/developer-hub?tab=documentation&id=${r.id}`,
        false
      );
    }
    for (const t of taskRows) {
      addNode("task", t.id, t.title, t.description, `/tasks?taskId=${t.id}`, false);
    }

    const nodeSet = new Set(rawNodes.map((n) => n.key));
    const edgeMap = new Map<string, GraphEdge>();

    const pushEdge = (source: string, target: string, relationType: string) => {
      if (source === target) return;
      if (!nodeSet.has(source) || !nodeSet.has(target)) return;
      const edgeKey = `${source}->${target}:${relationType}`;
      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, {
          id: edgeKey,
          source,
          target,
          relationType,
        });
      }
    };

    for (const nl of noteLinkRows) {
      pushEdge(
        makeNodeKey("note", nl.sourceNoteId),
        makeNodeKey("note", nl.targetNoteId),
        "references"
      );
    }
    for (const n of noteRows) {
      if (n.projectId) {
        pushEdge(
          makeNodeKey("note", n.id),
          makeNodeKey("project", n.projectId),
          "belongs_to"
        );
      }
    }
    for (const l of lessonRows) {
      const courseId = moduleToCourse.get(l.moduleId);
      if (courseId) {
        pushEdge(makeNodeKey("lesson", l.id), makeNodeKey("course", courseId), "belongs_to");
      }
    }
    for (const s of snippetRows) {
      if (s.projectId) {
        pushEdge(
          makeNodeKey("snippet", s.id),
          makeNodeKey("project", s.projectId),
          "belongs_to"
        );
      }
      if (s.sourceNoteId) {
        pushEdge(
          makeNodeKey("snippet", s.id),
          makeNodeKey("note", s.sourceNoteId),
          "derived_from"
        );
      }
    }
    for (const r of referenceRows) {
      if (r.projectId) {
        pushEdge(
          makeNodeKey("reference", r.id),
          makeNodeKey("project", r.projectId),
          "belongs_to"
        );
      }
    }
    for (const t of taskRows) {
      if (t.projectId) {
        pushEdge(makeNodeKey("task", t.id), makeNodeKey("project", t.projectId), "belongs_to");
      }
    }
    for (const rel of relationRows) {
      pushEdge(
        makeNodeKey(rel.sourceType, rel.sourceId),
        makeNodeKey(rel.targetType, rel.targetId),
        rel.relationType
      );
    }
    for (const ll of learningLinkRows) {
      const source = ll.lessonId
        ? makeNodeKey("lesson", ll.lessonId)
        : ll.courseId
          ? makeNodeKey("course", ll.courseId)
          : null;
      if (source && ll.noteId) {
        pushEdge(source, makeNodeKey("note", ll.noteId), "references");
      }
      if (source && ll.taskId) {
        pushEdge(source, makeNodeKey("task", ll.taskId), "references");
      }
    }

    const allEdges = Array.from(edgeMap.values());

    // Apply filters
    let filteredNodes = rawNodes;
    if (params.types && params.types.length > 0) {
      const typeSet = new Set(params.types);
      filteredNodes = filteredNodes.filter((n) => typeSet.has(n.entityType));
    }
    if (params.tag) {
      const tagNeedle = params.tag.toLowerCase();
      filteredNodes = filteredNodes.filter((n) => n.tags.includes(tagNeedle));
    }
    if (params.favoritesOnly) {
      filteredNodes = filteredNodes.filter((n) => n.isFavorite);
    }
    if (params.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      filteredNodes = filteredNodes.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.description ?? "").toLowerCase().includes(q)
      );
    }
    if (params.projectId) {
      const center = makeNodeKey("project", params.projectId);
      const sub = extractLocalSubgraph(filteredNodes, allEdges, center, 2);
      filteredNodes = sub.nodes;
    }
    if (params.courseId) {
      const center = makeNodeKey("course", params.courseId);
      const sub = extractLocalSubgraph(filteredNodes, allEdges, center, 2);
      filteredNodes = sub.nodes;
    }
    if (params.noteId) {
      const center = makeNodeKey("note", params.noteId);
      const sub = extractLocalSubgraph(filteredNodes, allEdges, center, 2);
      filteredNodes = sub.nodes;
    }

    const filteredSet = new Set(filteredNodes.map((n) => n.key));
    const filteredEdges = allEdges.filter(
      (e) => filteredSet.has(e.source) && filteredSet.has(e.target)
    );

    const nodeByKey = new Map(filteredNodes.map((n) => [n.key, n]));
    for (const e of filteredEdges) {
      const s = nodeByKey.get(e.source);
      const t = nodeByKey.get(e.target);
      if (s) s.outDegree += 1;
      if (t) t.inDegree += 1;
    }

    if (params.isolatedOnly) {
      filteredNodes = filteredNodes.filter((n) => n.inDegree === 0 && n.outDegree === 0);
    }

    const prefs = prefRows[0];

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      preferences: {
        layoutConfig: prefs?.layoutConfig ?? {
          chargeStrength: 240,
          linkDistance: 95,
          includeTasks: false,
        },
        filterConfig: prefs?.filterConfig ?? {},
      },
      availableTags: Array.from(allTagNames).sort(),
      truncated: rawNodes.length >= limit,
    };
  });
}

export async function getLocalGraph(params: {
  userId: string;
  workspaceId: string;
  entityType: GraphEntityType;
  entityId: string;
  depth: 1 | 2 | 3;
}) {
  const full = await getGlobalGraph({
    userId: params.userId,
    workspaceId: params.workspaceId,
    includeTasks: false,
    limit: 500,
  });
  const centerKey = makeNodeKey(params.entityType, params.entityId);
  return extractLocalSubgraph(full.nodes, full.edges, centerKey, params.depth);
}

export async function saveNodePosition(
  userId: string,
  input: {
    entityType: GraphEntityType;
    entityId: string;
    positionX: number;
    positionY: number;
    isPinned?: boolean;
  }
) {
  return withUserRls(userId, async (tx) => {
    const existing = await tx
      .select({ id: graphNodePositions.id })
      .from(graphNodePositions)
      .where(
        and(
          eq(graphNodePositions.userId, userId),
          eq(graphNodePositions.entityType, input.entityType),
          eq(graphNodePositions.entityId, input.entityId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await tx
        .update(graphNodePositions)
        .set({
          positionX: input.positionX,
          positionY: input.positionY,
          ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
          updatedAt: new Date(),
        })
        .where(eq(graphNodePositions.id, existing[0]!.id))
        .returning();
      return updated!;
    }

    const [created] = await tx
      .insert(graphNodePositions)
      .values({
        userId,
        entityType: input.entityType,
        entityId: input.entityId,
        positionX: input.positionX,
        positionY: input.positionY,
        isPinned: input.isPinned ?? true,
      })
      .returning();

    return created!;
  });
}

export async function resetNodePositions(userId: string) {
  return withUserRls(userId, async (tx) => {
    await tx.delete(graphNodePositions).where(eq(graphNodePositions.userId, userId));
    return { reset: true };
  });
}

export async function saveGraphPreferences(
  userId: string,
  workspaceId: string,
  input: {
    layoutConfig?: {
      chargeStrength?: number;
      linkDistance?: number;
      includeTasks?: boolean;
    };
    filterConfig?: {
      entityTypes?: string[];
      favoritesOnly?: boolean;
    };
  }
) {
  return withUserRls(userId, async (tx) => {
    const existing = await tx
      .select()
      .from(graphPreferences)
      .where(
        and(
          eq(graphPreferences.userId, userId),
          eq(graphPreferences.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const current = existing[0]!;
      const [updated] = await tx
        .update(graphPreferences)
        .set({
          layoutConfig: input.layoutConfig
            ? { ...current.layoutConfig, ...input.layoutConfig }
            : current.layoutConfig,
          filterConfig: input.filterConfig
            ? { ...current.filterConfig, ...input.filterConfig }
            : current.filterConfig,
          updatedAt: new Date(),
        })
        .where(eq(graphPreferences.id, current.id))
        .returning();
      return updated!;
    }

    const [created] = await tx
      .insert(graphPreferences)
      .values({
        userId,
        workspaceId,
        layoutConfig: input.layoutConfig ?? {
          chargeStrength: 240,
          linkDistance: 95,
          includeTasks: false,
        },
        filterConfig: input.filterConfig ?? {},
      })
      .returning();

    return created!;
  });
}

export async function getRelatedNotesByTagsOrProject(
  userId: string,
  workspaceId: string,
  noteId: string
) {
  return withUserRls(userId, async (tx) => {
    const [noteRow] = await tx
      .select({ id: notes.id, projectId: notes.projectId })
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .limit(1);
    if (!noteRow) return [];

    const noteTags = await tx
      .select({ tagId: entityTags.tagId })
      .from(entityTags)
      .where(and(eq(entityTags.entityType, "note"), eq(entityTags.entityId, noteId)));

    const candidateIds = new Set<string>();
    if (noteTags.length > 0) {
      const sharedTagNotes = await tx
        .select({ entityId: entityTags.entityId })
        .from(entityTags)
        .where(
          and(
            eq(entityTags.entityType, "note"),
            inArray(
              entityTags.tagId,
              noteTags.map((t) => t.tagId)
            )
          )
        );
      for (const row of sharedTagNotes) {
        if (row.entityId !== noteId) candidateIds.add(row.entityId);
      }
    }

    if (noteRow.projectId) {
      const projNotes = await tx
        .select({ id: notes.id })
        .from(notes)
        .where(
          and(
            eq(notes.userId, userId),
            eq(notes.workspaceId, workspaceId),
            eq(notes.projectId, noteRow.projectId),
            isNull(notes.deletedAt)
          )
        )
        .limit(10);
      for (const p of projNotes) {
        if (p.id !== noteId) candidateIds.add(p.id);
      }
    }

    if (candidateIds.size === 0) return [];

    return tx
      .select({
        id: notes.id,
        title: notes.title,
        icon: notes.icon,
      })
      .from(notes)
      .where(
        and(
          eq(notes.userId, userId),
          inArray(notes.id, Array.from(candidateIds).slice(0, 8)),
          isNull(notes.deletedAt)
        )
      );
  });
}
