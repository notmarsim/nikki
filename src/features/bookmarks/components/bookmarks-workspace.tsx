"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark as BookmarkIcon,
  Download,
  ExternalLink,
  FolderPlus,
  Grid,
  List,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/providers/i18n-provider";

export interface BookmarkItem {
  id: string;
  url: string;
  canonicalUrl: string;
  title: string;
  description: string | null;
  domain: string;
  thumbnailUrl: string | null;
  faviconUrl: string | null;
  resourceType: string;
  collectionId: string | null;
  readingStatus: string;
  isFavorite: boolean;
  tags: string[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface BookmarkCollectionItem {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  icon: string;
  color: string;
}

export function BookmarksWorkspace({
  initialData,
}: {
  initialData: {
    bookmarks: BookmarkItem[];
    collections: BookmarkCollectionItem[];
  };
}) {
  const { tr } = useI18n();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterTab, setFilterTab] = useState<
    "all" | "read_later" | "favorites" | "archived"
  >("all");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"updated" | "created" | "title" | "domain">("updated");

  // Add Bookmark state
  const [urlInput, setUrlInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [typeInput, setTypeInput] = useState("website");
  const [colInput, setColInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Collection state
  const [newColName, setNewColName] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importHtml, setImportHtml] = useState("");
  const [importResult, setImportResult] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (filterTab === "read_later") p.set("readLater", "true");
    if (filterTab === "favorites") p.set("favoritesOnly", "true");
    if (filterTab === "archived") p.set("readingStatus", "archived");
    if (selectedCollectionId) p.set("collectionId", selectedCollectionId);
    if (selectedType) p.set("resourceType", selectedType);
    if (search.trim()) p.set("q", search.trim());
    p.set("sortBy", sortBy);
    return p.toString();
  }, [filterTab, selectedCollectionId, selectedType, search, sortBy]);

  const { data = initialData } = useQuery<{
    bookmarks: BookmarkItem[];
    collections: BookmarkCollectionItem[];
  }>({
    queryKey: ["bookmarks", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/bookmarks?${queryString}`);
      if (!res.ok) throw new Error("Failed to load bookmarks");
      const json = await res.json();
      return json.data;
    },
    initialData,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const handleFetchMetadata = async () => {
    if (!urlInput.trim()) return;
    setFetchingMeta(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/bookmarks/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(
          json?.error?.message ??
            tr(
              "Could not fetch metadata; you can fill fields manually.",
              "Não foi possível obter os metadados; você pode preencher os campos manualmente."
            )
        );
        return;
      }
      const m = json.data.metadata;
      setTitleInput(m.title ?? "");
      setDescInput(m.description ?? "");
      setTypeInput(m.resourceType ?? "website");
    } finally {
      setFetchingMeta(false);
    }
  };

  const handleCreateBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setCreating(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: urlInput.trim(),
          title: titleInput.trim() || undefined,
          description: descInput.trim() || null,
          resourceType: typeInput,
          collectionId: colInput || null,
          tags: tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json?.error?.message ?? tr("Failed to save bookmark", "Falha ao salvar favorito"));
        return;
      }
      setUrlInput("");
      setTitleInput("");
      setDescInput("");
      setTagsInput("");
      refresh();
    } finally {
      setCreating(false);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    const res = await fetch("/api/bookmarks/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newColName.trim() }),
    });
    if (res.ok) {
      setNewColName("");
      refresh();
    }
  };

  const handleDeleteCollection = async (id: string, name: string) => {
    if (
      !window.confirm(
        tr(
          `Delete collection "${name}"? Bookmarks inside it will be kept.`,
          `Excluir a coleção "${name}"? Os favoritos dentro dela serão mantidos.`
        )
      )
    ) {
      return;
    }
    const res = await fetch(`/api/bookmarks/collections/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedCollectionId === id) setSelectedCollectionId("");
      refresh();
    }
  };

