"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, X } from "lucide-react";
import type { NoteBlockDocument, NoteRecord } from "@/db/schema";
import { useI18n } from "@/components/providers/i18n-provider";
import { Input } from "@/components/ui/input";
import { TiptapEditor } from "@/features/notes/components/tiptap-editor";

export function InlineNoteEditorDrawer({
  noteId,
  onClose,
  onUpdated,
}: {
  noteId: string;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const { tr } = useI18n();
  const [note, setNote] = useState<NoteRecord | null>(null);
  const [title, setTitle] = useState("");
  const [linkableNotes, setLinkableNotes] = useState<
    Array<{ id: string; title: string; icon: string | null }>
  >([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const versionRef = useRef<number>(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void (async () => {
      const [detailRes, listRes] = await Promise.all([
        fetch(`/api/notes/${noteId}`),
        fetch("/api/notes"),
      ]);
      if (detailRes.ok) {
        const dJson = await detailRes.json();
        const n: NoteRecord = dJson.data.note;
        setNote(n);
        setTitle(n.title);
        versionRef.current = n.version;
      }
      if (listRes.ok) {
        const lJson = await listRes.json();
        setLinkableNotes(lJson.data?.notes ?? []);
      }
    })();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [noteId]);

  const patchNote = async (patch: Record<string, unknown>) => {
    setSaveState("saving");
    const res = await fetch(`/api/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, expectedVersion: versionRef.current }),
    });
    if (res.ok) {
      const json = await res.json();
      versionRef.current = json.data.note.version;
      setSaveState("saved");
      onUpdated?.();
    } else {
      setSaveState("error");
    }
  };

  const scheduleContentSave = (doc: NoteBlockDocument) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState("saving");
    timerRef.current = setTimeout(() => {
      void patchNote({ contentJson: doc });
    }, 650);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-3xl flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
            <span>
              {saveState === "saving"
                ? tr("Saving...", "Salvando...")
                : saveState === "saved"
                  ? tr("Saved (synced everywhere)", "Salvo (sincronizado)")
                  : saveState === "error"
                    ? tr("Error saving", "Erro ao salvar")
                    : tr("Single source of truth note editor", "Editor compartilhado da nota")}
            </span>
            <Link
              href={`/notes?id=${noteId}`}
              className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> {tr("Open in Notes", "Abrir em Notas")}
            </Link>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[var(--surface-muted)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!note ? (
            <div className="text-xs text-[var(--muted-foreground)]">{tr("Loading note...", "Carregando nota...")}</div>
          ) : (
            <>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  const clean = title.trim() || "Untitled";
                  if (clean !== note.title) void patchNote({ title: clean });
                }}
                className="border-none bg-transparent px-0 text-2xl font-bold focus-visible:ring-0"
              />
              <TiptapEditor
                noteId={note.id}
                initialContent={note.contentJson}
                linkableNotes={linkableNotes}
                onChange={scheduleContentSave}
                onConvertSelectionToTask={async (text) => {
                  await fetch("/api/tasks", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: text.slice(0, 240), noteId: note.id }),
                  });
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
