import type { NoteBlockDocument, NoteBlockNode } from "@/db/schema";

export function extractPlainText(doc: NoteBlockDocument | null | undefined): string {
  if (!doc || !Array.isArray(doc.content)) return "";
  const parts: string[] = [];

  function walk(node: NoteBlockNode) {
    if (typeof node.text === "string" && node.text.length > 0) {
      parts.push(node.text);
    }
    if (node.type === "wikiLink" && typeof node.attrs?.label === "string") {
      parts.push(node.attrs.label);
    }
    if (node.type === "mathBlock" && typeof node.attrs?.latex === "string") {
      parts.push(node.attrs.latex);
    }
    if (node.type === "mermaidBlock" && typeof node.attrs?.code === "string") {
      parts.push(node.attrs.code);
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  for (const node of doc.content) {
    walk(node);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function extractWikiLinkIds(doc: NoteBlockDocument | null | undefined): string[] {
  if (!doc || !Array.isArray(doc.content)) return [];
  const ids = new Set<string>();

  function walk(node: NoteBlockNode) {
    if (node.type === "wikiLink" && typeof node.attrs?.noteId === "string") {
      if (UUID_REGEX.test(node.attrs.noteId)) {
        ids.add(node.attrs.noteId);
      }
    }
    if (Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        if (mark.type === "link" && typeof mark.attrs?.href === "string") {
          const match = mark.attrs.href.match(/^\/notes\?id=([0-9a-f-]{36})$/i);
          if (match?.[1] && UUID_REGEX.test(match[1])) {
            ids.add(match[1]);
          }
        }
      }
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  for (const node of doc.content) {
    walk(node);
  }

  return Array.from(ids);
}

export function wouldCreateHierarchyCycle(
  allNotes: Array<{ id: string; parentId: string | null }>,
  noteId: string,
  targetParentId: string | null
): boolean {
  if (!targetParentId) return false;
  if (targetParentId === noteId) return true;

  const parentById = new Map<string, string | null>();
  for (const item of allNotes) {
    parentById.set(item.id, item.parentId);
  }

  const visited = new Set<string>([noteId]);
  let cursor: string | null = targetParentId;

  while (cursor) {
    if (visited.has(cursor)) {
      return true;
    }
    visited.add(cursor);
    cursor = parentById.get(cursor) ?? null;
  }

  return false;
}
