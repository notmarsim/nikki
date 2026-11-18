import { describe, expect, it } from "vitest";
import {
  extractLocalSubgraph,
  makeNodeKey,
  type GraphEdge,
  type GraphNode,
} from "../service";

function node(type: GraphNode["entityType"], id: string): GraphNode {
  return {
    key: makeNodeKey(type, id),
    entityType: type,
    entityId: id,
    title: `${type}-${id}`,
    description: null,
    href: `/${type}s/${id}`,
    isFavorite: false,
    tags: [],
    inDegree: 0,
    outDegree: 0,
    positionX: null,
    positionY: null,
    isPinned: false,
  };
}

describe("Knowledge Graph subgraph extraction", () => {
  const n1 = node("note", "1");
  const n2 = node("note", "2");
  const n3 = node("project", "3");
  const n4 = node("bookmark", "4");
  const n5 = node("snippet", "5");

  const edges: GraphEdge[] = [
    { id: "e1", source: n1.key, target: n2.key, relationType: "references" },
    { id: "e2", source: n2.key, target: n3.key, relationType: "belongs_to" },
    { id: "e3", source: n3.key, target: n4.key, relationType: "references" },
  ];

  it("extracts depth 1 neighbors without unrelated nodes", () => {
    const sub = extractLocalSubgraph([n1, n2, n3, n4, n5], edges, n1.key, 1);
    expect(sub.nodes.map((n) => n.key).sort()).toEqual([n1.key, n2.key].sort());
    expect(sub.edges).toHaveLength(1);
  });

  it("extracts depth 2 and depth 3 neighbors accurately", () => {
    const sub2 = extractLocalSubgraph([n1, n2, n3, n4, n5], edges, n1.key, 2);
    expect(sub2.nodes.map((n) => n.key).sort()).toEqual([n1.key, n2.key, n3.key].sort());

    const sub3 = extractLocalSubgraph([n1, n2, n3, n4, n5], edges, n1.key, 3);
    expect(sub3.nodes.map((n) => n.key).sort()).toEqual(
      [n1.key, n2.key, n3.key, n4.key].sort()
    );
    expect(sub3.nodes.some((n) => n.key === n5.key)).toBe(false);
  });
});
