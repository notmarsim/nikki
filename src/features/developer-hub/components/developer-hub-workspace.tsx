"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  GitBranch,
  Plus,
  Search,
  Star,
  Terminal,
  Trash2,
  Unlink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  extractCommandPlaceholders,
  interpolateCommand,
  SUPPORTED_COMMAND_PLATFORMS,
  SUPPORTED_SNIPPET_LANGUAGES,
} from "@/modules/developer-hub/utils";
import { useI18n } from "@/components/providers/i18n-provider";
import { CodeHighlight } from "./code-highlight";

export interface DeveloperOverviewPayload {
  snippets: Array<{
    id: string;
    title: string;
    description: string | null;
    language: string;
    code: string;
    projectId: string | null;
    sourceNoteId: string | null;
    isFavorite: boolean;
    tags: string[];
    updatedAt: string | Date;
  }>;
  commands: Array<{
    id: string;
    title: string;
    description: string | null;
    command: string;
    platform: string;
    notes: string | null;
    isFavorite: boolean;
    tags: string[];
  }>;
  references: Array<{
    id: string;
    title: string;
    url: string;
    technology: string;
    versionLabel: string | null;
    description: string | null;
    projectId: string | null;
  }>;
  categories: Array<{ id: string; name: string }>;
  cheatsheets: Array<{
    id: string;
    title: string;
    contentText: string;
    updatedAt: string | Date;
  }>;
  internalDocs: Array<{
    id: string;
    title: string;
    contentText: string;
    updatedAt: string | Date;
  }>;
  projects: Array<{ id: string; name: string }>;
  githubConnection: {
    id: string;
    accountLogin: string;
    avatarUrl: string | null;
  } | null;
  linkedRepositories: Array<{
    id: string;
    projectId: string;
    repositoryIdentifier: string;
    repositoryUrl: string;
    defaultBranch: string;
    language: string | null;
  }>;
}

type DevTab =
  | "overview"
  | "snippets"
  | "commands"
  | "cheatsheets"
  | "documentation"
  | "github";

