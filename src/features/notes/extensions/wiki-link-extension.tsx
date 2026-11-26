"use client";

import React from "react";
import Link from "next/link";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";

function WikiLinkNodeView({ node }: NodeViewProps) {
  const noteId = node.attrs.noteId as string;
  const label = (node.attrs.label as string) || "Untitled";

  return (
    <NodeViewWrapper as="span" className="inline" contentEditable={false}>
      <Link
        href={`/notes?id=${noteId}`}
        onMouseDown={(e) => e.stopPropagation()}
        className="mx-0.5 inline-flex items-center rounded bg-blue-500/15 px-1.5 py-0.5 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        [[{label}]]
      </Link>
    </NodeViewWrapper>
  );
}

export const WikiLinkExtension = Node.create({
  name: "wikiLink",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      noteId: { default: "" },
      label: { default: "Untitled" },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="wiki-link"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": "wiki-link" }),
      `[[${HTMLAttributes.label ?? "Untitled"}]]`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiLinkNodeView);
  },
});
