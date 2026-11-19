"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CheckSquare,
  ExternalLink,
  FileText,
  Inbox,
  Plus,
  Trash2,
} from "lucide-react";
import type { InboxItemRecord, ProjectRecord } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/providers/i18n-provider";

interface InboxWorkspaceProps {
  initialItems: InboxItemRecord[];
  projects: ProjectRecord[];
}

export function InboxWorkspace({ initialItems, projects }: InboxWorkspaceProps) {
  const { tr, language } = useI18n();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "processed" | "archived">("pending");
  const [type, setType] = useState<"note" | "idea" | "link" | "task" | "quick_note">("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [selectedProjectByItem, setSelectedProjectByItem] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: items = initialItems } = useQuery<InboxItemRecord[]>({
    queryKey: ["inbox"],
    queryFn: async () => {
      const res = await fetch("/api/inbox");
      if (!res.ok) throw new Error("Failed to load inbox");
      const json = await res.json();
      return json.data.items;
    },
    initialData: initialItems,
  });

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["inbox"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["notes"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
    ]);
  };

  const handleCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim() || null,
          content: content.trim(),
          url: url.trim() || null,
        }),
      });
      if (res.ok) {
        setTitle("");
        setContent("");
        setUrl("");
        await refreshAll();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvert = async (
    itemId: string,
    targetType: "note" | "task" | "bookmark"
  ) => {
    setBusyId(itemId);
    try {
      const projectId = selectedProjectByItem[itemId] || null;
      const res = await fetch(`/api/inbox/${itemId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, projectId }),
      });
      if (res.ok) {
        await refreshAll();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleArchive = async (itemId: string) => {
    setBusyId(itemId);
    try {
      await fetch(`/api/inbox/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      await refreshAll();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (itemId: string) => {
    setBusyId(itemId);
    try {
      await fetch(`/api/inbox/${itemId}`, { method: "DELETE" });
      await refreshAll();
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveEdit = async (itemId: string) => {
    if (!editContent.trim()) return;
    setBusyId(itemId);
    try {
      const res = await fetch(`/api/inbox/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
        await refreshAll();
      }
    } finally {
      setBusyId(null);
    }
  };

  const filtered = items.filter((item) => item.status === filter);

  const typeLabel = (itemType: string) => {
    switch (itemType) {
      case "note":
        return tr("Note", "Nota");
      case "idea":
        return tr("Idea", "Ideia");
      case "task":
        return tr("Task", "Tarefa");
      case "link":
        return tr("Link", "Link");
      case "quick_note":
        return tr("Quick note", "Nota rápida");
      default:
        return itemType.replace("_", " ");
    }
  };

  const tabLabel = (tab: "pending" | "processed" | "archived") => {
    switch (tab) {
      case "pending":
        return tr("Pending", "Pendentes");
      case "processed":
        return tr("Processed", "Processados");
      case "archived":
        return tr("Archived", "Arquivados");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {tr("Universal Inbox", "Caixa de Entrada Universal")}
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {tr(
            "Capture thoughts, links, and tasks immediately, then triage them into Notes, Tasks, or Projects.",
            "Capture ideias, links e tarefas imediatamente e depois organize em Notas, Tarefas ou Projetos."
          )}
        </p>
      </div>

      {/* Quick Capture Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr("Quick Capture", "Captura Rápida")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCapture} className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {(["note", "idea", "task", "link", "quick_note"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    type === t
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "bg-[var(--surface-muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {typeLabel(t)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                placeholder={tr("Title (optional)...", "Título (opcional)...")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {type === "link" && (
                <Input
                  type="url"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              )}
            </div>

            <textarea
              rows={2}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={tr("Write anything to capture...", "Escreva qualquer coisa para capturar...")}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                <Plus className="h-4 w-4" />
                {submitting
                  ? tr("Capturing...", "Capturando...")
                  : tr("Add to Inbox", "Adicionar à Caixa de Entrada")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
        {(["pending", "processed", "archived"] as const).map((tab) => {
          const count = items.filter((i) => i.status === tab).length;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === tab
                  ? "bg-[var(--surface-muted)] text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {tabLabel(tab)} ({count})
            </button>
          );
        })}
      </div>

      {/* Inbox List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="mb-3 h-8 w-8 text-[var(--muted-foreground)]" />
            <p className="text-sm font-medium">
              {filter === "pending"
                ? tr("No pending items in your Inbox", "Nenhum item pendente na sua Caixa de Entrada")
                : filter === "processed"
                  ? tr("No processed items in your Inbox", "Nenhum item processado na sua Caixa de Entrada")
                  : tr("No archived items in your Inbox", "Nenhum item arquivado na sua Caixa de Entrada")}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {tr(
                "Use the capture form above or press Ctrl+Shift+I from anywhere in Nikki.",
                "Use o formulário acima ou pressione Ctrl+Shift+I de qualquer lugar no Nikki."
              )}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{typeLabel(item.type)}</Badge>
                      {item.title && (
                        <span className="text-sm font-semibold truncate">{item.title}</span>
                      )}
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {new Date(item.createdAt).toLocaleDateString(locale)}
                      </span>
                    </div>

                    {editingId === item.id ? (
                      <div className="space-y-2 pt-1">
                        <textarea
                          rows={3}
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={busyId === item.id}
                          >
                            {tr("Save", "Salvar")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                          >
                            {tr("Cancel", "Cancelar")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p
                        className="text-sm whitespace-pre-wrap cursor-pointer hover:opacity-80"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditContent(item.content);
                        }}
                        title={tr("Click to edit", "Clique para editar")}
                      >
                        {item.content}
                      </p>
                    )}

                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {item.url}
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {item.status !== "archived" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleArchive(item.id)}
                        disabled={busyId === item.id}
                        title={tr("Archive", "Arquivar")}
                        aria-label={tr("Archive inbox item", "Arquivar item da caixa de entrada")}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item.id)}
                      disabled={busyId === item.id}
                      title={tr("Delete", "Excluir")}
                      aria-label={tr("Delete inbox item", "Excluir item da caixa de entrada")}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>

                {item.status === "pending" && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
                    <select
                      value={selectedProjectByItem[item.id] ?? ""}
                      onChange={(e) =>
                        setSelectedProjectByItem((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
                      aria-label={tr("Associate with project", "Associar a um projeto")}
                    >
                      <option value="">{tr("No project", "Sem projeto")}</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === item.id}
                        onClick={() => handleConvert(item.id, "note")}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {tr("Convert to Note", "Converter em Nota")}
                      </Button>
                      <Button
                        size="sm"
                        disabled={busyId === item.id}
                        onClick={() => handleConvert(item.id, "task")}
                      >
                        <CheckSquare className="h-3.5 w-3.5" />
                        {tr("Convert to Task", "Converter em Tarefa")}
                      </Button>
                      {(item.url || /https?:\/\/\S+/.test(item.content)) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === item.id}
                          onClick={() => handleConvert(item.id, "bookmark")}
                        >
                          {tr("Save as Bookmark", "Salvar como Favorito")}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {item.status === "processed" && item.convertedToId && (
                  <div className="border-t border-[var(--border)] pt-2 text-xs text-[var(--muted-foreground)]">
                    {tr("Converted to", "Convertido em")}{" "}
                    <Link
                      href={
                        item.convertedToType === "note"
                          ? `/notes?id=${item.convertedToId}`
                          : item.convertedToType === "bookmark"
                            ? `/bookmarks?id=${item.convertedToId}`
                            : `/tasks?taskId=${item.convertedToId}`
                      }
                      className="font-medium text-[var(--accent)] hover:underline"
                    >
                      {item.convertedToType === "note"
                        ? tr("Note →", "Nota →")
                        : item.convertedToType === "bookmark"
                          ? tr("Bookmark →", "Favorito →")
                          : tr("Task →", "Tarefa →")}
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
