import { describe, expect, it } from "vitest";
import {
  extractPlainText,
  extractWikiLinkIds,
  wouldCreateHierarchyCycle,
} from "../utils";

describe("notes utils", () => {
  it("extracts plain text from structured block document", () => {
    const text = extractPlainText({
      version: 1,
      type: "doc",
      content: [
        { type: "heading", content: [{ type: "text", text: "Architecture" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "See " },
            {
              type: "wikiLink",
              attrs: { noteId: "11111111-1111-4111-8111-111111111111", label: "Specs" },
            },
          ],
        },
      ],
    });
    expect(text).toBe("Architecture See Specs");
  });

  it("extracts unique valid UUIDs from wikiLink nodes", () => {
    const id1 = "11111111-1111-4111-8111-111111111111";
    const id2 = "22222222-2222-4222-8222-222222222222";
    const ids = extractWikiLinkIds({
      version: 1,
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "wikiLink", attrs: { noteId: id1, label: "One" } },
            { type: "wikiLink", attrs: { noteId: id1, label: "One Again" } },
            { type: "wikiLink", attrs: { noteId: id2, label: "Two" } },
            { type: "wikiLink", attrs: { noteId: "not-a-uuid", label: "Bad" } },
          ],
        },
      ],
    });
    expect(ids).toEqual([id1, id2]);
  });

  it("detects direct and transitive hierarchy cycles", () => {
    const tree = [
      { id: "a", parentId: null },
      { id: "b", parentId: "a" },
      { id: "c", parentId: "b" },
      { id: "d", parentId: null },
    ];

    expect(wouldCreateHierarchyCycle(tree, "a", "a")).toBe(true);
    expect(wouldCreateHierarchyCycle(tree, "a", "c")).toBe(true);
    expect(wouldCreateHierarchyCycle(tree, "c", "a")).toBe(false);
    expect(wouldCreateHierarchyCycle(tree, "a", "d")).toBe(false);
    expect(wouldCreateHierarchyCycle(tree, "b", null)).toBe(false);
  });
});
