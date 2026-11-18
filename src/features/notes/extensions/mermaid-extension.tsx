"use client";

import React, { useEffect, useId, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import mermaid from "mermaid";

let mermaidInitialized = false;

function MermaidNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const code = (node.attrs.code as string) ?? "graph TD;\n  A[Idea] --> B[Note];";
  const [editing, setEditing] = useState(false);
  const [svg, setSvg] = useState<string>("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const rawId = useId();
  const renderId = `mermaid-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "neutral",
      });
      mermaidInitialized = true;
    }

    let cancelled = false;
    mermaid
      .render(renderId, code)
      .then((res) => {
        if (!cancelled) {
          setSvg(res.svg);
          setRenderError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err.message : "Invalid Mermaid syntax");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, renderId]);

  return (
    <NodeViewWrapper
      className={`my-3 rounded-lg border p-3 ${
        selected ? "border-[var(--accent)]" : "border-[var(--border)]"
      } bg-[var(--surface-muted)]/40`}
    >
      <div className="mb-2 flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
        <span>Mermaid Diagram</span>
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="rounded px-1.5 py-0.5 hover:bg-[var(--surface)]"
        >
          {editing ? "Preview" : "Edit Code"}
        </button>
      </div>

      {editing ? (
        <textarea
          rows={5}
          value={code}
          onChange={(e) => updateAttributes({ code: e.target.value })}
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2 font-mono text-xs"
        />
      ) : renderError ? (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-500">
          {renderError}
        </div>
      ) : (
        <div
          className="flex justify-center overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </NodeViewWrapper>
  );
}

export const MermaidBlockExtension = Node.create({
  name: "mermaidBlock",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      code: {
        default: "graph TD;\n  Note --> Task;\n  Task --> Project;",
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "mermaid-block" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView);
  },
});