  const handleToggleFavorite = async (b: BookmarkItem) => {
    await fetch(`/api/bookmarks/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: !b.isFavorite }),
    });
    refresh();
  };

  const handleChangeStatus = async (b: BookmarkItem, readingStatus: string) => {
    await fetch(`/api/bookmarks/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readingStatus }),
    });
    refresh();
  };

  const handleDeleteBookmark = async (id: string) => {
    await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
    refresh();
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importHtml.trim()) return;
    const res = await fetch("/api/bookmarks/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: importHtml,
        collectionId: selectedCollectionId || null,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      setImportResult(
        tr(
          `Imported ${json.data.imported} of ${json.data.totalFound} links (${json.data.skipped} skipped).`,
          `Importados ${json.data.imported} de ${json.data.totalFound} links (${json.data.skipped} ignorados).`
        )
      );
      setImportHtml("");
      refresh();
    }
  };

  const resourceTypeLabel = (type: string) => {
    switch (type) {
      case "website":
        return tr("Website", "Site");
      case "article":
        return tr("Article", "Artigo");
      case "docs":
        return tr("Documentation", "Documentação");
      case "github":
        return tr("GitHub Repo", "Repositório GitHub");
      case "video":
        return tr("Video", "Vídeo");
      case "pdf":
        return "PDF";
      case "book":
        return tr("Book", "Livro");
      case "tool":
        return tr("Tool", "Ferramenta");
      default:
        return type;
    }
  };

  const viewTabs = [
    { id: "all" as const, label: tr("All Bookmarks", "Todos os Favoritos") },
    { id: "read_later" as const, label: tr("Read Later", "Ler Depois") },
    { id: "favorites" as const, label: tr("Favorites", "Destaques") },
    { id: "archived" as const, label: tr("Archived", "Arquivados") },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookmarkIcon className="h-6 w-6 text-[var(--accent)]" />
            {tr("Bookmarks & Digital Library", "Favoritos e Biblioteca Digital")}
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {tr(
              "Save articles, docs, repositories, and videos with automatic previews and collections.",
              "Salve artigos, documentações, repositórios e vídeos com prévias automáticas e coleções."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
            <Upload className="h-3.5 w-3.5" /> {tr("Import HTML", "Importar HTML")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.assign("/api/bookmarks/export?format=html")}
          >
            <Download className="h-3.5 w-3.5" /> {tr("Export HTML", "Exportar HTML")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.assign("/api/bookmarks/export?format=json")}
          >
            JSON
          </Button>
        </div>
      </div>

      {/* Add Bookmark Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {tr("Save New Resource", "Salvar Novo Recurso")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateBookmark} className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://..."
                required
                className="flex-1 min-w-[240px]"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleFetchMetadata}
                disabled={fetchingMeta || !urlInput.trim()}
              >
                <Sparkles className="h-4 w-4" />
                {fetchingMeta
                  ? tr("Fetching...", "Buscando...")
                  : tr("Fetch Metadata", "Buscar Metadados")}
              </Button>
              <Button type="submit" disabled={creating || !urlInput.trim()}>
                <Plus className="h-4 w-4" />
                {creating
                  ? tr("Saving...", "Salvando...")
                  : tr("Save Bookmark", "Salvar Favorito")}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder={tr(
                  "Title (auto-extracted if blank)",
                  "Título (extraído automaticamente se vazio)"
                )}
              />
              <Input
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder={tr("Short description", "Descrição curta")}
              />
              <select
                value={typeInput}
                onChange={(e) => setTypeInput(e.target.value)}
                className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 text-sm"
              >
                <option value="website">{tr("Website", "Site")}</option>
                <option value="article">{tr("Article", "Artigo")}</option>
                <option value="docs">{tr("Documentation", "Documentação")}</option>
                <option value="github">{tr("GitHub Repo", "Repositório GitHub")}</option>
                <option value="video">{tr("Video", "Vídeo")}</option>
                <option value="pdf">PDF</option>
                <option value="book">{tr("Book", "Livro")}</option>
                <option value="tool">{tr("Tool", "Ferramenta")}</option>
              </select>
              <div className="flex gap-2">
                <select
                  value={colInput}
                  onChange={(e) => setColInput(e.target.value)}
                  className="h-9 flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
                >
                  <option value="">{tr("No collection", "Sem coleção")}</option>
                  {data.collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder={tr("tags, csv", "tags, separadas")}
                  className="w-32"
                />
              </div>
            </div>

            {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
          </form>
        </CardContent>
      </Card>

      {/* Main Split: Collections Sidebar + Library Grid/List */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{tr("Views", "Visualizações")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {viewTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium ${
                    filterTab === tab.id
                      ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{tr("Collections", "Coleções")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setSelectedCollectionId("")}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs ${
                    selectedCollectionId === ""
                      ? "bg-[var(--surface-muted)] font-semibold"
                      : "hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  {tr("All Collections", "Todas as Coleções")}
                </button>
                {data.collections.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs ${
                      selectedCollectionId === c.id
                        ? "bg-[var(--surface-muted)] font-semibold"
                        : "hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCollectionId(c.id)}
                      className="flex-1 truncate text-left"
                    >
                      {c.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCollection(c.id, c.name)}
                      className="ml-1 text-[var(--muted-foreground)] hover:text-red-500"
                      title={tr("Delete collection", "Excluir coleção")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleCreateCollection} className="flex gap-1 pt-2">
                <Input
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder={tr("New collection...", "Nova coleção...")}
                  className="h-8 text-xs"
                />
                <Button type="submit" size="sm" variant="outline" className="h-8 px-2">
                  <FolderPlus className="h-3.5 w-3.5" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-4 lg:col-span-9">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr(
                  "Search title, URL, domain...",
                  "Buscar título, URL, domínio..."
                )}
                className="pl-8 h-9 text-xs"
              />
            </div>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
            >
              <option value="">{tr("All types", "Todos os tipos")}</option>
              <option value="website">{tr("Website", "Site")}</option>
              <option value="article">{tr("Article", "Artigo")}</option>
              <option value="docs">{tr("Docs", "Docs")}</option>
              <option value="github">GitHub</option>
              <option value="video">{tr("Video", "Vídeo")}</option>
              <option value="pdf">PDF</option>
              <option value="tool">{tr("Tool", "Ferramenta")}</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "updated" | "created" | "title" | "domain")
              }
              className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
            >
              <option value="updated">{tr("Recently Updated", "Atualizados Recentemente")}</option>
              <option value="created">{tr("Recently Added", "Adicionados Recentemente")}</option>
              <option value="title">{tr("Title A-Z", "Título A-Z")}</option>
              <option value="domain">{tr("Domain", "Domínio")}</option>
            </select>

            <div className="flex rounded-md border border-[var(--border)] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`rounded p-1.5 ${
                  viewMode === "grid" ? "bg-[var(--surface-muted)]" : ""
                }`}
                title={tr("Grid View", "Visualização em Grade")}
              >
                <Grid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`rounded p-1.5 ${
                  viewMode === "list" ? "bg-[var(--surface-muted)]" : ""
                }`}
                title={tr("List View", "Visualização em Lista")}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Results */}
          {data.bookmarks.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center text-sm text-[var(--muted-foreground)]">
                {tr(
                  "No bookmarks match your filters yet. Save your first URL above!",
                  "Nenhum favorito corresponde aos seus filtros ainda. Salve sua primeira URL acima!"
                )}
              </CardContent>
            </Card>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.bookmarks.map((b) => (
                <Card key={b.id} className="flex flex-col justify-between overflow-hidden">
                  <div>
                    {b.thumbnailUrl && (
                      <div className="h-32 w-full overflow-hidden border-b border-[var(--border)] bg-[var(--surface-muted)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={b.thumbnailUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={b.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-sm hover:text-[var(--accent)] line-clamp-2"
                        >
                          {b.title}
                        </a>
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(b)}
                          className={`shrink-0 ${
                            b.isFavorite
                              ? "text-amber-400"
                              : "text-[var(--muted-foreground)] hover:text-amber-400"
                          }`}
                          title={tr("Toggle favorite", "Alternar destaque")}
                        >
                          <Star
                            className="h-4 w-4"
                            fill={b.isFavorite ? "currentColor" : "none"}
                          />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                        <span className="truncate">{b.domain}</span>
                        <span>·</span>
                        <span>{resourceTypeLabel(b.resourceType)}</span>
                      </div>

                      {b.description && (
                        <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">
                          {b.description}
                        </p>
                      )}

                      {b.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {b.tags.map((t) => (
                            <Badge key={t} variant="outline" className="text-[10px]">
                              #{t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2 text-xs">
                    <select
                      value={b.readingStatus}
                      onChange={(e) => handleChangeStatus(b, e.target.value)}
                      className="rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-[11px]"
                    >
                      <option value="unread">{tr("Unread", "Não lido")}</option>
                      <option value="reading">{tr("Reading", "Lendo")}</option>
                      <option value="completed">{tr("Completed", "Concluído")}</option>
                      <option value="archived">{tr("Archived", "Arquivado")}</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <a
                        href={b.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        title={tr("Open link", "Abrir link")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteBookmark(b.id)}
                        className="text-[var(--muted-foreground)] hover:text-red-500"
                        title={tr("Delete bookmark", "Excluir favorito")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {data.bookmarks.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:text-[var(--accent)] truncate block"
                    >
                      {b.title}
                    </a>
                    <div className="text-xs text-[var(--muted-foreground)] truncate">
                      {b.domain} · {resourceTypeLabel(b.resourceType)}
                      {b.tags.length > 0 && ` · ${b.tags.map((t) => `#${t}`).join(" ")}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={b.readingStatus}
                      onChange={(e) => handleChangeStatus(b, e.target.value)}
                      className="rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-xs"
                    >
                      <option value="unread">{tr("Unread", "Não lido")}</option>
                      <option value="reading">{tr("Reading", "Lendo")}</option>
                      <option value="completed">{tr("Completed", "Concluído")}</option>
                      <option value="archived">{tr("Archived", "Arquivado")}</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(b)}
                      className={b.isFavorite ? "text-amber-400" : "text-[var(--muted-foreground)]"}
                      title={tr("Toggle favorite", "Alternar destaque")}
                    >
                      <Star className="h-4 w-4" fill={b.isFavorite ? "currentColor" : "none"} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBookmark(b.id)}
                      className="text-[var(--muted-foreground)] hover:text-red-500"
                      title={tr("Delete bookmark", "Excluir favorito")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Import HTML Modal */}
      {showImportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowImportModal(false)}
        >
          <form
            className="w-full max-w-lg space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleImport}
          >
            <h2 className="text-base font-semibold">
              {tr("Import Browser Bookmarks (HTML)", "Importar Favoritos do Navegador (HTML)")}
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              {tr(
                "Paste Netscape HTML bookmark export content or load a",
                "Cole o conteúdo HTML de exportação Netscape ou carregue um arquivo"
              )}{" "}
              <code>.html</code>
              {tr(" file.", ".")}
            </p>
            <input
              type="file"
              accept=".html,.htm"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                  setImportResult(tr("File exceeds 5 MB limit.", "O arquivo excede o limite de 5 MB."));
                  return;
                }
                setImportHtml(await file.text());
              }}
              className="text-xs"
            />
            <textarea
              rows={6}
              value={importHtml}
              onChange={(e) => setImportHtml(e.target.value)}
              placeholder="<DL><p><DT><A HREF=...>..."
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2 text-xs font-mono"
            />
            {importResult && <p className="text-xs text-emerald-500">{importResult}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowImportModal(false)}
              >
                {tr("Close", "Fechar")}
              </Button>
              <Button type="submit" size="sm" disabled={!importHtml.trim()}>
                {tr("Import", "Importar")}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
