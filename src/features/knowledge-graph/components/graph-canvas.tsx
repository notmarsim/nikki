"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GraphEdge, GraphNode } from "@/modules/graph/utils";

export const NODE_CATEGORY_STYLE: Record<
  string,
  { color: string; label: string; glyph: string }
> = {
  note: { color: "#3b82f6", label: "Notes", glyph: "N" },
  project: { color: "#a855f7", label: "Projects", glyph: "P" },
  course: { color: "#22c55e", label: "Courses", glyph: "C" },
  lesson: { color: "#10b981", label: "Lessons", glyph: "L" },
  bookmark: { color: "#f97316", label: "Bookmarks", glyph: "B" },
  snippet: { color: "#06b6d4", label: "Snippets", glyph: "S" },
  reference: { color: "#eab308", label: "Docs", glyph: "D" },
  task: { color: "#64748b", label: "Tasks", glyph: "T" },
};

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function GraphCanvas({
  nodes,
  edges,
  selectedKey,
  onSelectNode,
  onFocusNode,
  onNodePositionCommit,
  chargeStrength = 240,
  linkDistance = 95,
  compact = false,
  heightClass = "h-[600px]",
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedKey?: string | null;
  onSelectNode?: (node: GraphNode | null) => void;
  onFocusNode?: (node: GraphNode) => void;
  onNodePositionCommit?: (node: GraphNode, x: number, y: number, isPinned: boolean) => void;
  chargeStrength?: number;
  linkDistance?: number;
  compact?: boolean;
  heightClass?: string;
}) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const simRef = useRef<SimNode[]>([]);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [dragState, setDragState] = useState<
    | { kind: "pan"; startX: number; startY: number; origX: number; origY: number }
    | { kind: "node"; key: string; moved: boolean }
    | null
  >(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: GraphNode;
  } | null>(null);

  // Initialize simulation positions
  useEffect(() => {
    const existingMap = new Map(simRef.current.map((n) => [n.key, n]));
    const count = Math.max(nodes.length, 1);
    const radius = compact ? 90 : Math.min(260, 80 + count * 4);
    const initialized: SimNode[] = nodes.map((n, idx) => {
      const prev = existingMap.get(n.key);
      const angle = (idx / count) * Math.PI * 2;
      const x =
        n.positionX ??
        prev?.x ??
        Math.cos(angle) * radius * (0.65 + (idx % 3) * 0.15);
      const y =
        n.positionY ??
        prev?.y ??
        Math.sin(angle) * radius * (0.65 + (idx % 3) * 0.15);
      return {
        ...n,
        x,
        y,
        vx: prev?.vx ?? 0,
        vy: prev?.vy ?? 0,
      };
    });
    simRef.current = initialized;
    setSimNodes(initialized);
  }, [nodes, compact]);

  // Run force-directed layout ticks
  useEffect(() => {
    if (simRef.current.length === 0) return;
    let frame = 0;
    let rafId = 0;
    const maxFrames = compact ? 90 : 160;

    const tick = () => {
      const arr = simRef.current;
      const len = arr.length;
      const idxMap = new Map(arr.map((n, i) => [n.key, i]));

      // Repulsion (O(N^2) bounded for <= 500 nodes)
      const repulse = chargeStrength;
      for (let i = 0; i < len; i++) {
        const a = arr[i]!;
        if (a.isPinned) continue;
        // Centering gravity
        a.vx += -a.x * 0.012;
        a.vy += -a.y * 0.012;

        for (let j = i + 1; j < len; j++) {
          const b = arr[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy + 16;
          if (distSq > 90000) continue;
          const force = repulse / distSq;
          const fx = dx * force;
          const fy = dy * force;
          if (!a.isPinned) {
            a.vx += fx;
            a.vy += fy;
          }
          if (!b.isPinned) {
            b.vx -= fx;
            b.vy -= fy;
          }
        }
      }

      // Spring attraction along edges
      for (const e of edges) {
        const si = idxMap.get(e.source);
        const ti = idxMap.get(e.target);
        if (si === undefined || ti === undefined) continue;
        const a = arr[si]!;
        const b = arr[ti]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const diff = (dist - linkDistance) * 0.035;
        const fx = (dx / dist) * diff;
        const fy = (dy / dist) * diff;
        if (!a.isPinned) {
          a.vx += fx;
          a.vy += fy;
        }
        if (!b.isPinned) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      for (let i = 0; i < len; i++) {
        const n = arr[i]!;
        if (n.isPinned) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx *= 0.82;
        n.vy *= 0.82;
        n.x += n.vx;
        n.y += n.vy;
      }

      frame++;
      setSimNodes([...arr]);
      if (frame < maxFrames) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [edges, chargeStrength, linkDistance, compact, nodes.length]);

  const nodePosMap = useMemo(
    () => new Map(simNodes.map((n) => [n.key, n])),
    [simNodes]
  );

  const activeFocusKey = hoveredKey ?? selectedKey ?? null;
  const connectedKeys = useMemo(() => {
    const set = new Set<string>();
    if (!activeFocusKey) return set;
    set.add(activeFocusKey);
    for (const e of edges) {
      if (e.source === activeFocusKey) set.add(e.target);
      if (e.target === activeFocusKey) set.add(e.source);
    }
    return set;
  }, [activeFocusKey, edges]);

  const clientToWorld = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const cx = clientX - rect.left - rect.width / 2 - transform.x;
    const cy = clientY - rect.top - rect.height / 2 - transform.y;
    return { x: cx / transform.scale, y: cy / transform.scale };
  };

  const fitToView = () => {
    if (simNodes.length === 0 || !svgRef.current) {
      setTransform({ x: 0, y: 0, scale: 1 });
      return;
    }
    const rect = svgRef.current.getBoundingClientRect();
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const n of simNodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    const w = Math.max(maxX - minX + 100, 120);
    const h = Math.max(maxY - minY + 100, 120);
    const scale = Math.min(Math.max(Math.min(rect.width / w, rect.height / h), 0.3), 1.8);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setTransform({ x: -cx * scale, y: -cy * scale, scale });
  };

  const hoveredNode = hoveredKey ? nodePosMap.get(hoveredKey) : null;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] ${heightClass}`}
      onClick={() => setContextMenu(null)}
    >
      {/* Zoom / Pan Controls */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)]/90 p-1 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() =>
            setTransform((t) => ({ ...t, scale: Math.min(t.scale * 1.2, 3) }))
          }
          className="rounded px-2 py-0.5 text-xs font-medium hover:bg-[var(--surface-muted)]"
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() =>
            setTransform((t) => ({ ...t, scale: Math.max(t.scale / 1.2, 0.25) }))
          }
          className="rounded px-2 py-0.5 text-xs font-medium hover:bg-[var(--surface-muted)]"
          title="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={fitToView}
          className="rounded px-2 py-0.5 text-xs font-medium hover:bg-[var(--surface-muted)]"
          title="Fit graph"
        >
          Fit
        </button>
        <button
          type="button"
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
          className="rounded px-2 py-0.5 text-xs font-medium hover:bg-[var(--surface-muted)]"
          title="Center view"
        >
          Center
        </button>
      </div>

      {/* Hover Tooltip */}
      {hoveredNode && !compact && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-xs rounded-lg border border-[var(--border)] bg-[var(--surface)]/95 px-3 py-2 text-xs shadow-md">
          <div className="flex items-center gap-1.5 font-semibold">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                backgroundColor:
                  NODE_CATEGORY_STYLE[hoveredNode.entityType]?.color ?? "#64748b",
              }}
            />
            <span className="truncate">{hoveredNode.title}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)] capitalize">
            {hoveredNode.entityType} · {hoveredNode.inDegree + hoveredNode.outDegree} connections
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        className="h-full w-full cursor-grab active:cursor-grabbing select-none"
        onWheel={(e) => {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.1 : 0.9;
          setTransform((t) => ({
            ...t,
            scale: Math.min(Math.max(t.scale * factor, 0.2), 3.5),
          }));
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          setContextMenu(null);
          setDragState({
            kind: "pan",
            startX: e.clientX,
            startY: e.clientY,
            origX: transform.x,
            origY: transform.y,
          });
        }}
        onPointerMove={(e) => {
          if (!dragState) return;
          if (dragState.kind === "pan") {
            setTransform((t) => ({
              ...t,
              x: dragState.origX + (e.clientX - dragState.startX),
              y: dragState.origY + (e.clientY - dragState.startY),
            }));
          } else if (dragState.kind === "node") {
            const world = clientToWorld(e.clientX, e.clientY);
            const target = simRef.current.find((n) => n.key === dragState.key);
            if (target) {
              target.x = world.x;
              target.y = world.y;
              target.isPinned = true;
              dragState.moved = true;
              setSimNodes([...simRef.current]);
            }
          }
        }}
        onPointerUp={() => {
          if (dragState?.kind === "node" && dragState.moved) {
            const target = simRef.current.find((n) => n.key === dragState.key);
            if (target && onNodePositionCommit) {
              onNodePositionCommit(target, target.x, target.y, true);
            }
          }
          setDragState(null);
        }}
      >
        <g
          transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
          style={{ transformOrigin: "50% 50%" }}
        >
          {/* Shift origin to center of SVG */}
          <g transform="translate(50%, 50%)" />
        </g>
        <GraphViewport
          svgRef={svgRef}
          transform={transform}
          simNodes={simNodes}
          edges={edges}
          nodePosMap={nodePosMap}
          activeFocusKey={activeFocusKey}
          connectedKeys={connectedKeys}
          selectedKey={selectedKey}
          compact={compact}
          onHover={setHoveredKey}
          onDragNode={(key) => setDragState({ kind: "node", key, moved: false })}
          onSelect={(n) => onSelectNode?.(n)}
          onDoubleClick={(n) => router.push(n.href)}
          onContextMenu={(e, n) => {
            e.preventDefault();
            e.stopPropagation();
            const rect = svgRef.current?.getBoundingClientRect();
            setContextMenu({
              x: rect ? e.clientX - rect.left : 20,
              y: rect ? e.clientY - rect.top : 20,
              node: n,
            });
          }}
        />
      </svg>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="absolute z-20 w-44 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 text-xs shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-full rounded px-2.5 py-1.5 text-left hover:bg-[var(--surface-muted)]"
            onClick={() => {
              router.push(contextMenu.node.href);
              setContextMenu(null);
            }}
          >
            Open {contextMenu.node.entityType}
          </button>
          <button
            type="button"
            className="w-full rounded px-2.5 py-1.5 text-left hover:bg-[var(--surface-muted)]"
            onClick={() => {
              navigator.clipboard?.writeText(
                `${window.location.origin}${contextMenu.node.href}`
              );
              setContextMenu(null);
            }}
          >
            Copy Link
          </button>
          <button
            type="button"
            className="w-full rounded px-2.5 py-1.5 text-left hover:bg-[var(--surface-muted)]"
            onClick={() => {
              onSelectNode?.(contextMenu.node);
              setContextMenu(null);
            }}
          >
            View Connections
          </button>
          {onFocusNode && (
            <button
              type="button"
              className="w-full rounded px-2.5 py-1.5 text-left hover:bg-[var(--surface-muted)]"
              onClick={() => {
                onFocusNode(contextMenu.node);
                setContextMenu(null);
              }}
            >
              Focus Node
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function GraphViewport({
  svgRef,
  transform,
  simNodes,
  edges,
  nodePosMap,
  activeFocusKey,
  connectedKeys,
  selectedKey,
  compact,
  onHover,
  onDragNode,
  onSelect,
  onDoubleClick,
  onContextMenu,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>;
  transform: { x: number; y: number; scale: number };
  simNodes: SimNode[];
  edges: GraphEdge[];
  nodePosMap: Map<string, SimNode>;
  activeFocusKey: string | null;
  connectedKeys: Set<string>;
  selectedKey?: string | null;
  compact: boolean;
  onHover: (key: string | null) => void;
  onDragNode: (key: string) => void;
  onSelect: (node: GraphNode) => void;
  onDoubleClick: (node: GraphNode) => void;
  onContextMenu: (e: React.MouseEvent, node: GraphNode) => void;
}) {
  const [size, setSize] = useState({ width: 800, height: 500 });

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setSize({ width: r.width, height: r.height });
      }
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [svgRef]);

  const tx = size.width / 2 + transform.x;
  const ty = size.height / 2 + transform.y;

  return (
    <g transform={`translate(${tx}, ${ty}) scale(${transform.scale})`}>
      {edges.map((edge) => {
        const s = nodePosMap.get(edge.source);
        const t = nodePosMap.get(edge.target);
        if (!s || !t) return null;
        const isHighlighted =
          activeFocusKey &&
          (edge.source === activeFocusKey || edge.target === activeFocusKey);
        const dimmed = Boolean(activeFocusKey && !isHighlighted);
        return (
          <line
            key={edge.id}
            x1={s.x}
            y1={s.y}
            x2={t.x}
            y2={t.y}
            stroke={isHighlighted ? "var(--accent)" : "var(--border)"}
            strokeWidth={isHighlighted ? 2 : 1.1}
            strokeOpacity={dimmed ? 0.18 : isHighlighted ? 0.95 : 0.65}
          />
        );
      })}

      {simNodes.map((n) => {
        const style = NODE_CATEGORY_STYLE[n.entityType] ?? {
          color: "#64748b",
          label: n.entityType,
          glyph: "?",
        };
        const degree = n.inDegree + n.outDegree;
        const radius = compact ? 7 : Math.min(14, 7 + Math.sqrt(degree) * 1.6);
        const isSelected = selectedKey === n.key;
        const isDimmed = Boolean(activeFocusKey && !connectedKeys.has(n.key));

        return (
          <g
            key={n.key}
            transform={`translate(${n.x}, ${n.y})`}
            style={{
              cursor: "pointer",
              opacity: isDimmed ? 0.22 : 1,
              transition: "opacity 120ms ease",
            }}
            onMouseEnter={() => onHover(n.key)}
            onMouseLeave={() => onHover(null)}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (e.button === 0) onDragNode(n.key);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(n);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onDoubleClick(n);
            }}
            onContextMenu={(e) => onContextMenu(e, n)}
          >
            <circle
              r={radius + (isSelected ? 3 : 0)}
              fill={style.color}
              stroke={isSelected ? "var(--foreground)" : "var(--background)"}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            {!compact && (
              <text
                y={0.5}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={8}
                fontWeight={700}
                fill="#ffffff"
                pointerEvents="none"
              >
                {style.glyph}
              </text>
            )}
            {(!compact || isSelected || activeFocusKey === n.key) && (
              <text
                y={radius + 11}
                textAnchor="middle"
                fontSize={compact ? 9 : 10}
                fill="var(--foreground)"
                pointerEvents="none"
                className="font-medium"
              >
                {n.title.length > 22 ? `${n.title.slice(0, 22)}…` : n.title}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