export function DeveloperHubWorkspace({
  initialOverview,
  initialTab = "overview",
}: {
  initialOverview: DeveloperOverviewPayload;
  initialTab?: DevTab;
}) {
  const { tr, language } = useI18n();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<DevTab>(initialTab);
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  // Snippet form
  const [snipTitle, setSnipTitle] = useState("");
  const [snipLang, setSnipLang] = useState("typescript");
  const [snipDesc, setSnipDesc] = useState("");
  const [snipCode, setSnipCode] = useState("");
  const [snipProj, setSnipProj] = useState("");
  const [snipTags, setSnipTags] = useState("");

  // Command form + parameter inputs
  const [cmdTitle, setCmdTitle] = useState("");
  const [cmdText, setCmdText] = useState("");
  const [cmdPlatform, setCmdPlatform] = useState("linux");
  const [cmdDesc, setCmdDesc] = useState("");
  const [cmdParamsById, setCmdParamsById] = useState<Record<string, Record<string, string>>>({});
  const [copiedCmdId, setCopiedCmdId] = useState<string | null>(null);

  // Reference form
  const [refTitle, setRefTitle] = useState("");
  const [refUrl, setRefUrl] = useState("");
  const [refTech, setRefTech] = useState("");
  const [refVer, setRefVer] = useState("");
  const [refDesc, setRefDesc] = useState("");

  // GitHub state
  const [ghToken, setGhToken] = useState("");
  const [ghError, setGhError] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [linkProjectId, setLinkProjectId] = useState<string>("");

  const { data: overview = initialOverview } = useQuery<DeveloperOverviewPayload>({
    queryKey: ["developer-hub-overview"],
    queryFn: async () => {
      const res = await fetch("/api/developer-hub/overview");
      if (!res.ok) throw new Error("Failed to load developer hub");
      const json = await res.json();
      return json.data;
    },
    initialData: initialOverview,
  });

  const { data: ghReposData, isLoading: loadingRepos, error: ghReposError } = useQuery({
    queryKey: ["github-repos", overview.githubConnection?.id],
    queryFn: async () => {
      const res = await fetch("/api/developer-hub/github/repos");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load repositories");
      return json.data.repositories as Array<{
        id: number;
        fullName: string;
        description: string | null;
        isPrivate: boolean;
        htmlUrl: string;
        language: string | null;
        defaultBranch: string;
        updatedAt: string;
        stars: number;
      }>;
    },
    enabled: Boolean(overview.githubConnection) && tab === "github",
  });

  const { data: repoDetail } = useQuery({
    queryKey: ["github-repo-detail", selectedRepo],
    queryFn: async () => {
      if (!selectedRepo) return null;
      const [owner, repo] = selectedRepo.split("/");
      const res = await fetch(`/api/developer-hub/github/repos/${owner}/${repo}`);
      if (!res.ok) throw new Error("Failed to load repo details");
      const json = await res.json();
      return json.data as {
        overview: { full_name: string; description: string | null; html_url: string; stargazers_count: number; forks_count: number };
        issues: Array<{ id: number; number: number; title: string; html_url: string }>;
        pulls: Array<{ id: number; number: number; title: string; html_url: string }>;
        releases: Array<{ id: number; tag_name: string; html_url: string }>;
        commits: Array<{ sha: string; message: string; author: string; date: string; url: string }>;
      };
    },
    enabled: Boolean(selectedRepo),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["developer-hub-overview"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const projectMap = useMemo(
    () => new Map(overview.projects.map((p) => [p.id, p.name])),
    [overview.projects]
  );

  const filteredSnippets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return overview.snippets.filter((s) => {
      if (langFilter && s.language !== langFilter) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.tags.some((t) => t.includes(q))
      );
    });
  }, [overview.snippets, search, langFilter]);

  const filteredCommands = useMemo(() => {
    const q = search.trim().toLowerCase();
    return overview.commands.filter((c) => {
      if (platformFilter && c.platform !== platformFilter) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.command.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [overview.commands, search, platformFilter]);

  const handleCreateSnippet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snipTitle.trim() || !snipCode.trim()) return;
    const res = await fetch("/api/developer-hub/snippets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: snipTitle.trim(),
        language: snipLang,
        description: snipDesc.trim() || null,
        code: snipCode,
        projectId: snipProj || null,
        tags: snipTags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    });
    if (res.ok) {
      setSnipTitle("");
      setSnipDesc("");
      setSnipCode("");
      setSnipTags("");
      refresh();
    }
  };

  const handleCreateCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdTitle.trim() || !cmdText.trim()) return;
    const res = await fetch("/api/developer-hub/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: cmdTitle.trim(),
        command: cmdText.trim(),
        platform: cmdPlatform,
        description: cmdDesc.trim() || null,
      }),
    });
    if (res.ok) {
      setCmdTitle("");
      setCmdText("");
      setCmdDesc("");
      refresh();
    }
  };

  const handleCreateReference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refTitle.trim() || !refUrl.trim() || !refTech.trim()) return;
    const res = await fetch("/api/developer-hub/references", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: refTitle.trim(),
        url: refUrl.trim(),
        technology: refTech.trim(),
        versionLabel: refVer.trim() || null,
        description: refDesc.trim() || null,
      }),
    });
    if (res.ok) {
      setRefTitle("");
      setRefUrl("");
      setRefTech("");
      setRefVer("");
      setRefDesc("");
      refresh();
    }
  };

  const handleCreateTechNote = async (docKind: "cheatsheet" | "documentation") => {
    const title =
      docKind === "cheatsheet"
        ? tr("Untitled Cheatsheet", "Cheatsheet sem título")
        : tr("Untitled Technical Doc", "Documento Técnico sem título");
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        docKind,
        templateId: "tech_doc",
      }),
    });
    if (res.ok) {
      const json = await res.json();
      router.push(`/notes?id=${json.data.note.id}`);
    }
  };

  const handleConnectGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    setGhError(null);
    const res = await fetch("/api/developer-hub/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: ghToken.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      setGhError(json?.error?.message ?? tr("Failed to connect GitHub", "Falha ao conectar o GitHub"));
      return;
    }
    setGhToken("");
    refresh();
  };

  const tabs = [
    { id: "overview" as const, label: tr("Overview", "Visão Geral") },
    { id: "snippets" as const, label: `${tr("Snippets", "Snippets")} (${overview.snippets.length})` },
    { id: "commands" as const, label: `${tr("Commands", "Comandos")} (${overview.commands.length})` },
    { id: "cheatsheets" as const, label: `${tr("Cheatsheets", "Cheatsheets")} (${overview.cheatsheets.length})` },
    {
      id: "documentation" as const,
      label: `${tr("Documentation", "Documentação")} (${overview.references.length + overview.internalDocs.length})`,
    },
    { id: "github" as const, label: "GitHub" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Code2 className="h-6 w-6 text-[var(--accent)]" />
            {tr("Developer Hub", "Dev Hub")}
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {tr(
              "Snippets, parameterized CLI commands, cheatsheets, technical docs, and GitHub overview.",
              "Snippets, comandos CLI parametrizados, cheatsheets, docs técnicos e visão geral do GitHub."
            )}
          </p>
        </div>

        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr("Filter snippets & commands...", "Filtrar snippets e comandos...")}
            className="pl-8 h-9 text-xs"
          />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card className="cursor-pointer" onClick={() => setTab("snippets")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-[var(--muted-foreground)]">
                  {tr("Snippets", "Snippets")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{overview.snippets.length}</CardContent>
            </Card>
            <Card className="cursor-pointer" onClick={() => setTab("commands")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-[var(--muted-foreground)]">
                  {tr("Commands", "Comandos")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{overview.commands.length}</CardContent>
            </Card>
            <Card className="cursor-pointer" onClick={() => setTab("cheatsheets")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-[var(--muted-foreground)]">
                  {tr("Cheatsheets", "Cheatsheets")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{overview.cheatsheets.length}</CardContent>
            </Card>
            <Card className="cursor-pointer" onClick={() => setTab("github")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-[var(--muted-foreground)]">
                  {tr("Linked Repos", "Repos Vinculados")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {overview.linkedRepositories.length}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {tr("Recent Snippets", "Snippets Recentes")}
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setTab("snippets")}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  {tr("View all →", "Ver todos →")}
                </button>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview.snippets.slice(0, 4).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
                  >
                    <span className="font-medium truncate">{s.title}</span>
                    <Badge variant="outline">{s.language}</Badge>
                  </div>
                ))}
                {overview.snippets.length === 0 && (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {tr("No snippets yet.", "Nenhum snippet ainda.")}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {tr("Linked Repositories", "Repositórios Vinculados")}
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setTab("github")}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  {tr("Manage →", "Gerenciar →")}
                </button>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview.linkedRepositories.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
                  >
                    <div className="truncate">
                      <a
                        href={r.repositoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:text-[var(--accent)]"
                      >
                        {r.repositoryIdentifier}
                      </a>
                      <span className="ml-2 text-[var(--muted-foreground)]">
                        → {projectMap.get(r.projectId) ?? tr("Project", "Projeto")}
                      </span>
                    </div>
                    <Badge variant="outline">{r.defaultBranch}</Badge>
                  </div>
                ))}
                {overview.linkedRepositories.length === 0 && (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {tr(
                      "No repositories linked to projects yet.",
                      "Nenhum repositório vinculado a projetos ainda."
                    )}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* SNIPPETS TAB */}
      {tab === "snippets" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {tr("New Code Snippet", "Novo Snippet de Código")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateSnippet} className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                  <Input
                    value={snipTitle}
                    onChange={(e) => setSnipTitle(e.target.value)}
                    placeholder={tr("Snippet title", "Título do snippet")}
                    required
                  />
                  <select
                    value={snipLang}
                    onChange={(e) => setSnipLang(e.target.value)}
                    className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
                  >
                    {SUPPORTED_SNIPPET_LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <select
                    value={snipProj}
                    onChange={(e) => setSnipProj(e.target.value)}
                    className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
                  >
                    <option value="">{tr("No project", "Sem projeto")}</option>
                    {overview.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={snipTags}
                    onChange={(e) => setSnipTags(e.target.value)}
                    placeholder={tr("tags, csv", "tags, separadas")}
                  />
                </div>
                <Input
                  value={snipDesc}
                  onChange={(e) => setSnipDesc(e.target.value)}
                  placeholder={tr("Optional description", "Descrição opcional")}
                />
                <textarea
                  rows={5}
                  value={snipCode}
                  onChange={(e) => setSnipCode(e.target.value)}
                  placeholder={tr("Paste code here...", "Cole o código aqui...")}
                  required
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2.5 font-mono text-xs"
                />
                <Button type="submit" size="sm">
                  <Plus className="h-4 w-4" /> {tr("Save Snippet", "Salvar Snippet")}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <select
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value)}
              className="h-8 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
            >
              <option value="">{tr("All languages", "Todas as linguagens")}</option>
              {SUPPORTED_SNIPPET_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
              <input
                type="checkbox"
                checked={showLineNumbers}
                onChange={(e) => setShowLineNumbers(e.target.checked)}
              />
              {tr("Line numbers", "Números de linha")}
            </label>
          </div>

          <div className="space-y-4">
            {filteredSnippets.map((s) => (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{s.title}</CardTitle>
                      {s.description && (
                        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                          {s.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {s.projectId && (
                        <Link href={`/projects?id=${s.projectId}`}>
                          <Badge variant="outline">
                            {projectMap.get(s.projectId) ?? tr("Project", "Projeto")}
                          </Badge>
                        </Link>
                      )}
                      {s.sourceNoteId && (
                        <Link href={`/notes?id=${s.sourceNoteId}`}>
                          <Badge variant="outline">{tr("Source Note", "Nota de Origem")}</Badge>
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/developer-hub/snippets/${s.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ isFavorite: !s.isFavorite }),
                          });
                          refresh();
                        }}
                        className={s.isFavorite ? "text-amber-400" : "text-[var(--muted-foreground)]"}
                      >
                        <Star className="h-4 w-4" fill={s.isFavorite ? "currentColor" : "none"} />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/developer-hub/snippets/${s.id}`, {
                            method: "DELETE",
                          });
                          refresh();
                        }}
                        className="text-[var(--muted-foreground)] hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <CodeHighlight
                    code={s.code}
                    language={s.language}
                    showLineNumbers={showLineNumbers}
                  />
                  {s.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {s.tags.map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px]">
                          #{t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* COMMANDS TAB */}
      {tab === "commands" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {tr(
                  "New CLI Command (supports {param} placeholders)",
                  "Novo Comando CLI (suporta placeholders {param})"
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCommand} className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Input
                    value={cmdTitle}
                    onChange={(e) => setCmdTitle(e.target.value)}
                    placeholder={tr(
                      "Command title (e.g. SSH Tunnel)",
                      "Título do comando (ex: Túnel SSH)"
                    )}
                    required
                  />
                  <select
                    value={cmdPlatform}
                    onChange={(e) => setCmdPlatform(e.target.value)}
                    className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
                  >
                    {SUPPORTED_COMMAND_PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={cmdDesc}
                    onChange={(e) => setCmdDesc(e.target.value)}
                    placeholder={tr("Short description", "Descrição curta")}
                  />
                </div>
                <Input
                  value={cmdText}
                  onChange={(e) => setCmdText(e.target.value)}
                  placeholder="ssh -p {port} {user}@{host}"
                  required
                  className="font-mono text-xs"
                />
                <Button type="submit" size="sm">
                  <Plus className="h-4 w-4" /> {tr("Save Command", "Salvar Comando")}
                </Button>
              </form>
            </CardContent>
          </Card>

          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="h-8 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
          >
            <option value="">{tr("All platforms", "Todas as plataformas")}</option>
            {SUPPORTED_COMMAND_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredCommands.map((c) => {
              const placeholders = extractCommandPlaceholders(c.command);
              const paramValues = cmdParamsById[c.id] ?? {};
              const finalCmd = interpolateCommand(c.command, paramValues);
              return (
                <Card key={c.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-[var(--accent)]" />
                        <CardTitle className="text-sm">{c.title}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{c.platform}</Badge>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/developer-hub/commands/${c.id}`, {
                              method: "DELETE",
                            });
                            refresh();
                          }}
                          className="text-[var(--muted-foreground)] hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-xs">
                    {c.description && (
                      <p className="text-[var(--muted-foreground)]">{c.description}</p>
                    )}

                    {placeholders.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {placeholders.map((ph) => (
                          <Input
                            key={ph}
                            value={paramValues[ph] ?? ""}
                            onChange={(e) =>
                              setCmdParamsById((prev) => ({
                                ...prev,
                                [c.id]: { ...(prev[c.id] ?? {}), [ph]: e.target.value },
                              }))
                            }
                            placeholder={ph}
                            className="h-7 text-xs font-mono"
                          />
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[#0d1117] px-3 py-2 font-mono text-xs text-[#e6edf3]">
                      <span className="truncate">{finalCmd}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard?.writeText(finalCmd);
                          setCopiedCmdId(c.id);
                          setTimeout(() => setCopiedCmdId(null), 1500);
                        }}
                        className="shrink-0 text-white/70 hover:text-white"
                        title={tr("Copy command", "Copiar comando")}
                      >
                        {copiedCmdId === c.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* CHEATSHEETS TAB (Reuses Notes with docKind='cheatsheet') */}
      {tab === "cheatsheets" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--muted-foreground)]">
              {tr(
                "Cheatsheets reuse Nikki's block editor with full Markdown, tables, code blocks, and backlinks.",
                "Cheatsheets reutilizam o editor de blocos do Nikki com Markdown completo, tabelas, blocos de código e backlinks."
              )}
            </p>
            <Button size="sm" onClick={() => handleCreateTechNote("cheatsheet")}>
              <Plus className="h-4 w-4" /> {tr("New Cheatsheet", "Novo Cheatsheet")}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {overview.cheatsheets.map((ch) => (
              <Link key={ch.id} href={`/notes?id=${ch.id}`}>
                <Card className="hover:border-[var(--accent)] transition-colors h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[var(--accent)]" />
                      {ch.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-[var(--muted-foreground)] line-clamp-3">
                    {ch.contentText || tr("Open in Notes editor...", "Abrir no editor de Notas...")}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* DOCUMENTATION TAB */}
      {tab === "documentation" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {tr("Internal Technical Docs", "Docs Técnicos Internos")}
                </CardTitle>
                <Button size="sm" onClick={() => handleCreateTechNote("documentation")}>
                  <Plus className="h-3.5 w-3.5" /> {tr("New Doc", "Novo Doc")}
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview.internalDocs.map((d) => (
                  <Link
                    key={d.id}
                    href={`/notes?id=${d.id}`}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-xs hover:bg-[var(--surface-muted)]"
                  >
                    <span className="font-medium truncate">{d.title}</span>
                    <span className="text-[var(--muted-foreground)]">
                      {new Date(d.updatedAt).toLocaleDateString(locale)}
                    </span>
                  </Link>
                ))}
                {overview.internalDocs.length === 0 && (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {tr("No internal technical docs yet.", "Nenhum documento técnico interno ainda.")}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {tr("Add External Documentation", "Adicionar Documentação Externa")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateReference} className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={refTitle}
                      onChange={(e) => setRefTitle(e.target.value)}
                      placeholder={tr("Title (e.g. PostgreSQL Docs)", "Título (ex: Docs do PostgreSQL)")}
                      required
                    />
                    <Input
                      value={refTech}
                      onChange={(e) => setRefTech(e.target.value)}
                      placeholder={tr("Technology (e.g. PostgreSQL)", "Tecnologia (ex: PostgreSQL)")}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      value={refUrl}
                      onChange={(e) => setRefUrl(e.target.value)}
                      placeholder="https://..."
                      required
                      className="col-span-2"
                    />
                    <Input
                      value={refVer}
                      onChange={(e) => setRefVer(e.target.value)}
                      placeholder={tr("Version (e.g. 16)", "Versão (ex: 16)")}
                    />
                  </div>
                  <Input
                    value={refDesc}
                    onChange={(e) => setRefDesc(e.target.value)}
                    placeholder={tr("Description", "Descrição")}
                  />
                  <Button type="submit" size="sm">
                    <Plus className="h-3.5 w-3.5" /> {tr("Save Reference", "Salvar Referência")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {overview.references.map((ref) => (
              <Card key={ref.id}>
                <CardContent className="pt-4 space-y-1.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-sm hover:text-[var(--accent)] flex items-center gap-1.5"
                    >
                      <BookOpen className="h-3.5 w-3.5 shrink-0" />
                      {ref.title}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/developer-hub/references?id=${ref.id}`, {
                          method: "DELETE",
                        });
                        refresh();
                      }}
                      className="text-[var(--muted-foreground)] hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline">{ref.technology}</Badge>
                    {ref.versionLabel && <Badge variant="outline">v{ref.versionLabel}</Badge>}
                  </div>
                  {ref.description && (
                    <p className="text-[var(--muted-foreground)]">{ref.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* GITHUB TAB */}
      {tab === "github" && (
        <div className="space-y-6">
          {!overview.githubConnection ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-[var(--accent)]" />
                  {tr("Connect GitHub (Read-Only)", "Conectar GitHub (Somente Leitura)")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-[var(--muted-foreground)]">
                  {tr(
                    "Enter a GitHub Personal Access Token (read-only repo scope). Your token is encrypted with AES-256-GCM on the server and never exposed to the client.",
                    "Insira um Personal Access Token do GitHub (escopo repo somente leitura). Seu token é criptografado com AES-256-GCM no servidor e nunca exposto ao cliente."
                  )}
                </p>
                <form onSubmit={handleConnectGithub} className="flex gap-2">
                  <Input
                    type="password"
                    value={ghToken}
                    onChange={(e) => setGhToken(e.target.value)}
                    placeholder={tr("ghp_... or github_pat_...", "ghp_... ou github_pat_...")}
                    required
                  />
                  <Button type="submit" size="sm">
                    {tr("Connect", "Conectar")}
                  </Button>
                </form>
                {ghError && <p className="text-xs text-red-500">{ghError}</p>}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {overview.githubConnection.avatarUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={overview.githubConnection.avatarUrl}
                        alt=""
                        className="h-8 w-8 rounded-full"
                      />
                    )}
                    <div>
                      <div className="text-sm font-semibold">
                        {tr(
                          `Connected as @${overview.githubConnection.accountLogin}`,
                          `Conectado como @${overview.githubConnection.accountLogin}`
                        )}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {tr(
                          "Read-only repository integration active",
                          "Integração de repositórios somente leitura ativa"
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await fetch("/api/developer-hub/github", { method: "DELETE" });
                      setSelectedRepo(null);
                      refresh();
                    }}
                  >
                    <Unlink className="h-3.5 w-3.5" /> {tr("Disconnect", "Desconectar")}
                  </Button>
                </CardContent>
              </Card>

              {ghReposError && (
                <Card>
                  <CardContent className="pt-4 text-xs text-red-500">
                    {(ghReposError as Error).message}
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="space-y-2 lg:col-span-5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    {tr("Repositories", "Repositórios")}
                  </div>
                  {loadingRepos ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {tr("Loading repositories...", "Carregando repositórios...")}
                    </p>
                  ) : (
                    (ghReposData ?? []).map((repo) => (
                      <div
                        key={repo.id}
                        className={`rounded-xl border p-3 text-xs transition-colors ${
                          selectedRepo === repo.fullName
                            ? "border-[var(--accent)] bg-[var(--surface)]"
                            : "border-[var(--border)] bg-[var(--surface)]/60"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedRepo(repo.fullName)}
                            className="font-semibold text-sm hover:text-[var(--accent)] text-left truncate"
                          >
                            {repo.fullName}
                          </button>
                          <Badge variant="outline">
                            {repo.language ?? tr("Repo", "Repo")}
                          </Badge>
                        </div>
                        {repo.description && (
                          <p className="mt-1 text-[var(--muted-foreground)] line-clamp-2">
                            {repo.description}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <select
                            value={linkProjectId}
                            onChange={(e) => setLinkProjectId(e.target.value)}
                            className="h-7 flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-1.5 text-[11px]"
                          >
                            <option value="">
                              {tr("Link to project...", "Vincular ao projeto...")}
                            </option>
                            {overview.projects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            disabled={!linkProjectId}
                            onClick={async () => {
                              await fetch("/api/developer-hub/project-repos", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  projectId: linkProjectId,
                                  repositoryIdentifier: repo.fullName,
                                  repositoryUrl: repo.htmlUrl,
                                  defaultBranch: repo.defaultBranch,
                                  language: repo.language,
                                  description: repo.description,
                                }),
                              });
                              refresh();
                            }}
                          >
                            {tr("Link", "Vincular")}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="lg:col-span-7">
                  {!selectedRepo || !repoDetail ? (
                    <Card>
                      <CardContent className="py-12 text-center text-xs text-[var(--muted-foreground)]">
                        {tr(
                          "Select a repository to inspect issues, pull requests, releases, and recent commits.",
                          "Selecione um repositório para inspecionar issues, pull requests, releases e commits recentes."
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader className="border-b border-[var(--border)] pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{repoDetail.overview.full_name}</CardTitle>
                          <a
                            href={repoDetail.overview.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
                          >
                            GitHub <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-4 text-xs">
                        <div>
                          <div className="font-semibold mb-1">
                            {tr("Recent Commits", "Commits Recentes")}
                          </div>
                          <div className="space-y-1">
                            {repoDetail.commits.map((c) => (
                              <a
                                key={c.sha}
                                href={c.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between rounded border border-[var(--border)] px-2.5 py-1.5 hover:bg-[var(--surface-muted)]"
                              >
                                <span className="truncate">{c.message}</span>
                                <span className="ml-2 font-mono text-[10px] text-[var(--muted-foreground)]">
                                  {c.sha}
                                </span>
                              </a>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <div className="font-semibold mb-1">
                              {tr("Open Issues", "Issues Abertas")} ({repoDetail.issues.length})
                            </div>
                            <div className="space-y-1">
                              {repoDetail.issues.map((i) => (
                                <a
                                  key={i.id}
                                  href={i.html_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block truncate rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--surface-muted)]"
                                >
                                  #{i.number} {i.title}
                                </a>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold mb-1">
                              {tr("Open Pull Requests", "Pull Requests Abertos")} ({repoDetail.pulls.length})
                            </div>
                            <div className="space-y-1">
                              {repoDetail.pulls.map((pr) => (
                                <a
                                  key={pr.id}
                                  href={pr.html_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block truncate rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--surface-muted)]"
                                >
                                  #{pr.number} {pr.title}
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
