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
