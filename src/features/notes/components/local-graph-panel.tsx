"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileText, Network } from "lucide-react";
import type { GraphEdge, GraphNode } from "@/modules/graph/utils";
import { GraphCanvas } from "@/features/knowledge-graph/components/graph-canvas";

interface LocalGraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  relatedNotes: Array<{ id: string; title: string; icon: string | null }>;
}

export function LocalGraphPanel({
  noteId,
  onSelectNote,
}: {
  noteId: string;
  onSelectNote: (id: string) => void;
}) {
  const [depth, setDepth] = useState<1 | 2 | 3>(1);

  const { data } = useQuery<LocalGraphResponse>({
    queryKey: ["local-graph", noteId, depth],
    queryFn: async () => {
      const res = await fetch(
        `/api/graph/local?entityType=note&entityId=${noteId}&depth=${depth}`
      );
      if (!res.ok) throw new Error("Failed to load local graph");
      const json = await res.json();
      return json.data;
    },
    enabled: Boolean(noteId),
  });

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            <Network className="h-3 w-3" /> Local Graph
          </span>
          <div className="flex items-center gap-0.5 rounded border border-[var(--border)] p-0.5 text-[10px]">
            {([1, 2, 3] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setDepth(lvl)}
                className={`rounded px-1.5 py-0.5 ${
                  depth === lvl
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                L{lvl}
              </button>
            ))}
          </div>
        </div>

        {data && data.nodes.length > 0 ? (
          <GraphCanvas
            nodes={data.nodes}
            edges={data.edges}
            selectedKey={`note:${noteId}`}
            compact
            heightClass="h-44"
            chargeStrength={140}
            linkDistance={55}
            onSelectNode={(n) => {
              if (n?.entityType === "note" && n.entityId !== noteId) {
                onSelectNote(n.entityId);
              }
            }}
          />
        ) : (
          <p className="text-xs text-[var(--muted-foreground)]">
            No local connections yet.
          </p>
        )}

        <Link
          href="/knowledge-graph"
          className="mt-1.5 inline-block text-[11px] text-[var(--accent)] hover:underline"
        >
          Open Global Graph →
        </Link>
      </div>

      {data && data.relatedNotes.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Related Notes ({data.relatedNotes.length})
          </div>
          <div className="space-y-1">
            {data.relatedNotes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelectNote(r.id)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs hover:bg-[var(--surface-muted)]"
              >
                <FileText className="h-3 w-3 shrink-0 text-[var(--muted-foreground)]" />
                <span className="truncate">{r.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
