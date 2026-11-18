import { describe, expect, it } from "vitest";
import * as Y from "yjs";

describe("Yjs CRDT collaborative merging", () => {
  it("merges concurrent offline edits from two users without overwriting either", () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    docA.getText("content").insert(0, "Hello ");
    docB.getText("content").insert(0, "Nikki!");

    const updateA = Y.encodeStateAsUpdate(docA);
    const updateB = Y.encodeStateAsUpdate(docB);

    Y.applyUpdate(docA, updateB);
    Y.applyUpdate(docB, updateA);

    const textA = docA.getText("content").toString();
    const textB = docB.getText("content").toString();

    expect(textA).toBe(textB);
    expect(textA).toContain("Hello ");
    expect(textA).toContain("Nikki!");
  });
});
