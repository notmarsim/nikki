"use client";

import React, { useEffect, useState } from "react";
import {
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  Circle,
  Edit3,
  ExternalLink,
  FileText,
  Link2,
  Play,
  Plus,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LessonRichDetail {
  lesson: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    difficulty: string;
    estimatedMinutes: number | null;
    objectives: string[];
    prerequisites: string[];
    resources: Array<{ title: string; url: string }>;
  };
  contents: Array<{
    id: string;
    contentType: string;
    title: string;
    body: string | null;
    url: string | null;
    noteId: string | null;
    noteDeleted: boolean;
    noteTitle: string;
    isRequired: boolean;
    isCompleted: boolean;
  }>;
  linkedNotes: Array<{
    linkId: string;
    noteId: string;
    purpose: string;
    isRequired: boolean;
    deleted: boolean;
    title: string;
    updatedAt: string | null;
    readingMinutes: number;
  }>;
  quizzes: Array<{ id: string; title: string }>;
}

export function LessonDetailPanel({
  lessonId,
  courseId,
  onClose,
  onOpenNote,
  onStartStudyMode,
  onChanged,
}: {
  lessonId: string;
  courseId: string;
  onClose: () => void;
  onOpenNote: (noteId: string) => void;
  onStartStudyMode: () => void;
  onChanged: () => void;
}) {
  const { tr, language } = useI18n();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const [detail, setDetail] = useState<LessonRichDetail | null>(null);
  const [allNotes, setAllNotes] = useState<Array<{ id: string; title: string }>>([]);

  // Add content form
  const [contentType, setContentType] = useState("text");
  const [contentTitle, setContentTitle] = useState("");
  const [contentBody, setContentBody] = useState("");
  const [contentUrl, setContentUrl] = useState("");
  const [contentRequired, setContentRequired] = useState(true);

  // Link existing note
  const [linkNoteId, setLinkNoteId] = useState("");
  const [linkPurpose, setLinkPurpose] = useState("supplementary");
  const [newNoteTitle, setNewNoteTitle] = useState("");

  // Study task / Calendar
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [savingTitle, setSavingTitle] = useState(false);

  const load = async () => {
    const [dRes, nRes] = await Promise.all([
      fetch(`/api/learning/contents?lessonId=${lessonId}`),
      fetch("/api/notes"),
    ]);
    if (dRes.ok) {
      const json = await dRes.json();
      setDetail(json.data);
    }
    if (nRes.ok) {
      const nJson = await nRes.json();
      setAllNotes(nJson.data?.notes ?? []);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2600);
  };

  if (!detail) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-xs text-[var(--muted-foreground)]">
        {tr("Loading lesson details...", "Carregando detalhes da aula...")}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--accent)]/40 bg-[var(--surface)] p-3.5 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {editingTitle !== null ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const trimmed = editingTitle.trim();
                  if (!trimmed) return;
                  setSavingTitle(true);
                  try {
                    const res = await fetch(`/api/learning/lessons/${lessonId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ title: trimmed }),
                    });
                    if (res.ok) {
                      setEditingTitle(null);
                      await load();
                      onChanged();
                    }
                  } finally {
                    setSavingTitle(false);
                  }
                }}
                className="flex items-center gap-1.5"
              >
                <Input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  className="h-7 text-sm font-semibold"
                  autoFocus
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={savingTitle}
                  className="h-7 px-2"
                  title={tr("Save", "Salvar")}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingTitle(null)}
                  className="h-7 px-2"
                  title={tr("Cancel", "Cancelar")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </form>
            ) : (
              <>
                <h3 className="text-base font-semibold">{detail.lesson.title}</h3>
                <button
                  type="button"
                  onClick={() => setEditingTitle(detail.lesson.title)}
                  title={tr("Rename lesson", "Renomear aula")}
                  aria-label={tr(
                    `Rename lesson ${detail.lesson.title}`,
                    `Renomear aula ${detail.lesson.title}`
                  )}
                  className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <Badge variant="outline">{detail.lesson.difficulty}</Badge>
            <Badge variant="outline">{detail.lesson.status}</Badge>
          </div>
          {detail.lesson.description && (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">{detail.lesson.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" onClick={onStartStudyMode}>
            <Play className="h-3.5 w-3.5" /> {tr("Study Mode", "Modo Estudo")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const res = await fetch("/api/learning/study-task", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "task",
                  title: `${tr("Study:", "Estudar:")} ${detail.lesson.title}`,
                  courseId,
                  lessonId,
                  estimatedMinutes: detail.lesson.estimatedMinutes ?? 30,
                  autoCompleteLesson: false,
                }),
              });
              if (res.ok) showToast(tr("Study Task created!", "Tarefa de estudo criada!"));
            }}
          >
            <CheckSquare className="h-3.5 w-3.5" /> {tr("Create Study Task", "Criar Tarefa")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const start = new Date(Date.now() + 3600000);
              const end = new Date(start.getTime() + (detail.lesson.estimatedMinutes ?? 45) * 60000);
              const res = await fetch("/api/learning/study-task", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "calendar",
                  title: `${tr("Study:", "Estudar:")} ${detail.lesson.title}`,
                  startsAt: start.toISOString(),
                  endsAt: end.toISOString(),
                  courseId,
                  lessonId,
                }),
              });
              if (res.ok) showToast(tr("Scheduled on Calendar!", "Agendado no Calendário!"));
            }}
          >
            <Calendar className="h-3.5 w-3.5" /> {tr("Schedule", "Agendar")}
          </Button>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[var(--surface-muted)]">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-500">
          {feedback}
        </div>
      )}

      {(detail.lesson.objectives.length > 0 || detail.lesson.prerequisites.length > 0) && (
        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          {detail.lesson.objectives.length > 0 && (
            <div className="rounded-lg border border-[var(--border)] p-3">
              <div className="mb-1 font-semibold">{tr("Objectives", "Objetivos")}</div>
              <ul className="list-disc space-y-0.5 pl-4 text-[var(--muted-foreground)]">
                {detail.lesson.objectives.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          )}
          {detail.lesson.prerequisites.length > 0 && (
            <div className="rounded-lg border border-[var(--border)] p-3">
              <div className="mb-1 font-semibold">{tr("Prerequisites", "Pré-requisitos")}</div>
              <ul className="list-disc space-y-0.5 pl-4 text-[var(--muted-foreground)]">
                {detail.lesson.prerequisites.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Linked Notes inside Lesson */}
      <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <FileText className="h-3.5 w-3.5 text-[var(--accent)]" />
            {tr("Linked Notes", "Notas Vinculadas")} ({detail.linkedNotes.length})
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex flex-col sm:flex-row gap-1.5">
            <select
              value={linkNoteId}
              onChange={(e) => setLinkNoteId(e.target.value)}
              className="h-8 flex-1 min-w-0 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
            >
              <option value="">{tr("Link existing note...", "Vincular nota existente...")}</option>
              {allNotes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
            <div className="flex gap-1.5">
              <select
                value={linkPurpose}
                onChange={(e) => setLinkPurpose(e.target.value)}
                className="h-8 flex-1 sm:flex-initial rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 text-[11px]"
              >
                <option value="main_content">{tr("Main", "Principal")}</option>
                <option value="supplementary">{tr("Suppl.", "Complem.")}</option>
                <option value="reference">{tr("Ref.", "Ref.")}</option>
                <option value="exercise">{tr("Ex.", "Exerc.")}</option>
                <option value="summary">{tr("Summary", "Resumo")}</option>
                <option value="personal_annotation">{tr("Personal", "Pessoal")}</option>
              </select>
              <Button
                size="sm"
                variant="outline"
                disabled={!linkNoteId}
                onClick={async () => {
                  if (!linkNoteId) return;
                  await fetch("/api/learning/links", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      noteId: linkNoteId,
                      courseId,
                      lessonId,
                      purpose: linkPurpose,
                    }),
                  });
                  setLinkNoteId("");
                  await load();
                  onChanged();
                }}
              >
                <Link2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex gap-1.5">
            <Input
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              placeholder={tr("Create new note in lesson...", "Criar nova nota na aula...")}
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              onClick={async () => {
                if (!newNoteTitle.trim()) return;
                const nRes = await fetch("/api/notes", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title: newNoteTitle.trim() }),
                });
                if (nRes.ok) {
                  const nJson = await nRes.json();
                  const nid = nJson.data.note.id as string;
                  await fetch("/api/learning/links", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      noteId: nid,
                      courseId,
                      lessonId,
                      purpose: "main_content",
                    }),
                  });
                  setNewNoteTitle("");
                  await load();
                  onChanged();
                  onOpenNote(nid);
                }
              }}
            >
              <Plus className="h-3.5 w-3.5" /> {tr("Create", "Criar")}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          {detail.linkedNotes.map((n) => (
            <div
              key={n.linkId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  <span className={n.deleted ? "text-red-400 line-through" : ""}>{n.title}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {n.purpose.replace("_", " ")}
                  </Badge>
                </div>
                <div className="text-[11px] text-[var(--muted-foreground)]">
                  {n.deleted
                    ? tr("Original note was deleted", "A nota original foi excluída")
                    : `${n.readingMinutes} min ${tr("read", "leitura")} · ${
                        n.updatedAt ? new Date(n.updatedAt).toLocaleDateString(locale) : ""
                      }`}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {!n.deleted && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onOpenNote(n.noteId)}>
                    <Edit3 className="h-3 w-3" /> {tr("View / Edit", "Ver / Editar")}
                  </Button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    await fetch(`/api/learning/links?id=${n.linkId}`, { method: "DELETE" });
                    await load();
                    onChanged();
                  }}
                  className="rounded p-1 text-[var(--muted-foreground)] hover:text-red-500"
                  title={tr("Unlink note", "Desvincular nota")}
                >
                  <Unlink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Multi-Type Lesson Content System */}
      <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <BookOpen className="h-3.5 w-3.5 text-[var(--accent)]" />
          {tr("Lesson Contents", "Conteúdos da Aula")} ({detail.contents.length})
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!contentTitle.trim()) return;
            await fetch("/api/learning/contents", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "add_content",
                lessonId,
                contentType,
                title: contentTitle.trim(),
                body: contentBody.trim() || null,
                url: contentUrl.trim() || null,
                isRequired: contentRequired,
              }),
            });
            setContentTitle("");
            setContentBody("");
            setContentUrl("");
            await load();
          }}
          className="grid grid-cols-1 gap-2 sm:grid-cols-6"
        >
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
            className="h-8 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
          >
            <option value="text">{tr("Text", "Texto")}</option>
            <option value="video">{tr("Video", "Vídeo")}</option>
            <option value="external_link">{tr("External Link", "Link Externo")}</option>
            <option value="document">{tr("Document", "Documento")}</option>
            <option value="image">{tr("Image", "Imagem")}</option>
            <option value="code_snippet">{tr("Code Snippet", "Snippet de Código")}</option>
            <option value="exercise">{tr("Exercise", "Exercício")}</option>
            <option value="checklist">{tr("Checklist", "Checklist")}</option>
          </select>
          <Input
            value={contentTitle}
            onChange={(e) => setContentTitle(e.target.value)}
            placeholder={tr("Content title...", "Título do conteúdo...")}
            className="h-8 text-xs sm:col-span-2"
            required
          />
          <Input
            value={contentUrl}
            onChange={(e) => setContentUrl(e.target.value)}
            placeholder={tr("URL (optional)", "URL (opcional)")}
            className="h-8 text-xs"
          />
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={contentRequired}
              onChange={(e) => setContentRequired(e.target.checked)}
            />
            {tr("Required", "Obrigatório")}
          </label>
          <Button type="submit" size="sm" className="h-8">
            <Plus className="h-3.5 w-3.5" /> {tr("Add", "Adicionar")}
          </Button>
          {(contentType === "text" || contentType === "code_snippet" || contentType === "exercise") && (
            <textarea
              rows={2}
              value={contentBody}
              onChange={(e) => setContentBody(e.target.value)}
              placeholder={tr("Content body / code / instructions...", "Corpo / código / instruções...")}
              className="rounded-md border border-[var(--border)] bg-[var(--background)] p-2 text-xs sm:col-span-6"
            />
          )}
        </form>

        <div className="space-y-1.5 pt-1">
          {detail.contents.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/learning/contents", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: c.id, isCompleted: !c.isCompleted }),
                    });
                    await load();
                  }}
                >
                  {c.isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-[var(--muted-foreground)]" />
                  )}
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className={c.isCompleted ? "line-through text-[var(--muted-foreground)]" : ""}>
                      {c.noteDeleted ? `${c.title} (${tr("Removed", "Removida")})` : c.noteTitle}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {c.contentType}
                    </Badge>
                    {!c.isRequired && (
                      <Badge variant="outline" className="text-[10px]">
                        {tr("Optional", "Opcional")}
                      </Badge>
                    )}
                  </div>
                  {c.body && <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)] line-clamp-2">{c.body}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {c.noteId && !c.noteDeleted && (
                  <button
                    type="button"
                    onClick={() => onOpenNote(c.noteId!)}
                    className="text-[var(--accent)] hover:underline"
                  >
                    {tr("Edit", "Editar")}
                  </button>
                )}
                {c.url && (
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)]">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    await fetch(`/api/learning/contents?id=${c.id}`, { method: "DELETE" });
                    await load();
                  }}
                  className="text-[var(--muted-foreground)] hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
