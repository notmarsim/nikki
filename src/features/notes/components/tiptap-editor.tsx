"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";
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
  ChevronDown,
  Code,
  Highlighter,
  Italic,
  Layers,
  Link2,
  ListChecks,
  Palette,
  Radical,
  RemoveFormatting,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import type { NoteBlockDocument } from "@/db/schema";
import { matchesKeybinding } from "@/lib/keybindings";
import { useUiStore } from "@/stores/ui-store";
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
  onCreateFlashcardFromSelection?: (text: string) => void;
  onSaveSnippetFromCode?: (code: string, language: string) => void;
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
  onCreateFlashcardFromSelection,
  onSaveSnippetFromCode,
}: TiptapEditorProps) {
  const { tr } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const spellcheckEnabled = useUiStore((s) => s.spellcheckEnabled);
  const keybindings = useUiStore((s) => s.keybindings);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [wikiQuery, setWikiQuery] = useState<string | null>(null);
  const [wikiIndex, setWikiIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [bubblePanel, setBubblePanel] = useState<"turnInto" | "color" | "link" | null>(null);
  const [linkInput, setLinkInput] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        code: {
          HTMLAttributes: { spellcheck: "false" },
        },
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands, '[[' to link a page...",
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
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
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: "typescript",
        HTMLAttributes: { spellcheck: "false" },
      }),
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
        spellcheck: spellcheckEnabled ? "true" : "false",
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
    editor.setOptions({
      editorProps: {
        attributes: {
          spellcheck: spellcheckEnabled ? "true" : "false",
          class:
            "prose prose-sm dark:prose-invert max-w-none min-h-[420px] focus:outline-none px-1 py-2",
        },
      },
    });
  }, [editor, spellcheckEnabled]);

  useEffect(() => {
    if (!editor) return;
    // Defer setContent to a microtask so TipTap NodeViews don't trigger flushSync during React commit
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && !editor.isDestroyed) {
        editor.commands.setContent(initialContent, false);
      }
    });
    setSlashQuery(null);
    setWikiQuery(null);
    return () => {
      cancelled = true;
    };
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

  const handleCreateFlashcard = () => {
    if (!editor || !onCreateFlashcardFromSelection) return;
    const { from, to } = editor.state.selection;
    let selectedText = editor.state.doc.textBetween(from, to, " ").trim();
    if (!selectedText) {
      const $from = editor.state.selection.$from;
      selectedText = $from.parent.textContent.trim();
    }
    if (!selectedText) return;
    onCreateFlashcardFromSelection(selectedText);
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
          return;
        }

        if (matchesKeybinding(e, keybindings.bold)) {
          e.preventDefault();
          editor.chain().focus().toggleBold().run();
        } else if (matchesKeybinding(e, keybindings.italic)) {
          e.preventDefault();
          editor.chain().focus().toggleItalic().run();
        } else if (matchesKeybinding(e, keybindings.underline)) {
          e.preventDefault();
          editor.chain().focus().toggleUnderline().run();
        } else if (matchesKeybinding(e, keybindings.strike)) {
          e.preventDefault();
          editor.chain().focus().toggleStrike().run();
        } else if (matchesKeybinding(e, keybindings.code)) {
          e.preventDefault();
          editor.chain().focus().toggleCode().run();
        } else if (matchesKeybinding(e, keybindings.highlight)) {
          e.preventDefault();
          editor.chain().focus().toggleHighlight().run();
        } else if (matchesKeybinding(e, keybindings.checklist)) {
          e.preventDefault();
          editor.chain().focus().toggleTaskList().run();
        } else if (matchesKeybinding(e, keybindings.toTask)) {
          e.preventDefault();
          void handleConvertToTask();
        }
      }}
    >
      {/* Floating BubbleMenu on Text Selection */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{
          duration: 120,
          maxWidth: "none",
          onHide: () => setBubblePanel(null),
        }}
        className="relative flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-2xl"
      >
        <div className="flex flex-wrap items-center gap-0.5">
          {/* Turn Into / Block Type Selector */}
          <button
            type="button"
            onClick={() => setBubblePanel((p) => (p === "turnInto" ? null : "turnInto"))}
            title={tr("Turn into", "Transformar em")}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-[var(--surface-muted)]"
          >
            <span>
              {editor.isActive("heading", { level: 1 })
                ? tr("H1", "T1")
                : editor.isActive("heading", { level: 2 })
                  ? tr("H2", "T2")
                  : editor.isActive("heading", { level: 3 })
                    ? tr("H3", "T3")
                    : editor.isActive("bulletList")
                      ? tr("List", "Lista")
                      : editor.isActive("orderedList")
                        ? tr("Numbered", "Numerada")
                        : editor.isActive("blockquote")
                          ? tr("Quote", "Citação")
                          : tr("Text", "Texto")}
            </span>
            <ChevronDown className="h-3 w-3 opacity-70" />
          </button>

          <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />

          {[
            {
              id: "bold",
              label: tr("Bold", "Negrito"),
              shortcut: keybindings.bold,
              active: editor.isActive("bold"),
              icon: <Bold className="h-3.5 w-3.5" />,
              run: () => editor.chain().focus().toggleBold().run(),
            },
            {
              id: "italic",
              label: tr("Italic", "Itálico"),
              shortcut: keybindings.italic,
              active: editor.isActive("italic"),
              icon: <Italic className="h-3.5 w-3.5" />,
              run: () => editor.chain().focus().toggleItalic().run(),
            },
            {
              id: "underline",
              label: tr("Underline", "Sublinhado"),
              shortcut: keybindings.underline,
              active: editor.isActive("underline"),
              icon: <UnderlineIcon className="h-3.5 w-3.5" />,
              run: () => editor.chain().focus().toggleUnderline().run(),
            },
            {
              id: "strike",
              label: tr("Strikethrough", "Tachado"),
              shortcut: keybindings.strike,
              active: editor.isActive("strike"),
              icon: <Strikethrough className="h-3.5 w-3.5" />,
              run: () => editor.chain().focus().toggleStrike().run(),
            },
            {
              id: "code",
              label: tr("Inline Code", "Código"),
              shortcut: keybindings.code,
              active: editor.isActive("code"),
              icon: <Code className="h-3.5 w-3.5" />,
              run: () => editor.chain().focus().toggleCode().run(),
            },
            {
              id: "checklist",
              label: tr("Checklist", "Lista de tarefas"),
              shortcut: keybindings.checklist,
              active: editor.isActive("taskList"),
              icon: <ListChecks className="h-3.5 w-3.5" />,
              run: () => editor.chain().focus().toggleTaskList().run(),
            },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={btn.run}
              title={`${btn.label} (${btn.shortcut})`}
              aria-label={`${btn.label} (${btn.shortcut})`}
              className={`group relative rounded p-1.5 hover:bg-[var(--surface-muted)] ${
                btn.active ? "bg-[var(--surface-muted)] text-[var(--accent)]" : ""
              }`}
            >
              {btn.icon}
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--foreground)] shadow-md group-hover:block">
                {btn.label} <span className="ml-1 text-[var(--muted-foreground)] font-mono">{btn.shortcut}</span>
              </span>
            </button>
          ))}

          {/* Link */}
          <button
            type="button"
            onClick={() => {
              const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
              setLinkInput(prev);
              setBubblePanel((p) => (p === "link" ? null : "link"));
            }}
            title={tr("Add / Edit Link", "Adicionar / Editar Link")}
            aria-label={tr("Add / Edit Link", "Adicionar / Editar Link")}
            className={`rounded p-1.5 hover:bg-[var(--surface-muted)] ${
              editor.isActive("link") || bubblePanel === "link"
                ? "bg-[var(--surface-muted)] text-[var(--accent)]"
                : ""
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>

          {/* Equation */}
          <button
            type="button"
            onClick={() => {
              const { from, to } = editor.state.selection;
              const selectedText = editor.state.doc.textBetween(from, to, " ").trim();
              editor
                .chain()
                .focus()
                .deleteRange({ from, to })
                .insertContent({
                  type: "mathBlock",
                  attrs: { latex: selectedText || "E = mc^2" },
                })
                .run();
              setBubblePanel(null);
            }}
            title={tr("Convert to Equation (LaTeX)", "Converter em Equação (LaTeX)")}
            aria-label={tr("Convert to Equation (LaTeX)", "Converter em Equação (LaTeX)")}
            className="rounded p-1.5 hover:bg-[var(--surface-muted)]"
          >
            <Radical className="h-3.5 w-3.5" />
          </button>

          {/* Text Color & Highlight Picker */}
          <button
            type="button"
            onClick={() => setBubblePanel((p) => (p === "color" ? null : "color"))}
            title={tr("Text Color & Highlight", "Cor do Texto e Destaque")}
            aria-label={tr("Text Color & Highlight", "Cor do Texto e Destaque")}
            className={`inline-flex items-center gap-0.5 rounded p-1.5 hover:bg-[var(--surface-muted)] ${
              editor.isActive("highlight") || bubblePanel === "color"
                ? "bg-[var(--surface-muted)] text-[var(--accent)]"
                : ""
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            <Highlighter className="h-3 w-3 opacity-80" />
          </button>

          {/* Clear Formatting */}
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetAllMarks().run()}
            title={tr("Clear formatting", "Limpar formatação")}
            aria-label={tr("Clear formatting", "Limpar formatação")}
            className="rounded p-1.5 hover:bg-[var(--surface-muted)]"
          >
            <RemoveFormatting className="h-3.5 w-3.5" />
          </button>

          <div className="mx-1 h-4 w-px bg-[var(--border)]" />

          <button
            type="button"
            onClick={handleConvertToTask}
            title={`${tr("Convert to Task", "Converter em Tarefa")} (${keybindings.toTask})`}
            aria-label={`${tr("Convert to Task", "Converter em Tarefa")} (${keybindings.toTask})`}
            className="group relative inline-flex items-center gap-1 rounded bg-[var(--primary)] px-2 py-1 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {tr("To Task", "Tarefa")}
          </button>

          {onCreateFlashcardFromSelection && (
            <button
              type="button"
              onClick={handleCreateFlashcard}
              title={tr("Create Flashcard from selection", "Criar Flashcard da seleção")}
              aria-label={tr("Create Flashcard from selection", "Criar Flashcard da seleção")}
              className="inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface)]"
            >
              <Layers className="h-3.5 w-3.5" />
              Flashcard
            </button>
          )}
        </div>

        {/* Turn Into Dropdown Panel */}
        {bubblePanel === "turnInto" && (
          <div className="grid grid-cols-2 gap-1 border-t border-[var(--border)] pt-1.5 text-xs">
            {[
              {
                label: tr("Text", "Texto"),
                run: () => editor.chain().focus().setParagraph().run(),
              },
              {
                label: tr("Heading 1 (H1)", "Título 1 (H1)"),
                run: () => editor.chain().focus().setHeading({ level: 1 }).run(),
              },
              {
                label: tr("Heading 2 (H2)", "Título 2 (H2)"),
                run: () => editor.chain().focus().setHeading({ level: 2 }).run(),
              },
              {
                label: tr("Heading 3 (H3)", "Título 3 (H3)"),
                run: () => editor.chain().focus().setHeading({ level: 3 }).run(),
              },
              {
                label: tr("Bullet List", "Lista com marcadores"),
                run: () => editor.chain().focus().toggleBulletList().run(),
              },
              {
                label: tr("Numbered List", "Lista numerada"),
                run: () => editor.chain().focus().toggleOrderedList().run(),
              },
              {
                label: tr("To-do List", "Lista de tarefas"),
                run: () => editor.chain().focus().toggleTaskList().run(),
              },
              {
                label: tr("Quote", "Citação"),
                run: () => editor.chain().focus().toggleBlockquote().run(),
              },
              {
                label: tr("Code Block", "Bloco de código"),
                run: () => editor.chain().focus().toggleCodeBlock().run(),
              },
              {
                label: tr("Callout", "Frase de destaque"),
                run: () => {
                  const { from, to } = editor.state.selection;
                  const txt = editor.state.doc.textBetween(from, to, " ").trim();
                  editor
                    .chain()
                    .focus()
                    .deleteRange({ from, to })
                    .insertContent({
                      type: "callout",
                      content: [{ type: "paragraph", content: [{ type: "text", text: txt || "Note..." }] }],
                    })
                    .run();
                },
              },
              {
                label: tr("Block Equation", "Equação em bloco"),
                run: () => {
                  const { from, to } = editor.state.selection;
                  const txt = editor.state.doc.textBetween(from, to, " ").trim();
                  editor
                    .chain()
                    .focus()
                    .deleteRange({ from, to })
                    .insertContent({
                      type: "mathBlock",
                      attrs: { latex: txt || "E = mc^2" },
                    })
                    .run();
                },
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  item.run();
                  setBubblePanel(null);
                }}
                className="rounded px-2 py-1 text-left hover:bg-[var(--surface-muted)]"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {/* Color & Highlight Picker Panel */}
        {bubblePanel === "color" && (
          <div className="space-y-2 border-t border-[var(--border)] pt-2 text-xs">
            <div>
              <div className="mb-1 font-medium text-[var(--muted-foreground)]">
                {tr("Text color", "Cor do texto")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => editor.chain().focus().unsetColor().run()}
                  className="rounded border border-[var(--border)] px-2 py-0.5 text-[11px] hover:bg-[var(--surface-muted)]"
                >
                  {tr("Default", "Padrão")}
                </button>
                {[
                  { name: tr("Gray", "Cinza"), value: "#9ca3af" },
                  { name: tr("Brown", "Marrom"), value: "#d97706" },
                  { name: tr("Orange", "Laranja"), value: "#f97316" },
                  { name: tr("Yellow", "Amarelo"), value: "#eab308" },
                  { name: tr("Green", "Verde"), value: "#22c55e" },
                  { name: tr("Blue", "Azul"), value: "#3b82f6" },
                  { name: tr("Purple", "Roxo"), value: "#a855f7" },
                  { name: tr("Pink", "Rosa"), value: "#ec4899" },
                  { name: tr("Red", "Vermelho"), value: "#ef4444" },
                ].map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.name}
                    onClick={() => editor.chain().focus().setColor(c.value).run()}
                    className="flex h-6 w-6 items-center justify-center rounded border border-[var(--border)] font-bold hover:scale-110 transition-transform"
                    style={{ color: c.value }}
                  >
                    A
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 font-medium text-[var(--muted-foreground)]">
                {tr("Highlight color", "Cor do destaque")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => editor.chain().focus().unsetHighlight().run()}
                  className="rounded border border-[var(--border)] px-2 py-0.5 text-[11px] hover:bg-[var(--surface-muted)]"
                >
                  {tr("None", "Nenhum")}
                </button>
                {[
                  { name: tr("Yellow", "Amarelo"), value: "rgba(250, 204, 21, 0.35)" },
                  { name: tr("Green", "Verde"), value: "rgba(34, 197, 94, 0.3)" },
                  { name: tr("Blue", "Azul"), value: "rgba(59, 130, 246, 0.3)" },
                  { name: tr("Purple", "Roxo"), value: "rgba(168, 85, 247, 0.3)" },
                  { name: tr("Pink", "Rosa"), value: "rgba(236, 72, 153, 0.3)" },
                  { name: tr("Red", "Vermelho"), value: "rgba(239, 68, 68, 0.3)" },
                  { name: tr("Orange", "Laranja"), value: "rgba(249, 115, 22, 0.3)" },
                  { name: tr("Gray", "Cinza"), value: "rgba(156, 163, 175, 0.3)" },
                ].map((h) => (
                  <button
                    key={h.value}
                    type="button"
                    title={h.name}
                    onClick={() =>
                      editor.chain().focus().setHighlight({ color: h.value }).run()
                    }
                    className="h-6 w-6 rounded border border-[var(--border)] hover:scale-110 transition-transform"
                    style={{ backgroundColor: h.value }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Link Input Panel */}
        {bubblePanel === "link" && (
          <div className="flex items-center gap-1.5 border-t border-[var(--border)] pt-2 text-xs">
            <input
              type="url"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://..."
              className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() => {
                const url = linkInput.trim();
                if (!url) {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                } else {
                  editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
                }
                setBubblePanel(null);
              }}
              className="rounded bg-[var(--accent)] px-2.5 py-1 font-medium text-white"
            >
              {tr("Apply", "Aplicar")}
            </button>
            {editor.isActive("link") && (
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  setBubblePanel(null);
                }}
                className="rounded border border-[var(--border)] px-2 py-1 text-red-500"
              >
                {tr("Remove", "Remover")}
              </button>
            )}
          </div>
        )}
      </BubbleMenu>

      {/* Contextual Code Block Controls */}
      {editor.isActive("codeBlock") && onSaveSnippetFromCode && (
        <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/70 px-2.5 py-1 text-xs">
          <span className="text-[var(--muted-foreground)]">Code Block:</span>
          <button
            type="button"
            onClick={() => {
              const $from = editor.state.selection.$from;
              const code = $from.parent.textContent;
              const lang =
                typeof $from.parent.attrs?.language === "string" &&
                $from.parent.attrs.language
                  ? $from.parent.attrs.language
                  : "typescript";
              if (code.trim()) {
                onSaveSnippetFromCode(code, lang);
              }
            }}
            className="inline-flex items-center gap-1 rounded bg-[var(--primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--primary-foreground)] hover:opacity-90"
          >
            <Code className="h-3 w-3" /> Save as Snippet
          </button>
        </div>
      )}

      {/* Contextual Table Controls (only when cursor is inside a table) */}
      {editor.isActive("table") && (
        <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/70 px-2 py-1 text-xs">
          <span className="text-[var(--muted-foreground)] mr-1">Table:</span>
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
            onClick={() => editor.chain().focus().deleteRow().run()}
            className="rounded px-1.5 py-0.5 hover:bg-[var(--surface)]"
          >
            -Row
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            className="rounded px-1.5 py-0.5 hover:bg-[var(--surface)]"
          >
            -Col
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteTable().run()}
            className="rounded px-1.5 py-0.5 text-red-500 hover:bg-[var(--surface)]"
          >
            Delete
          </button>
        </div>
      )}

      {uploading && (
        <div className="text-xs text-[var(--muted-foreground)]">Uploading attachment...</div>
      )}

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
