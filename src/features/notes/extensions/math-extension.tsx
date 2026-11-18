"use client";

import React, { useMemo, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import katex from "katex";

function MathNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const latex = (node.attrs.latex as string) ?? "E = mc^2";
  const [editing, setEditing] = useState(false);

  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return `<span class="text-red-500 text-xs">Invalid LaTeX</span>`;
    }
  }, [latex]);

  return (
    <NodeViewWrapper
      className={`my-3 rounded-lg border p-3 ${
        selected ? "border-[var(--accent)]" : "border-[var(--border)]"
      } bg-[var(--surface-muted)]/40`}
    >
      <div className="mb-2 flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
        <span>LaTeX Math Block</span>
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="rounded px-1.5 py-0.5 hover:bg-[var(--surface)]"
        >
          {editing ? "Done" : "Edit LaTeX"}
        </button>
      </div>

      {editing ? (
        <textarea
          rows={2}
          value={latex}
          onChange={(e) => updateAttributes({ latex: e.target.value })}
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2 font-mono text-xs"
        />
      ) : (
        <div
          className="overflow-x-auto text-center"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </NodeViewWrapper>
  );
}

export const MathBlockExtension = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      latex: { default: "\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "math-block" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView);
  },
});
