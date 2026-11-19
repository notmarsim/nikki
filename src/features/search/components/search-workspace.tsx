"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Bookmark,
  Calendar,
  CheckSquare,
  Code2,
  FileText,
  Flame,
  FolderKanban,
  GraduationCap,
  Layers,
  Search,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  ALL_SEARCH_TYPES,
  type GlobalSearchResult,
  type SearchEntityType,
} from "@/modules/search/types";

function TypeIcon({ type }: { type: SearchEntityType }) {
  const cls = "h-4 w-4 shrink-0 text-[var(--accent)]";
  switch (type) {
    case "note":
      return <FileText className={cls} />;
    case "task":
      return <CheckSquare className={cls} />;
    case "project":
      return <FolderKanban className={cls} />;
    case "course":
    case "lesson":
      return <GraduationCap className={cls} />;
    case "event":
      return <Calendar className={cls} />;
    case "deck":
      return <Layers className={cls} />;
    case "habit":
      return <Flame className={cls} />;
    case "bookmark":
      return <Bookmark className={cls} />;
    case "snippet":
    case "reference":
      return <Code2 className={cls} />;
    case "command":
      return <Terminal className={cls} />;
  }
}

export function SearchWorkspace() {
  const { tr, language } = useI18n();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const typeLabel = (type: SearchEntityType) => {
    switch (type) {
      case "note":
        return tr("Note", "Nota");
      case "task":
        return tr("Task", "Tarefa");
      case "project":
        return tr("Project", "Projeto");
      case "course":
        return tr("Course", "Curso");
      case "lesson":
        return tr("Lesson", "Aula");
      case "event":
        return tr("Event", "Evento");
      case "deck":
        return tr("Deck", "Baralho");
      case "habit":
        return tr("Habit", "Hábito");
      case "bookmark":
        return tr("Bookmark", "Favorito");
      case "snippet":
        return tr("Snippet", "Snippet");
      case "command":
        return tr("Command", "Comando");
      case "reference":
        return tr("Reference", "Referência");
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setOffset(0);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results = [], isFetching } = useQuery<GlobalSearchResult[]>({
    queryKey: ["advanced-search", debouncedQuery, typeFilter, tagFilter, offset],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const p = new URLSearchParams();
      p.set("q", debouncedQuery.trim());
      if (typeFilter) p.set("type", typeFilter);
      if (tagFilter.trim()) p.set("tag", tagFilter.trim());
      p.set("limit", String(limit));
      p.set("offset", String(offset));
      const res = await fetch(`/api/search?${p.toString()}`);
      if (!res.ok) throw new Error("Search failed");
      const json = await res.json();
      return json.data.results;
    },
    enabled: debouncedQuery.trim().length > 0,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Search className="h-6 w-6 text-[var(--accent)]" />
          {tr("Advanced Global Search", "Busca Global Avançada")}
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {tr(
            "Full-text and fuzzy trigram search across Notes, Tasks, Projects, Courses, Bookmarks, Snippets, and Commands.",
            "Busca textual completa e aproximada em Notas, Tarefas, Projetos, Cursos, Favoritos, Snippets e Comandos."
          )}
        </p>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr("Search anything across Nikki...", "Buscar qualquer coisa no Nikki...")}
                className="pl-9"
                autoFocus
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setOffset(0);
              }}
              className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 text-sm"
            >
              <option value="">{tr("All types", "Todos os tipos")}</option>
              {ALL_SEARCH_TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
            <Input
              value={tagFilter}
              onChange={(e) => {
                setTagFilter(e.target.value);
                setOffset(0);
              }}
              placeholder={tr("Filter by #tag", "Filtrar por #tag")}
              className="w-40"
            />
          </div>
        </CardContent>
      </Card>

      {!debouncedQuery.trim() ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--muted-foreground)]">
            {tr(
              "Type a keyword, title, code token, or tag to search across your entire workspace.",
              "Digite uma palavra-chave, título, código ou tag para buscar em todo o seu espaço de trabalho."
            )}
          </CardContent>
        </Card>
      ) : isFetching && results.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--muted-foreground)]">
            {tr("Searching...", "Buscando...")}
          </CardContent>
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--muted-foreground)]">
            {tr("No results found for", "Nenhum resultado encontrado para")} &ldquo;{debouncedQuery}&rdquo;.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {results.map((r) => (
            <Link key={`${r.type}-${r.id}`} href={r.href}>
              <Card className="hover:border-[var(--accent)] transition-colors">
                <CardContent className="py-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5">
                      <TypeIcon type={r.type} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{r.title}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {typeLabel(r.type)}
                        </Badge>
                        {r.context && (
                          <Badge variant="outline" className="text-[10px]">
                            {r.context}
                          </Badge>
                        )}
                      </div>
                      {r.snippet && (
                        <p
                          className="mt-1 text-xs text-[var(--muted-foreground)] line-clamp-2"
                          dangerouslySetInnerHTML={{
                            __html: r.snippet
                              .replace(/<(?!\/?b\b)[^>]*>/gi, "")
                              .replace(/<b>/g, "<mark class='bg-[var(--accent)]/25 text-inherit rounded px-0.5'>")
                              .replace(/<\/b>/g, "</mark>"),
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] text-[var(--muted-foreground)]">
                    {new Date(r.updatedAt).toLocaleDateString(locale)}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
            >
              {tr("Previous", "Anterior")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={results.length < limit}
              onClick={() => setOffset((o) => o + limit)}
            >
              {tr("Next", "Próxima")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
