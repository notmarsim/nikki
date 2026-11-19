"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CheckCircle2,
  FolderKanban,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";

interface ArchivedTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  projectId: string | null;
  projectName: string | null;
  completedAt: string | null;
  archivedAt: string | null;
}

interface ArchivedProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  progress: number;
  completedAt: string | null;
  archivedAt: string | null;
  totalTasks: number;
  completedTasks: number;
}

interface TrashTask {
  id: string;
  title: string;
  deletedAt: string | null;
  daysRemaining: number;
}

interface TrashProject {
  id: string;
  name: string;
  deletedAt: string | null;
  daysRemaining: number;
}

interface ProjectOption {
  id: string;
  name: string;
}

export function ArchiveWorkspace({ initialTab = "tasks" }: { initialTab?: "tasks" | "projects" | "trash" }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"tasks" | "projects" | "trash">(initialTab);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Tasks tab state
  const [tasks, setTasks] = useState<ArchivedTask[]>([]);
  const [projectsList, setProjectsList] = useState<ProjectOption[]>([]);
  const [q, setQ] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState<"archivedAt" | "completedAt">("archivedAt");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // Projects tab state
  const [archivedProjects, setArchivedProjects] = useState<ArchivedProject[]>([]);
  const [inspectedProject, setInspectedProject] = useState<{
    project: ArchivedProject;
    tasks: Array<{ id: string; title: string; status: string }>;
  } | null>(null);

  // Trash tab state
  const [trashTasks, setTrashTasks] = useState<TrashTask[]>([]);
  const [trashProjects, setTrashProjects] = useState<TrashProject[]>([]);
  const [selectedTrashTaskIds, setSelectedTrashTaskIds] = useState<string[]>([]);

  const invalidateAppCaches = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  }, [queryClient]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ tab, page: String(page) });
      if (q.trim()) params.set("q", q.trim());
      if (tab === "tasks") {
        if (projectId) params.set("projectId", projectId);
        if (priority) params.set("priority", priority);
        if (fromDate) params.set("from", fromDate);
        if (toDate) params.set("to", toDate);
        params.set("sortBy", sortBy);
      }

      const res = await fetch(`/api/archive?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load archive data");
      const json = (await res.json()) as { data?: Record<string, unknown> };
      const d = json.data ?? {};

      if (tab === "tasks") {
        setTasks((d.items as ArchivedTask[]) ?? []);
        setProjectsList((d.projects as ProjectOption[]) ?? []);
        setTotalPages(Number(d.totalPages ?? 1));
      } else if (tab === "projects") {
        setArchivedProjects((d.items as ArchivedProject[]) ?? []);
        setTotalPages(Number(d.totalPages ?? 1));
      } else {
        setTrashTasks((d.tasks as TrashTask[]) ?? []);
        setTrashProjects((d.projects as TrashProject[]) ?? []);
      }
    } catch {
      setErrorMsg("Unable to load archive records. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [tab, page, q, projectId, priority, fromDate, toDate, sortBy]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function runAction(payload: Record<string, unknown>, successText: string) {
    const res = await fetch("/api/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setFeedback(successText);
      setSelectedTaskIds([]);
      setSelectedTrashTaskIds([]);
      await invalidateAppCaches();
      await loadData();
    } else {
      setErrorMsg("Action failed. Please check permissions and retry.");
    }
  }

  async function inspectProject(id: string) {
    const res = await fetch(`/api/archive?tab=project_detail&projectId=${encodeURIComponent(id)}`);
    if (!res.ok) return;
    const json = (await res.json()) as {
      data?: {
        project: ArchivedProject;
        tasks: Array<{ id: string; title: string; status: string }>;
      };
    };
    if (json.data) setInspectedProject(json.data);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Archive className="h-6 w-6 text-[var(--accent)]" />
            Arquivo &amp; Histórico
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Consulte, restaure ou gerencie tarefas concluídas arquivadas, projetos e itens na Lixeira.
          </p>
        </div>
        {feedback && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-500">
            {feedback}
          </div>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["tasks", "Tasks", CheckCircle2],
            ["projects", "Projetos", FolderKanban],
            ["trash", "Lixeira (30 dias)", Trash2],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setPage(1);
              setFeedback(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${
              tab === id
                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--muted-foreground)]"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab !== "trash" && (
        <div className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Pesquisar por nome ou descrição..."
              className="w-full rounded-lg border border-[var(--border)] bg-transparent py-1.5 pl-8 pr-3 text-sm"
            />
          </div>
          {tab === "tasks" && (
            <>
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs"
              >
                <option value="">Todos os projetos</option>
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs"
              >
                <option value="">Todas as prioridades</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="none">None</option>
              </select>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                aria-label="From date"
                className="rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-xs"
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "archivedAt" | "completedAt")}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs"
              >
                <option value="archivedAt">Ordenar: Arquivamento</option>
                <option value="completedAt">Ordenar: Conclusão</option>
              </select>
            </>
          )}
        </div>
      )}

      {tab === "tasks" && selectedTaskIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-3 text-xs">
          <span className="font-medium">{selectedTaskIds.length} tarefa(s) selecionada(s)</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                void runAction(
                  { action: "restore_tasks", ids: selectedTaskIds },
                  "Tarefas restauradas com sucesso."
                )
              }
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-medium"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Restaurar selecionadas
            </button>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("Mover as tarefas selecionadas para a Lixeira?")) return;
                void runAction(
                  { action: "trash_tasks", ids: selectedTaskIds },
                  "Tarefas movidas para a Lixeira."
                );
              }}
              className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 font-medium text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" /> Enviar para Lixeira
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted-foreground)]">
          Carregando registros...
        </div>
      ) : tab === "tasks" ? (
        tasks.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted-foreground)]">
            Nenhuma tarefa arquivada encontrada para os filtros atuais.
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => {
              const checked = selectedTaskIds.includes(t.id);
              return (
                <div
                  key={t.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedTaskIds((prev) =>
                          checked ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                        )
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span>{t.title}</span>
                        {t.projectName && (
                          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px]">
                            {t.projectName}
                          </span>
                        )}
                        <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] capitalize">
                          {t.priority}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                        Concluída em:{" "}
                        {t.completedAt ? new Date(t.completedAt).toLocaleString() : "—"} · Arquivada em:{" "}
                        {t.archivedAt ? new Date(t.archivedAt).toLocaleString() : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(
                          { action: "restore_tasks", ids: [t.id] },
                          "Tarefa restaurada."
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(
                          { action: "trash_tasks", ids: [t.id] },
                          "Tarefa enviada para a Lixeira."
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Lixeira
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : tab === "projects" ? (
        archivedProjects.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted-foreground)]">
            Nenhum projeto arquivado encontrado.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {archivedProjects.map((p) => (
              <div
                key={p.id}
                className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <button
                      type="button"
                      onClick={() => void inspectProject(p.id)}
                      className="text-left font-semibold hover:underline"
                    >
                      {p.name}
                    </button>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {p.description || "Sem descrição"}
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs">
                    {p.progress}%
                  </span>
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {p.completedTasks}/{p.totalTasks} tarefas concluídas · Arquivado em{" "}
                  {p.archivedAt ? new Date(p.archivedAt).toLocaleDateString() : "—"}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void inspectProject(p.id)}
                    className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs"
                  >
                    Ver histórico
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void runAction(
                        { action: "restore_projects", ids: [p.id] },
                        "Projeto restaurado para Projetos ativos."
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-xs text-[var(--muted-foreground)]">
              Itens excluídos permanecem na Lixeira por 30 dias antes da exclusão definitiva.
            </div>
            {(trashTasks.length > 0 || trashProjects.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm("Esvaziar toda a Lixeira? Esta ação é irreversível.")) return;
                  void runAction({ action: "empty_trash" }, "Lixeira esvaziada definitivamente.");
                }}
                className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500"
              >
                Esvaziar Lixeira
              </button>
            )}
          </div>

          {selectedTrashTaskIds.length > 0 && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-3 text-xs">
              <button
                type="button"
                onClick={() =>
                  void runAction(
                    { action: "restore_tasks", ids: selectedTrashTaskIds, fromTrash: true },
                    "Tarefas restauradas da Lixeira."
                  )
                }
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1"
              >
                Restaurar selecionadas ({selectedTrashTaskIds.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm("Excluir definitivamente as tarefas selecionadas?")) return;
                  void runAction(
                    { action: "delete_tasks_permanent", ids: selectedTrashTaskIds },
                    "Tarefas excluídas definitivamente."
                  );
                }}
                className="rounded border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-red-500"
              >
                Excluir definitivamente
              </button>
            </div>
          )}

          {trashTasks.length === 0 && trashProjects.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted-foreground)]">
              A Lixeira está vazia.
            </div>
          ) : (
            <div className="space-y-2">
              {trashProjects.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
                >
                  <div>
                    <div className="font-medium">[Projeto] {p.name}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      Excluído em {p.deletedAt ? new Date(p.deletedAt).toLocaleDateString() : "—"} ·{" "}
                      {p.daysRemaining} dias restantes
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(
                          { action: "restore_projects", ids: [p.id], fromTrash: true },
                          "Projeto restaurado da Lixeira."
                        )
                      }
                      className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs"
                    >
                      Restaurar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm("Excluir este projeto definitivamente?")) return;
                        void runAction(
                          { action: "delete_projects_permanent", ids: [p.id] },
                          "Projeto excluído definitivamente."
                        );
                      }}
                      className="rounded-lg border border-red-500/40 px-2.5 py-1 text-xs text-red-500"
                    >
                      Excluir definitivamente
                    </button>
                  </div>
                </div>
              ))}
              {trashTasks.map((t) => {
                const checked = selectedTrashTaskIds.includes(t.id);
                return (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedTrashTaskIds((prev) =>
                            checked ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                          )
                        }
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">{t.title}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          Excluída em {t.deletedAt ? new Date(t.deletedAt).toLocaleDateString() : "—"} ·{" "}
                          {t.daysRemaining} dias restantes
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void runAction(
                            { action: "restore_tasks", ids: [t.id], fromTrash: true },
                            "Tarefa restaurada da Lixeira."
                          )
                        }
                        className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs"
                      >
                        Restaurar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm("Excluir definitivamente esta tarefa?")) return;
                          void runAction(
                            { action: "delete_tasks_permanent", ids: [t.id] },
                            "Tarefa excluída definitivamente."
                          );
                        }}
                        className="rounded-lg border border-red-500/40 px-2.5 py-1 text-xs text-red-500"
                      >
                        Excluir definitivamente
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab !== "trash" && totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {inspectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[85vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{inspectedProject.project.name}</h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {inspectedProject.project.description || "Sem descrição"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedProject(null)}
                className="rounded p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
                Tarefas Associadas ({inspectedProject.tasks.length})
              </h3>
              {inspectedProject.tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded border border-[var(--border)] px-2.5 py-1.5 text-xs"
                >
                  <span>{t.title}</span>
                  <span className="capitalize text-[var(--muted-foreground)]">{t.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
