"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  Network,
  RotateCcw,
  Search,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  extractLocalSubgraph,
  type GraphNode,
  type GraphPayload,
} from "@/modules/graph/utils";
import { GraphCanvas, NODE_CATEGORY_STYLE } from "./graph-canvas";

const ALL_CATEGORIES = [
  "note",
  "project",
  "course",
  "lesson",
  "bookmark",
  "snippet",
  "reference",
  "task",
] as const;

export function KnowledgeGraphWorkspace({
  initialGraph,
}: {
  initialGraph: GraphPayload;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(
    initialGraph.preferences.filterConfig.favoritesOnly ?? false
  );
  const [includeTasks, setIncludeTasks] = useState(
    initialGraph.preferences.layoutConfig.includeTasks ?? false
  );
  const [enabledTypes, setEnabledTypes] = useState<string[]>(
    initialGraph.preferences.filterConfig.entityTypes ?? [
      "note",
      "project",
      "course",
      "lesson",
      "bookmark",
      "snippet",
      "reference",
    ]
  );
  const [chargeStrength, setChargeStrength] = useState(
    initialGraph.preferences.layoutConfig.chargeStrength ?? 240
  );
  const [linkDistance, setLinkDistance] = useState(
    initialGraph.preferences.layoutConfig.linkDistance ?? 95
  );
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [focusedCenterKey, setFocusedCenterKey] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (includeTasks) p.set("includeTasks", "true");
    if (favoritesOnly) p.set("favoritesOnly", "true");
    if (selectedTag) p.set("tag", selectedTag);
    if (search.trim()) p.set("q", search.trim());
    if (enabledTypes.length > 0) p.set("types", enabledTypes.join(","));
    return p.toString();
  }, [includeTasks, favoritesOnly, selectedTag, search, enabledTypes]);

  const { data: graph = initialGraph } = useQuery<GraphPayload>({
    queryKey: ["knowledge-graph", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/graph?${queryParams}`);
      if (!res.ok) throw new Error("Failed to load graph");
      const json = await res.json();
      return json.data;
    },
    initialData: initialGraph,
  });

  const displayed = useMemo(() => {
    if (!focusedCenterKey) return { nodes: graph.nodes, edges: graph.edges };
    return extractLocalSubgraph(graph.nodes, graph.edges, focusedCenterKey, 2);
  }, [graph.nodes, graph.edges, focusedCenterKey]);

  const selectedConnections = useMemo(() => {
    if (!selectedNode) return { incoming: [] as GraphNode[], outgoing: [] as GraphNode[] };
    const byKey = new Map(graph.nodes.map((n) => [n.key, n]));
    const incoming: GraphNode[] = [];
    const outgoing: GraphNode[] = [];
    for (const e of graph.edges) {
      if (e.target === selectedNode.key) {
        const s = byKey.get(e.source);
        if (s) incoming.push(s);
      }
      if (e.source === selectedNode.key) {
        const t = byKey.get(e.target);
        if (t) outgoing.push(t);
      }
    }
    return { incoming, outgoing };
  }, [selectedNode, graph.nodes, graph.edges]);

  const toggleType = (type: string) => {
    setEnabledTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    if (type === "task") {
      setIncludeTasks((prev) => !prev);
    }
  };

  const handleResetLayout = async () => {
    await fetch("/api/graph/positions", { method: "DELETE" });
    setFocusedCenterKey(null);
    queryClient.invalidateQueries({ queryKey: ["knowledge-graph"] });
  };

  const handleSavePrefs = async (nextIncludeTasks: boolean) => {
    await fetch("/api/graph/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        layoutConfig: { chargeStrength, linkDistance, includeTasks: nextIncludeTasks },
        filterConfig: { entityTypes: enabledTypes, favoritesOnly },
      }),
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Network className="h-6 w-6 text-[var(--accent)]" />
            Knowledge Graph
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Explore real connections across Notes, Projects, Courses, Bookmarks, and Snippets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {focusedCenterKey && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFocusedCenterKey(null)}
            >
              Exit Focus Mode
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleResetLayout}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset Layout
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSavePrefs(includeTasks)}
          >
            Save Preferences
          </Button>
        </div>
      </div>

      {/* Filters & Controls */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search nodes..."
                className="pl-8 h-8 text-xs"
              />
            </div>

            {graph.availableTags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="h-8 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
              >
                <option value="">All tags</option>
                {graph.availableTags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setFavoritesOnly((f) => !f)}
              className={`inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-medium ${
                favoritesOnly
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--muted-foreground)]"
              }`}
            >
              <Star className="h-3.5 w-3.5" /> Favorites
            </button>

            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] ml-auto">
              <span>Force</span>
              <input
                type="range"
                min={80}
                max={600}
                value={chargeStrength}
                onChange={(e) => setChargeStrength(Number(e.target.value))}
                className="w-20"
              />
              <span>Distance</span>
              <input
                type="range"
                min={40}
                max={220}
                value={linkDistance}
                onChange={(e) => setLinkDistance(Number(e.target.value))}
                className="w-20"
              />
            </div>
          </div>

          {/* Category Legend / Toggles */}
          <div className="flex flex-wrap items-center gap-1.5">
            {ALL_CATEGORIES.map((cat) => {
              const style = NODE_CATEGORY_STYLE[cat];
              const active = enabledTypes.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleType(cat)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                    active
                      ? "border-[var(--border)] bg-[var(--surface-muted)] font-medium"
                      : "border-transparent opacity-45 hover:opacity-80"
                  }`}
                >
                  <span
                    className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ backgroundColor: style?.color ?? "#64748b" }}
                  >
                    {style?.glyph ?? "?"}
                  </span>
                  {style?.label ?? cat}
                </button>
              );
            })}
            <span className="ml-auto text-xs text-[var(--muted-foreground)]">
              {displayed.nodes.length} nodes · {displayed.edges.length} edges
              {graph.truncated ? " (limit reached)" : ""}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Canvas + Detail Sidebar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={selectedNode ? "lg:col-span-8" : "lg:col-span-12"}>
          {displayed.nodes.length === 0 ? (
            <Card>
              <CardContent className="py-20 text-center text-sm text-[var(--muted-foreground)]">
                No nodes match the current filters. Create Notes, Projects, Bookmarks, or Snippets and link them together.
              </CardContent>
            </Card>
          ) : (
            <GraphCanvas
              nodes={displayed.nodes}
              edges={displayed.edges}
              selectedKey={selectedNode?.key ?? null}
              onSelectNode={setSelectedNode}
              onFocusNode={(n) => setFocusedCenterKey(n.key)}
              onNodePositionCommit={async (n, x, y, isPinned) => {
                await fetch("/api/graph/positions", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    entityType: n.entityType,
                    entityId: n.entityId,
                    positionX: x,
                    positionY: y,
                    isPinned,
                  }),
                });
              }}
              chargeStrength={chargeStrength}
              linkDistance={linkDistance}
            />
          )}
        </div>

        {selectedNode && (
          <Card className="lg:col-span-4 h-fit">
            <CardHeader className="border-b border-[var(--border)] pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Badge variant="outline" className="mb-1.5 capitalize">
                    {selectedNode.entityType}
                  </Badge>
                  <CardTitle className="text-base break-words">
                    {selectedNode.title}
                  </CardTitle>
                </div>
                <Link href={selectedNode.href}>
                  <Button size="sm">
                    <ExternalLink className="h-3.5 w-3.5" /> Open
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              {selectedNode.description && (
                <p className="text-[var(--muted-foreground)] leading-relaxed">
                  {selectedNode.description}
                </p>
              )}

              {selectedNode.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedNode.tags.map((t) => (
                    <Badge key={t} variant="outline">
                      #{t}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--border)] p-2.5 text-center">
                <div>
                  <div className="text-lg font-bold">{selectedConnections.incoming.length}</div>
                  <div className="text-[11px] text-[var(--muted-foreground)]">Incoming</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{selectedConnections.outgoing.length}</div>
                  <div className="text-[11px] text-[var(--muted-foreground)]">Outgoing</div>
                </div>
              </div>

              {selectedConnections.incoming.length > 0 && (
                <div>
                  <div className="mb-1.5 font-semibold uppercase tracking-wider text-[10px] text-[var(--muted-foreground)]">
                    Incoming Connections
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {selectedConnections.incoming.map((n) => (
                      <button
                        key={n.key}
                        type="button"
                        onClick={() => setSelectedNode(n)}
                        className="flex w-full items-center justify-between rounded border border-[var(--border)] px-2.5 py-1.5 text-left hover:bg-[var(--surface-muted)]"
                      >
                        <span className="truncate font-medium">{n.title}</span>
                        <span className="ml-2 shrink-0 text-[10px] text-[var(--muted-foreground)] capitalize">
                          {n.entityType}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedConnections.outgoing.length > 0 && (
                <div>
                  <div className="mb-1.5 font-semibold uppercase tracking-wider text-[10px] text-[var(--muted-foreground)]">
                    Outgoing Connections
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {selectedConnections.outgoing.map((n) => (
                      <button
                        key={n.key}
                        type="button"
                        onClick={() => setSelectedNode(n)}
                        className="flex w-full items-center justify-between rounded border border-[var(--border)] px-2.5 py-1.5 text-left hover:bg-[var(--surface-muted)]"
                      >
                        <span className="truncate font-medium">{n.title}</span>
                        <span className="ml-2 shrink-0 text-[10px] text-[var(--muted-foreground)] capitalize">
                          {n.entityType}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setFocusedCenterKey(selectedNode.key)}
                >
                  Focus Neighborhood
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedNode(null)}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
