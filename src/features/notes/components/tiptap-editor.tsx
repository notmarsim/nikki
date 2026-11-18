"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import LinkExtension from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import ImageExtension from "@tiptap/extension-image";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { common, createLowlight } from "lowlight";
import {
  Bold,
  CheckSquare,
  Code,
  Highlighter,
  Italic,
  ListChecks,
  Paperclip,
  Redo2,
  Strikethrough,
  Table2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import type { NoteBlockDocument } from "@/db/schema";
import { CalloutExtension } from "../extensions/callout-extension";
import { MathBlockExtension } from "../extensions/math-extension";
import { MermaidBlockExtension } from "../extensions/mermaid-extension";
import { ToggleExtension } from "../extensions/toggle-extension";
import { WikiLinkExtension } from "../extensions/wiki-link-extension";
import "katex/dist/katex.min.css";

const lowlight = createLowlight(common);

interface LinkableNote {
  id: string;
  title: string;
  icon: string | null;
}

interface TiptapEditorProps {
  noteId: string;
  initialContent: NoteBlockDocument;
  linkableNotes: LinkableNote[];
  onChange: (doc: NoteBlockDocument) => void;
  onConvertSelectionToTask: (text: string) => Promise<void>;
}

interface SlashCommandItem {
  id: string;
  label: string;
  keywords: string;
  run: (editor: NonNullable<ReturnType<typeof useEditor>>) => void;
}

export function TiptapEditor({
  noteId,
  initialContent,
  linkableNotes,
  onChange,
  onConvertSelectionToTask,
}: TiptapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [wikiQuery, setWikiQuery] = useState<string | null>(null);
  const [wikiIndex, setWikiIndex] = useState(0);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands, '[[' to link a page...",
      }),
      Underline,
      Highlight,
      TextStyle,
      Color,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-[var(--accent)] underline cursor-pointer" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({ lowlight }),
      ImageExtension,
      CalloutExtension,
      ToggleExtension,
      MathBlockExtension,
      MermaidBlockExtension,
      WikiLinkExtension,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[420px] focus:outline-none px-1 py-2",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON();
      onChange({
        version: 1,
        type: "doc",
        content: (json.content ?? []) as NoteBlockDocument["content"],
      });

      const { from } = ed.state.selection;
      const textBefore = ed.state.doc.textBetween(Math.max(0, from - 40), from, "\n");

      const slashMatch = textBefore.match(/\/([a-zA-Z0-9_-]*)$/);
      if (slashMatch) {
        setSlashQuery(slashMatch[1] ?? "");
        setSlashIndex(0);
      } else {
        setSlashQuery(null);
      }

      const wikiMatch = textBefore.match(/\[\[([^\]]*)$/);
      if (wikiMatch) {
        setWikiQuery(wikiMatch[1] ?? "");
        setWikiIndex(0);
      } else {
        setWikiQuery(null);
      }
    },
  });

  useEffect(() => {
    if (!editor) return;
    // Reset editor when switching to a different note
    editor.commands.setContent(initialContent, false);
    setSlashQuery(null);
    setWikiQuery(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, editor]);

  const slashCommands: SlashCommandItem[] = useMemo(
    () => [
      {
        id: "h1",
        label: "Heading 1",
        keywords: "heading h1 title",
        run: (ed) => ed.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        id: "h2",
        label: "Heading 2",
        keywords: "heading h2 subtitle",
        run: (ed) => ed.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        id: "h3",
        label: "Heading 3",
        keywords: "heading h3",
        run: (ed) => ed.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        id: "todo",
        label: "Checklist / To-do",
        keywords: "todo checklist task",
        run: (ed) => ed.chain().focus().toggleTaskList().run(),
      },
      {
        id: "bullet",
        label: "Bullet List",
        keywords: "bullet list ul",
        run: (ed) => ed.chain().focus().toggleBulletList().run(),
      },
      {
        id: "ordered",
        label: "Numbered List",
        keywords: "numbered ordered list ol",
        run: (ed) => ed.chain().focus().toggleOrderedList().run(),
      },
      {
        id: "quote",
        label: "Quote",
        keywords: "quote blockquote",
        run: (ed) => ed.chain().focus().toggleBlockquote().run(),
      },
      {
        id: "callout",
        label: "Callout",
        keywords: "callout info note",
        run: (ed) =>
          ed
            .chain()
            .focus()
            .insertContent({
              type: "callout",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Callout note..." }] }],
            })
            .run(),
      },
      {
        id: "toggle",
        label: "Toggle / Collapsible",
        keywords: "toggle collapse details",
        run: (ed) =>
          ed
            .chain()
            .focus()
            .insertContent({
              type: "toggleBlock",
              attrs: { summary: "Click to expand" },
              content: [{ type: "paragraph", content: [{ type: "text", text: "Hidden details..." }] }],
            })
            .run(),
      },
      {
        id: "code",
        label: "Code Block",
        keywords: "code snippet",
        run: (ed) => ed.chain().focus().toggleCodeBlock().run(),
      },
      {
        id: "table",
        label: "Table (3×3)",
        keywords: "table grid",
        run: (ed) =>
          ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
      {
        id: "mermaid",
        label: "Mermaid Diagram",
        keywords: "mermaid diagram chart",
        run: (ed) =>
          ed.chain().focus().insertContent({ type: "mermaidBlock" }).run(),
      },
      {
        id: "math",
        label: "Math (KaTeX LaTeX)",
        keywords: "math latex katex formula",
        run: (ed) =>
          ed.chain().focus().insertContent({ type: "mathBlock" }).run(),
      },
      {
        id: "divider",
        label: "Divider",
        keywords: "divider hr line",
        run: (ed) => ed.chain().focus().setHorizontalRule().run(),
      },
      {
        id: "image",
        label: "Upload Image / File",
        keywords: "image file upload attachment",
        run: () => fileInputRef.current?.click(),
      },
    ],
    []
  );

  const filteredSlash = useMemo(() => {
    if (slashQuery === null) return [];
    const q = slashQuery.toLowerCase();
    return slashCommands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) || cmd.keywords.toLowerCase().includes(q)
    );
  }, [slashQuery, slashCommands]);

  const filteredWiki = useMemo(() => {
    if (wikiQuery === null) return [];
    const q = wikiQuery.toLowerCase();
    return linkableNotes
      .filter((n) => n.id !== noteId && n.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [wikiQuery, linkableNotes, noteId]);

  const executeSlash = (cmd: SlashCommandItem) => {
    if (!editor || slashQuery === null) return;
    const { from } = editor.state.selection;
    editor
      .chain()
      .focus()
      .deleteRange({ from: from - slashQuery.length - 1, to: from })
      .run();
    cmd.run(editor);
    setSlashQuery(null);
  };

  const insertWikiLink = (target: LinkableNote) => {
    if (!editor || wikiQuery === null) return;
    const { from } = editor.state.selection;
    editor
      .chain()
      .focus()
      .deleteRange({ from: from - wikiQuery.length - 2, to: from })
      .insertContent({
        type: "wikiLink",
        attrs: { noteId: target.id, label: target.title },
      })
      .insertContent(" ")
      .run();
    setWikiQuery(null);
  };

  const handleFileUpload = async (file: File) => {
    if (!editor) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("noteId", noteId);

      const res = await fetch("/api/notes/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) return;

      const url: string = json.data.url;
      if (file.type.startsWith("image/")) {
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      } else {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "text",
            marks: [{ type: "link", attrs: { href: url } }],
            text: `📎 ${file.name}`,
          })
          .run();
      }
    } finally {
      setUploading(false);
    }
  };

  const handleConvertToTask = async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    let selectedText = editor.state.doc.textBetween(from, to, " ").trim();
    if (!selectedText) {
      const $from = editor.state.selection.$from;
      selectedText = $from.parent.textContent.trim();
    }
    if (!selectedText) return;
    await onConvertSelectionToTask(selectedText);
  };

  if (!editor) return null;

  return (
    <div
      className="relative space-y-2"
      onKeyDown={(e) => {
        if (slashQuery !== null && filteredSlash.length > 0) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSlashIndex((i) => (i + 1) % filteredSlash.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSlashIndex((i) => (i - 1 + filteredSlash.length) % filteredSlash.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            const chosen = filteredSlash[slashIndex];
            if (chosen) executeSlash(chosen);
          } else if (e.key === "Escape") {
            setSlashQuery(null);
          }
        } else if (wikiQuery !== null && filteredWiki.length > 0) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setWikiIndex((i) => (i + 1) % filteredWiki.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setWikiIndex((i) => (i - 1 + filteredWiki.length) % filteredWiki.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            const chosen = filteredWiki[wikiIndex];
            if (chosen) insertWikiLink(chosen);
          } else if (e.key === "Escape") {
            setWikiQuery(null);
          }
        }
      }}
    >
      {/* Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/60 p-1.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded p-1.5 hover:bg-[var(--surface)] ${editor.isActive("bold") ? "bg-[var(--surface)] text-[var(--accent)]" : ""}`}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded p-1.5 hover:bg-[var(--surface)] ${editor.isActive("italic") ? "bg-[var(--surface)] text-[var(--accent)]" : ""}`}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`rounded p-1.5 hover:bg-[var(--surface)] ${editor.isActive("underline") ? "bg-[var(--surface)] text-[var(--accent)]" : ""}`}
          title="Underline"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`rounded p-1.5 hover:bg-[var(--surface)] ${editor.isActive("strike") ? "bg-[var(--surface)] text-[var(--accent)]" : ""}`}
          title="Strikethrough"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`rounded p-1.5 hover:bg-[var(--surface)] ${editor.isActive("code") ? "bg-[var(--surface)] text-[var(--accent)]" : ""}`}
          title="Inline Code"
        >
          <Code className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={`rounded p-1.5 hover:bg-[var(--surface)] ${editor.isActive("highlight") ? "bg-[var(--surface)] text-[var(--accent)]" : ""}`}
          title="Highlight"
        >
          <Highlighter className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`rounded p-1.5 hover:bg-[var(--surface)] ${editor.isActive("taskList") ? "bg-[var(--surface)] text-[var(--accent)]" : ""}`}
          title="Checklist"
        >
          <ListChecks className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
          className="rounded p-1.5 hover:bg-[var(--surface)]"
          title="Insert Table"
        >
          <Table2 className="h-3.5 w-3.5" />
        </button>

        {editor.isActive("table") && (
          <div className="flex items-center gap-1 border-l border-[var(--border)] pl-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className="rounded px-1.5 py-0.5 hover:bg-[var(--surface)]"
            >
              +Row
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className="rounded px-1.5 py-0.5 hover:bg-[var(--surface)]"
            >
              +Col
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteTable().run()}
              className="rounded px-1.5 py-0.5 text-red-500 hover:bg-[var(--surface)]"
            >
              Del Table
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-[var(--surface)]"
            title="Upload image or file"
          >
            <Paperclip className="h-3.5 w-3.5" />
            {uploading ? "Uploading..." : "Attach"}
          </button>

          <button
            type="button"
            onClick={handleConvertToTask}
            className="inline-flex items-center gap-1 rounded bg-[var(--primary)] px-2 py-1 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90"
            title="Create a Task from selected text or current line"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            To Task
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            className="rounded p-1.5 hover:bg-[var(--surface)]"
            title="Undo"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            className="rounded p-1.5 hover:bg-[var(--surface)]"
            title="Redo"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          e.target.value = "";
        }}
      />

      {/* Editor Surface */}
      <EditorContent editor={editor} />

      {/* Slash Command Menu */}
      {slashQuery !== null && filteredSlash.length > 0 && (
        <div className="absolute left-4 top-16 z-30 w-64 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Insert Block
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredSlash.map((cmd, idx) => (
              <button
                key={cmd.id}
                type="button"
                onClick={() => executeSlash(cmd)}
                className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs ${
                  idx === slashIndex
                    ? "bg-[var(--surface-muted)] font-medium text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                {cmd.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* WikiLink Autocomplete Menu */}
      {wikiQuery !== null && (
        <div className="absolute left-4 top-16 z-30 w-64 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Link to Page [[...]]
          </div>
          {filteredWiki.length === 0 ? (
            <div className="px-2.5 py-2 text-xs text-[var(--muted-foreground)]">
              No matching pages
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              {filteredWiki.map((target, idx) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => insertWikiLink(target)}
                  className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs ${
                    idx === wikiIndex
                      ? "bg-[var(--surface-muted)] font-medium text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  {target.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
