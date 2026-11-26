"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  BookOpen,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  FolderKanban,
  GraduationCap,
  Link2,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
  Unlink,
} from "lucide-react";
import type { NoteBlockDocument, NoteBlockNode, NoteRecord, ProjectRecord } from "@/db/schema";
import { NOTE_TEMPLATES, type NoteTemplateId } from "@/modules/notes/templates";
import { useUiStore } from "@/stores/ui-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/providers/i18n-provider";
import { HeadingToc, type HeadingTocItem } from "./heading-toc";
import { LocalGraphPanel } from "./local-graph-panel";
import {
  CreateLessonFromNoteModal,
  LinkedNoteDeleteDialog,
  LinkToLearningModal,
} from "./note-learning-modals";
import { TiptapEditor } from "./tiptap-editor";

interface NoteDetailPayload {
  note: NoteRecord;
  breadcrumbs: Array<{ id: string; title: string; icon: string | null }>;
  backlinks: Array<{ id: string; title: string; icon: string | null }>;
  outgoingLinks: Array<{ id: string; title: string; icon: string | null }>;
  linkedTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
  }>;
  project: { id: string; name: string; color: string } | null;
}

export function NotesWorkspace({
  initialNotes,
  projects,
}: {
  initialNotes: NoteRecord[];
  projects: ProjectRecord[];
}) {
  const { tr, language } = useI18n();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const taskStatusLabel = (status: string) => {
    switch (status) {
      case "todo":
        return tr("To Do", "A Fazer");
      case "in_progress":
        return tr("In Progress", "Em Progresso");
      case "done":
        return tr("Done", "Concluída");
      case "blocked":
        return tr("Blocked", "Bloqueada");
      case "cancelled":
        return tr("Cancelled", "Cancelada");
      default:
        return status;
    }
  };

  const templateMeta = (tpl: (typeof NOTE_TEMPLATES)[number]) => {
    switch (tpl.id) {
      case "blank":
        return {
          name: tr("Blank Page", "Página em Branco"),
          description: tr("Start with a clean slate.", "Comece com uma página limpa."),
        };
      case "study":
        return {
          name: tr("Study Note", "Nota de Estudo"),
          description: tr(
            "Structured concepts, key takeaways, and review questions.",
            "Conceitos estruturados, pontos-chave e perguntas de revisão."
          ),
        };
      case "tech_doc":
        return {
          name: tr("Technical Spec", "Especificação Técnica"),
          description: tr(
            "Architecture, API contracts, and implementation notes.",
            "Arquitetura, contratos de API e notas de implementação."
          ),
        };
      case "meeting":
        return {
          name: tr("Meeting Notes", "Ata de Reunião"),
          description: tr(
            "Agenda, discussion points, decisions, and next steps.",
            "Pauta, tópicos discutidos, decisões e próximos passos."
          ),
        };
      case "journal":
        return {
          name: tr("Daily Journal", "Diário"),
          description: tr(
            "Intentions, reflections, and highlights of the day.",
            "Intenções, reflexões e destaques do dia."
          ),
        };
      case "project_plan":
        return {
          name: tr("Project Plan", "Plano de Projeto"),
          description: tr(
            "Objectives, milestones, risks, and deliverables.",
            "Objetivos, marcos, riscos e entregas."
          ),
        };
      default:
        return { name: tpl.name, description: tpl.description };
    }
  };

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    searchParams.get("id") ?? initialNotes[0]?.id ?? null
  );
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateParentId, setTemplateParentId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
  const [titleDraft, setTitleDraft] = useState("");
  const [liveDoc, setLiveDoc] = useState<NoteBlockDocument | null>(null);
  const [flashcardModal, setFlashcardModal] = useState<{
    front: string;
    back: string;
    deckId: string;
    cardType: "basic" | "basic_reversed" | "cloze";
  } | null>(null);
  const [decks, setDecks] = useState<Array<{ id: string; title: string }>>([]);
  const [savingFlashcard, setSavingFlashcard] = useState(false);
  const [snippetModal, setSnippetModal] = useState<{
    title: string;
    language: string;
    code: string;
  } | null>(null);
  const [savingSnippet, setSavingSnippet] = useState(false);
  const [showLinkLearningModal, setShowLinkLearningModal] = useState(false);
  const [showCreateLessonModal, setShowCreateLessonModal] = useState(false);
  const [relTargetId, setRelTargetId] = useState("");
  const [relLabel, setRelLabel] = useState("related_to");
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [deleteImpactModal, setDeleteImpactModal] = useState<{
    noteId: string;
    noteTitle: string;
    impact: {
      linkedLearning: Array<{ course: { title: string } | null; lesson: { title: string } | null }>;
      flashcardsCount: number;
      quizzes: Array<{ title: string }>;
    };
  } | null>(null);
  const spellcheckEnabled = useUiStore((s) => s.spellcheckEnabled);

  const editorScrollRef = useRef<HTMLDivElement | null>(null);
  const versionRef = useRef<number>(1);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const paramId = searchParams.get("id");
    if (paramId) setSelectedNoteId(paramId);
  }, [searchParams]);

  const { data: notesList = initialNotes } = useQuery<NoteRecord[]>({
    queryKey: ["notes"],
    queryFn: async () => {
      const res = await fetch("/api/notes");
      if (!res.ok) throw new Error("Failed to load notes");
      const json = await res.json();
      return json.data.notes;
    },
    initialData: initialNotes,
  });

  const { data: detail, isLoading: loadingDetail } = useQuery<NoteDetailPayload>({
    queryKey: ["note-detail", selectedNoteId],
    queryFn: async () => {
      const res = await fetch(`/api/notes/${selectedNoteId}`);
      if (!res.ok) throw new Error("Failed to load note");
      const json = await res.json();
      return json.data;
    },
    enabled: Boolean(selectedNoteId),
  });

  const { data: linkedLearning = [], refetch: refetchLinkedLearning } = useQuery<
    Array<{
      linkId: string;
      purpose: string;
      course: { id: string; title: string; status: string } | null;
      module: { id: string; title: string } | null;
      lesson: { id: string; title: string; status: string } | null;
      path: { id: string; title: string } | null;
    }>
  >({
    queryKey: ["note-linked-learning", selectedNoteId],
    queryFn: async () => {
      if (!selectedNoteId) return [];
      const res = await fetch(`/api/learning/links?noteId=${selectedNoteId}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data?.links ?? [];
    },
    enabled: Boolean(selectedNoteId),
  });

  const { data: noteRelations = [], refetch: refetchRelations } = useQuery<
    Array<{
      id: string;
      direction: string;
      relationType: string;
      label?: string;
      otherEntity: { id: string; title: string; type: string };
    }>
  >({
    queryKey: ["note-relations", selectedNoteId],
    queryFn: async () => {
      if (!selectedNoteId) return [];
      const res = await fetch(`/api/relations?entityType=note&entityId=${selectedNoteId}`);
      if (!res.ok) return [];
      const json = await res.json();
      const rows = (json.data?.relations ?? []) as Array<{
        id: string;
        direction: string;
        relationType: string;
        metadata?: { label?: string } | null;
        otherEntity?: { id: string; title: string; type: string };
      }>;
      return rows
        .filter((r) => r.otherEntity && r.otherEntity.type === "note")
        .map((r) => ({
          id: r.id,
          direction: r.direction,
          relationType: r.relationType,
          label: r.metadata?.label ?? r.relationType,
          otherEntity: r.otherEntity!,
        }));
    },
    enabled: Boolean(selectedNoteId),
  });

  useEffect(() => {
    const activeNote = detail?.note;
    if (activeNote) {
      setTitleDraft(activeNote.title);
      setLiveDoc(activeNote.contentJson);
      versionRef.current = activeNote.version;
      setSaveState("idle");
    }
  }, [detail?.note]);

  const headings: HeadingTocItem[] = useMemo(() => {
    const doc = liveDoc ?? detail?.note?.contentJson;
    if (!doc || !Array.isArray(doc.content)) return [];
    const list: HeadingTocItem[] = [];
    const extractText = (node: NoteBlockNode): string => {
      if (typeof node.text === "string") return node.text;
      if (Array.isArray(node.content)) return node.content.map(extractText).join("");
      return "";
    };
    let idx = 0;
    for (const block of doc.content) {
      if (block.type === "heading") {
        const rawLevel = Number(block.attrs?.level ?? 1);
        const level: 1 | 2 | 3 = rawLevel === 2 ? 2 : rawLevel === 3 ? 3 : 1;
        const text = extractText(block).trim();
        if (text) {
          list.push({ index: idx, level, text });
        }
        idx += 1;
      }
    }
    return list;
  }, [liveDoc, detail?.note?.contentJson]);

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notes"] }),
      queryClient.invalidateQueries({ queryKey: ["note-detail", selectedNoteId] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
    ]);
  };

  const handleCreateNote = async (
    templateId: NoteTemplateId = "blank",
    parentId: string | null = null
  ) => {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, parentId }),
    });
    if (res.ok) {
      const json = await res.json();
      const created: NoteRecord = json.data.note;
      if (parentId) {
        setExpandedIds((prev) => ({ ...prev, [parentId]: true }));
      }
      setSelectedNoteId(created.id);
      setShowTemplateModal(false);
      setTemplateParentId(null);
      await invalidateAll();
    }
  };

  const patchNote = async (noteId: string, body: Record<string, unknown>) => {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          expectedVersion: versionRef.current,
        }),
      });

      if (res.status === 409) {
        setSaveState("conflict");
        await queryClient.invalidateQueries({ queryKey: ["note-detail", noteId] });
        return;
      }

      if (!res.ok) {
        setSaveState("error");
        return;
      }

      const json = await res.json();
      versionRef.current = json.data.note.version;
      setSaveState("saved");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
        queryClient.invalidateQueries({ queryKey: ["note-detail", noteId] }),
      ]);
    } catch {
      setSaveState("error");
    }
  };

  const scheduleContentSave = (noteId: string, doc: NoteBlockDocument) => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setSaveState("saving");
    autosaveTimerRef.current = setTimeout(() => {
      patchNote(noteId, { contentJson: doc });
    }, 800);
  };

  const handleDuplicate = async (noteId: string) => {
    const res = await fetch(`/api/notes/${noteId}/duplicate`, { method: "POST" });
    if (res.ok) {
      const json = await res.json();
      setSelectedNoteId(json.data.note.id);
      await invalidateAll();
    }
  };

  const handleDelete = async (noteId: string, skipImpactCheck = false) => {
    if (!skipImpactCheck) {
      const impRes = await fetch(`/api/learning/links?noteId=${noteId}&impact=1`);
      if (impRes.ok) {
        const impJson = await impRes.json();
        if (impJson.data?.hasImpact) {
          setDeleteImpactModal({
            noteId,
            noteTitle: detail?.note.title ?? tr("Note", "Nota"),
            impact: impJson.data,
          });
          return;
        }
      }
    }
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
    if (res.ok) {
      const remaining = notesList.filter((n) => n.id !== noteId);
      setSelectedNoteId(remaining[0]?.id ?? null);
      await invalidateAll();
    }
  };

  const handleConvertSelectionToTask = async (text: string) => {
    if (!detail?.note) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: text.slice(0, 240),
        noteId: detail.note.id,
        projectId: detail.note.projectId,
      }),
    });
    if (res.ok) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["note-detail", detail.note.id] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    }
  };

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notesList;
    return notesList.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.contentText.toLowerCase().includes(q)
    );
  }, [notesList, search]);

  const favoriteNotes = useMemo(
    () => notesList.filter((n) => n.isFavorite),
    [notesList]
  );

  // Build file-tree parent map combining explicit parentId with outgoing [[wikiLink]] references
  const effectiveParentMap = useMemo(() => {
    const idSet = new Set(notesList.map((n) => n.id));
    const map = new Map<string, string | null>();
    for (const n of notesList) {
      map.set(n.id, n.parentId && idSet.has(n.parentId) ? n.parentId : null);
    }

    const extractWikiTargets = (doc: NoteBlockDocument | undefined): string[] => {
      if (!doc || !Array.isArray(doc.content)) return [];
      const targets: string[] = [];
      const walk = (nodes: unknown[]) => {
        for (const raw of nodes) {
          if (!raw || typeof raw !== "object") continue;
          const node = raw as {
            type?: string;
            attrs?: { noteId?: unknown };
            content?: unknown[];
          };
          if (node.type === "wikiLink" && typeof node.attrs?.noteId === "string") {
            targets.push(node.attrs.noteId);
          }
          if (Array.isArray(node.content)) {
            walk(node.content);
          }
        }
      };
      walk(doc.content);
      return targets;
    };

    const createsCycle = (childId: string, candidateParentId: string): boolean => {
      let cur: string | null = candidateParentId;
      const seen = new Set<string>([childId]);
      while (cur) {
        if (seen.has(cur)) return true;
        seen.add(cur);
        cur = map.get(cur) ?? null;
      }
      return false;
    };

    for (const source of notesList) {
      const targets = extractWikiTargets(source.contentJson);
      for (const targetId of targets) {
        if (targetId === source.id || !idSet.has(targetId)) continue;
        if (map.get(targetId) === null && !createsCycle(targetId, source.id)) {
          map.set(targetId, source.id);
        }
      }
    }

    return map;
  }, [notesList]);

  const renderTree = (
    parentId: string | null,
    depth = 0,
    visited = new Set<string>()
  ): React.ReactNode => {
    const children = filteredNotes.filter((n) =>
      search.trim() ? depth === 0 : (effectiveParentMap.get(n.id) ?? null) === parentId
    );
    if (children.length === 0) return null;

    return children.map((note) => {
      if (visited.has(note.id)) return null;
      const nextVisited = new Set(visited);
      nextVisited.add(note.id);
      const hasChildren =
        !search.trim() &&
        notesList.some((n) => (effectiveParentMap.get(n.id) ?? null) === note.id);
      const isExpanded = expandedIds[note.id] ?? false;
      const isSelected = selectedNoteId === note.id;

      return (
        <div key={note.id}>
          <div
            style={{ paddingLeft: `${depth * 14 + 6}px` }}
            className={`group flex items-center justify-between rounded-lg pr-1.5 py-1 text-sm transition-colors ${
              isSelected
                ? "bg-[var(--surface-muted)] font-medium text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedIds((prev) => ({
                      ...prev,
                      [note.id]: !isExpanded,
                    }))
                  }
                  className="rounded p-0.5 hover:bg-[var(--surface)]"
                  aria-label={
                    isExpanded
                      ? tr("Collapse subpages", "Recolher subpáginas")
                      : tr("Expand subpages", "Expandir subpáginas")
                  }
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-4 shrink-0" />
              )}

              <button
                type="button"
                onClick={() => setSelectedNoteId(note.id)}
                className="flex items-center gap-1.5 min-w-0 flex-1 text-left truncate py-0.5"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{note.title}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setTemplateParentId(note.id);
                setShowTemplateModal(true);
              }}
              className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-[var(--surface)]"
              title={tr("Add subpage", "Adicionar subpágina")}
              aria-label={tr(`Add subpage under ${note.title}`, `Adicionar subpágina em ${note.title}`)}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {hasChildren && isExpanded && renderTree(note.id, depth + 1, nextVisited)}
        </div>
      );
    });
  };

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-4 lg:h-[calc(100dvh-7.5rem)] lg:flex-row">
      {/* Left Page Tree Sidebar */}
      <aside className="flex max-h-56 w-full shrink-0 flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:max-h-none lg:w-64">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{tr("Pages", "Páginas")}</span>
          <Button
            size="sm"
            onClick={() => {
              setTemplateParentId(null);
              setShowTemplateModal(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> {tr("New", "Nova")}
          </Button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr("Filter pages...", "Filtrar páginas...")}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {favoriteNotes.length > 0 && !search.trim() && (
            <div>
              <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {tr("Favorites", "Favoritas")}
              </div>
              {favoriteNotes.map((fav) => (
                <button
                  key={`fav-${fav.id}`}
                  type="button"
                  onClick={() => setSelectedNoteId(fav.id)}
                  className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-xs ${
                    selectedNoteId === fav.id
                      ? "bg-[var(--surface-muted)] font-medium"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                  <span className="truncate">{fav.title}</span>
                </button>
              ))}
            </div>
          )}

          <div>
            <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              {tr("Workspace Notes", "Notas do Espaço")}
            </div>
            {notesList.length === 0 ? (
              <p className="px-2 py-4 text-xs text-[var(--muted-foreground)]">
                {tr(
                  'No notes yet. Click "New" to create your first page.',
                  'Nenhuma nota ainda. Clique em "Nova" para criar sua primeira página.'
                )}
              </p>
            ) : (
              renderTree(null, 0)
            )}
          </div>
        </div>
      </aside>

      {/* Center Block Editor */}
      <section className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {!selectedNoteId || !detail ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-sm text-[var(--muted-foreground)]">
            <FileText className="mb-2 h-8 w-8 opacity-60" />
            {loadingDetail ? (
              tr("Loading page...", "Carregando página...")
            ) : (
              <>
                <p>
                  {tr(
                    "Select a page or create a new note to start writing.",
                    "Selecione uma página ou crie uma nova nota para começar a escrever."
                  )}
                </p>
                <Button
                  className="mt-3"
                  size="sm"
                  onClick={() => handleCreateNote("blank", null)}
                >
                  <Plus className="h-4 w-4" />{" "}
                  {tr("Create your first note", "Criar sua primeira nota")}
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Top Note Header & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
              {/* Breadcrumbs */}
              <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] overflow-x-auto">
                {detail.breadcrumbs.map((b) => (
                  <React.Fragment key={b.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedNoteId(b.id)}
                      className="hover:text-[var(--foreground)] truncate max-w-[120px]"
                    >
                      {b.title}
                    </button>
                    <span>/</span>
                  </React.Fragment>
                ))}
                <span className="font-medium text-[var(--foreground)] truncate max-w-[160px]">
                  {detail.note.title}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[var(--muted-foreground)] mr-1">
                  {saveState === "saving" && tr("Saving...", "Salvando...")}
                  {saveState === "saved" && tr("Saved", "Salvo")}
                  {saveState === "error" && tr("Save failed", "Falha ao salvar")}
                  {saveState === "conflict" &&
                    tr("Reloaded newer version", "Versão mais recente recarregada")}
                </span>

                <Button
                  size="sm"
                  variant="outline"
                  data-tour="notes-link-learning"
                  onClick={() => setShowLinkLearningModal(true)}
                  className="h-8 px-2 text-xs"
                  title={tr("Link to Learning", "Vincular ao Learning")}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tr("Link to Learning", "Vincular ao Learning")}</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateLessonModal(true)}
                  className="h-8 px-2 text-xs"
                  title={tr("Create Lesson from Note", "Criar Aula da Nota")}
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">{tr("Create Lesson", "Criar Aula")}</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const res = await fetch("/api/learning/reviews", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "schedule",
                        entityType: "note",
                        entityId: detail.note.id,
                        title: detail.note.title,
                      }),
                    });
                    if (res.ok) {
                      setReviewMsg(tr("Added to Review Queue", "Adicionada à Fila de Revisão"));
                      setTimeout(() => setReviewMsg(null), 2500);
                    }
                  }}
                  title={tr("Add to Spaced Repetition Review Queue", "Adicionar à Fila de Revisão Espaçada")}
                  className="h-8 px-2 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">{reviewMsg ?? tr("Review", "Revisar")}</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const res = await fetch(`/api/notes/${detail.note.id}/collab`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "checkpoint",
                        label: `Checkpoint ${new Date().toLocaleTimeString(locale)}`,
                      }),
                    });
                    if (res.ok) {
                      setSaveState("saved");
                    } else {
                      setSaveState("error");
                    }
                  }}
                  title={tr(
                    "Save collaboration checkpoint",
                    "Salvar ponto de verificação de colaboração"
                  )}
                  className="h-8 px-2 text-xs"
                >
                  {tr("Sync Checkpoint", "Ponto de Verificação")}
                </Button>

                <select
                  value={detail.note.projectId ?? ""}
                  onChange={(e) =>
                    patchNote(detail.note.id, { projectId: e.target.value || null })
                  }
                  className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
                  aria-label={tr("Link note to project", "Vincular nota ao projeto")}
                >
                  <option value="">{tr("No project", "Sem projeto")}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    patchNote(detail.note.id, { isFavorite: !detail.note.isFavorite })
                  }
                  title={tr("Toggle favorite", "Alternar favorito")}
                >
                  <Star
                    className={`h-4 w-4 ${
                      detail.note.isFavorite ? "fill-amber-400 text-amber-400" : ""
                    }`}
                  />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDuplicate(detail.note.id)}
                  title={tr("Duplicate page", "Duplicar página")}
                >
                  <Copy className="h-4 w-4" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    patchNote(detail.note.id, { isArchived: !detail.note.isArchived })
                  }
                  title={tr("Archive page", "Arquivar página")}
                >
                  <Archive className="h-4 w-4" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(detail.note.id)}
                  title={tr("Delete page", "Excluir página")}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>

            {/* Editor + Relationships Split */}
            <div className="flex flex-1 overflow-hidden">
              <div className="relative flex flex-1 overflow-hidden">
                <div ref={editorScrollRef} className="flex-1 overflow-y-auto px-6 py-5 pr-12">
                  <input
                    type="text"
                    spellCheck={spellcheckEnabled}
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={() => {
                      const clean = titleDraft.trim() || tr("Untitled", "Sem título");
                      if (clean !== detail.note.title) {
                        patchNote(detail.note.id, { title: clean });
                      }
                    }}
                    placeholder={tr("Untitled", "Sem título")}
                    className="mb-4 w-full bg-transparent text-3xl font-bold tracking-tight focus:outline-none"
                  />

                  <TiptapEditor
                    noteId={detail.note.id}
                    initialContent={detail.note.contentJson}
                    linkableNotes={notesList.map((n) => ({
                      id: n.id,
                      title: n.title,
                      icon: n.icon,
                    }))}
                    onChange={(doc) => {
                      setLiveDoc(doc);
                      scheduleContentSave(detail.note.id, doc);
                    }}
                    onConvertSelectionToTask={handleConvertSelectionToTask}
                    onSaveSnippetFromCode={(code, language) => {
                      setSnippetModal({
                        title: `${detail.note.title} snippet`,
                        language,
                        code,
                      });
                    }}
                    onCreateFlashcardFromSelection={async (text) => {
                      setFlashcardModal({
                        front: text,
                        back: "",
                        deckId: decks[0]?.id ?? "",
                        cardType: "basic",
                      });
                      if (decks.length === 0) {
                        try {
                          const res = await fetch("/api/flashcards/decks");
                          if (res.ok) {
                            const json = await res.json();
                            const loaded = json?.data?.decks ?? [];
                            setDecks(loaded);
                            if (loaded[0]?.id) {
                              setFlashcardModal((prev) =>
                                prev ? { ...prev, deckId: prev.deckId || loaded[0].id } : prev
                              );
                            }
                          }
                        } catch {
                          // ignore
                        }
                      }
                    }}
                  />
                </div>

                {/* Floating Heading Minimap & Hover TOC */}
                {headings.length > 0 && (
                  <div className="pointer-events-none absolute right-4 top-16 z-20">
                    <HeadingToc headings={headings} scrollContainerRef={editorScrollRef} />
                  </div>
                )}
              </div>

              {/* Right Context & Relationships Panel */}
              <aside className="hidden w-64 shrink-0 overflow-y-auto border-l border-[var(--border)] p-4 space-y-5 xl:block">
                {detail.project && (
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      {tr("Project", "Projeto")}
                    </div>
                    <Link
                      href={`/projects?id=${detail.project.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--surface-muted)]"
                    >
                      <FolderKanban className="h-3.5 w-3.5" />
                      {detail.project.name}
                    </Link>
                  </div>
                )}

                <div>
                  <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    <Link2 className="h-3 w-3" /> {tr("Backlinks", "Backlinks")} (
                    {detail.backlinks.length})
                  </div>
                  {detail.backlinks.length === 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {tr(
                        "No notes link here yet. Link this note from another page to see backlinks.",
                        "Nenhuma nota aponta para cá ainda. Vincule esta nota em outra página para ver os backlinks."
                      )}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {detail.backlinks.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedNoteId(b.id)}
                          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs hover:bg-[var(--surface-muted)]"
                        >
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="truncate">{b.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    <CheckSquare className="h-3 w-3" /> {tr("Linked Tasks", "Tarefas Vinculadas")} (
                    {detail.linkedTasks.length})
                  </div>
                  {detail.linkedTasks.length === 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {tr(
                        'Select text and click "To Task" in the toolbar.',
                        'Selecione um texto e clique em "Tarefa" na barra de ferramentas.'
                      )}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {detail.linkedTasks.map((t) => (
                        <Link
                          key={t.id}
                          href={`/tasks?taskId=${t.id}`}
                          className="block rounded-md border border-[var(--border)] px-2 py-1.5 text-xs hover:bg-[var(--surface-muted)]"
                        >
                          <div className="font-medium truncate">{t.title}</div>
                          <Badge variant="outline" className="mt-1">
                            {taskStatusLabel(t.status)}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Linked Learning */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    <span className="flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" /> {tr("Linked Learning", "Learning Vinculado")} ({linkedLearning.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowLinkLearningModal(true)}
                      className="text-[var(--accent)] hover:underline"
                    >
                      + {tr("Link", "Vincular")}
                    </button>
                  </div>
                  {linkedLearning.length === 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {tr("Not linked to any course or lesson yet.", "Ainda não vinculada a nenhum curso ou aula.")}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {linkedLearning.map((item) => (
                        <div
                          key={item.linkId}
                          className="rounded-md border border-[var(--border)] px-2 py-1.5 text-xs"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <Link
                              href={`/learning${item.course ? `?courseId=${item.course.id}` : ""}`}
                              className="font-medium text-[var(--accent)] hover:underline truncate"
                            >
                              {item.course?.title ?? item.path?.title ?? tr("Learning", "Learning")}
                            </Link>
                            <button
                              type="button"
                              onClick={async () => {
                                await fetch(`/api/learning/links?id=${item.linkId}`, { method: "DELETE" });
                                void refetchLinkedLearning();
                              }}
                              title={tr("Unlink", "Desvincular")}
                              className="text-[var(--muted-foreground)] hover:text-red-500"
                            >
                              <Unlink className="h-3 w-3" />
                            </button>
                          </div>
                          {item.lesson && (
                            <div className="text-[11px] text-[var(--muted-foreground)] truncate">
                              {item.module ? `${item.module.title} → ` : ""}{item.lesson.title}
                            </div>
                          )}
                          <div className="mt-1 flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px]">
                              {item.purpose.replace("_", " ")}
                            </Badge>
                            {item.lesson && (
                              <Badge variant="outline" className="text-[10px]">
                                {item.lesson.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Typed Note Relationships */}
                <div>
                  <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    <Link2 className="h-3 w-3" /> {tr("Note Relationships", "Relações entre Notas")} ({noteRelations.length})
                  </div>
                  <div className="mb-2 flex flex-col gap-1">
                    <select
                      value={relLabel}
                      onChange={(e) => setRelLabel(e.target.value)}
                      className="h-7 rounded border border-[var(--border)] bg-[var(--background)] px-1.5 text-[11px]"
                    >
                      <option value="related_to">{tr("Related to", "Relacionada a")}</option>
                      <option value="prerequisite_of">{tr("Prerequisite of", "Pré-requisito de")}</option>
                      <option value="depends_on">{tr("Depends on", "Depende de")}</option>
                      <option value="extends">{tr("Extends", "Estende")}</option>
                      <option value="example_of">{tr("Example of", "Exemplo de")}</option>
                      <option value="summary_of">{tr("Summary of", "Resumo de")}</option>
                      <option value="reference_to">{tr("Reference to", "Referência para")}</option>
                    </select>
                    <div className="flex gap-1">
                      <select
                        value={relTargetId}
                        onChange={(e) => setRelTargetId(e.target.value)}
                        className="h-7 flex-1 min-w-0 rounded border border-[var(--border)] bg-[var(--background)] px-1.5 text-[11px]"
                      >
                        <option value="">{tr("Select note...", "Selecionar nota...")}</option>
                        {notesList
                          .filter((n) => n.id !== detail.note.id)
                          .map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.title}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={!relTargetId}
                        onClick={async () => {
                          if (!relTargetId) return;
                          const mappedType =
                            relLabel === "depends_on" || relLabel === "prerequisite_of"
                              ? "blocks"
                              : relLabel === "reference_to"
                                ? "references"
                                : relLabel === "summary_of" || relLabel === "extends"
                                  ? "derived_from"
                                  : "related_to";
                          await fetch("/api/relations", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              sourceType: "note",
                              sourceId: detail.note.id,
                              targetType: "note",
                              targetId: relTargetId,
                              relationType: mappedType,
                              metadata: { label: relLabel },
                            }),
                          });
                          setRelTargetId("");
                          void refetchRelations();
                        }}
                        className="rounded border border-[var(--border)] px-2 text-[11px] hover:bg-[var(--surface-muted)] disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {noteRelations.length > 0 && (
                    <div className="space-y-1">
                      {noteRelations.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-1 rounded border border-[var(--border)] px-2 py-1 text-[11px]"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedNoteId(r.otherEntity.id)}
                            className="truncate text-left hover:underline"
                          >
                            <span className="text-[var(--muted-foreground)]">{r.label}:</span>{" "}
                            {r.otherEntity.title}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch(`/api/relations?id=${r.id}`, { method: "DELETE" });
                              void refetchRelations();
                            }}
                            className="text-[var(--muted-foreground)] hover:text-red-500"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <LocalGraphPanel
                  noteId={detail.note.id}
                  onSelectNote={(id) => setSelectedNoteId(id)}
                />
              </aside>
            </div>
          </>
        )}
      </section>

      {/* Template Picker Modal */}
      {showTemplateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowTemplateModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold">
              {tr("Choose a Template", "Escolher um Modelo")}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              {templateParentId
                ? tr(
                    "Create a new subpage from a template.",
                    "Criar uma nova subpágina a partir de um modelo."
                  )
                : tr(
                    "Create a new page from a template.",
                    "Criar uma nova página a partir de um modelo."
                  )}
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {NOTE_TEMPLATES.map((tpl) => {
                const meta = templateMeta(tpl);
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleCreateNote(tpl.id, templateParentId)}
                    className="rounded-lg border border-[var(--border)] p-3 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-muted)]"
                  >
                    <div className="text-sm font-medium">{meta.name}</div>
                    <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      {meta.description}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowTemplateModal(false)}>
                {tr("Cancel", "Cancelar")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {flashcardModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setFlashcardModal(null)}
        >
          <form
            className="w-full max-w-md space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!flashcardModal.deckId || !flashcardModal.front.trim()) return;
              setSavingFlashcard(true);
              try {
                const res = await fetch("/api/flashcards/cards", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    deckId: flashcardModal.deckId,
                    cardType: flashcardModal.cardType,
                    front: flashcardModal.front.trim(),
                    back: flashcardModal.back.trim() || flashcardModal.front.trim(),
                    sourceNoteId: detail?.note.id,
                  }),
                });
                if (res.ok) {
                  setFlashcardModal(null);
                  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                }
              } finally {
                setSavingFlashcard(false);
              }
            }}
          >
            <h2 className="text-base font-semibold">
              {tr("Create Flashcard from Note", "Criar Flashcard da Nota")}
            </h2>
            {decks.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">
                {tr(
                  "No flashcard decks found yet. Create a deck in",
                  "Nenhum baralho de flashcards encontrado ainda. Crie um baralho em"
                )}{" "}
                <Link href="/flashcards" className="text-[var(--accent)] underline">
                  {tr("Flashcards", "Flashcards")}
                </Link>{" "}
                {tr("first.", "primeiro.")}
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{tr("Deck", "Baralho")}</label>
                  <select
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm"
                    value={flashcardModal.deckId}
                    onChange={(e) =>
                      setFlashcardModal({ ...flashcardModal, deckId: e.target.value })
                    }
                  >
                    {decks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{tr("Type", "Tipo")}</label>
                  <select
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm"
                    value={flashcardModal.cardType}
                    onChange={(e) =>
                      setFlashcardModal({
                        ...flashcardModal,
                        cardType: e.target.value as "basic" | "basic_reversed" | "cloze",
                      })
                    }
                  >
                    <option value="basic">{tr("Basic", "Básico")}</option>
                    <option value="basic_reversed">
                      {tr("Basic (Reversed)", "Básico (Invertido)")}
                    </option>
                    <option value="cloze">{tr("Cloze Deletion", "Omissão (Cloze)")}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{tr("Front", "Frente")}</label>
                  <textarea
                    rows={2}
                    required
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm"
                    value={flashcardModal.front}
                    onChange={(e) =>
                      setFlashcardModal({ ...flashcardModal, front: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">{tr("Back", "Verso")}</label>
                  <textarea
                    rows={2}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm"
                    placeholder={tr("Answer or explanation...", "Resposta ou explicação...")}
                    value={flashcardModal.back}
                    onChange={(e) =>
                      setFlashcardModal({ ...flashcardModal, back: e.target.value })
                    }
                  />
                </div>
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFlashcardModal(null)}
              >
                {tr("Cancel", "Cancelar")}
              </Button>
              {decks.length > 0 && (
                <Button type="submit" size="sm" disabled={savingFlashcard}>
                  {savingFlashcard
                    ? tr("Saving...", "Salvando...")
                    : tr("Create Flashcard", "Criar Flashcard")}
                </Button>
              )}
            </div>
          </form>
        </div>
      )}

      {snippetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setSnippetModal(null)}
        >
          <form
            className="w-full max-w-md space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!snippetModal.title.trim() || !snippetModal.code.trim()) return;
              setSavingSnippet(true);
              try {
                const res = await fetch("/api/developer-hub/snippets", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    title: snippetModal.title.trim(),
                    language: snippetModal.language.trim() || "typescript",
                    code: snippetModal.code,
                    sourceNoteId: detail?.note.id ?? null,
                    projectId: detail?.note.projectId ?? null,
                  }),
                });
                if (res.ok) {
                  setSnippetModal(null);
                  queryClient.invalidateQueries({ queryKey: ["developer-hub-overview"] });
                }
              } finally {
                setSavingSnippet(false);
              }
            }}
          >
            <h2 className="text-base font-semibold">
              {tr("Save Code Block as Snippet", "Salvar Bloco de Código como Snippet")}
            </h2>
            <div className="space-y-1">
              <label className="text-xs font-medium">{tr("Title", "Título")}</label>
              <Input
                value={snippetModal.title}
                onChange={(e) =>
                  setSnippetModal({ ...snippetModal, title: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{tr("Language", "Linguagem")}</label>
              <Input
                value={snippetModal.language}
                onChange={(e) =>
                  setSnippetModal({ ...snippetModal, language: e.target.value })
                }
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSnippetModal(null)}
              >
                {tr("Cancel", "Cancelar")}
              </Button>
              <Button type="submit" size="sm" disabled={savingSnippet}>
                {savingSnippet ? tr("Saving...", "Salvando...") : tr("Save Snippet", "Salvar Snippet")}
              </Button>
            </div>
          </form>
        </div>
      )}
      {showLinkLearningModal && detail && (
        <LinkToLearningModal
          noteId={detail.note.id}
          noteTitle={detail.note.title}
          onClose={() => setShowLinkLearningModal(false)}
          onLinked={() => void refetchLinkedLearning()}
        />
      )}

      {showCreateLessonModal && detail && (
        <CreateLessonFromNoteModal
          noteId={detail.note.id}
          noteTitle={detail.note.title}
          onClose={() => setShowCreateLessonModal(false)}
          onCreated={() => void refetchLinkedLearning()}
        />
      )}

      {deleteImpactModal && (
        <LinkedNoteDeleteDialog
          noteTitle={deleteImpactModal.noteTitle}
          impact={deleteImpactModal.impact}
          onCancel={() => setDeleteImpactModal(null)}
          onArchive={() => {
            patchNote(deleteImpactModal.noteId, { isArchived: true });
            setDeleteImpactModal(null);
          }}
          onConfirmDelete={() => {
            const id = deleteImpactModal.noteId;
            setDeleteImpactModal(null);
            void handleDelete(id, true);
          }}
        />
      )}
    </div>
  );
}
