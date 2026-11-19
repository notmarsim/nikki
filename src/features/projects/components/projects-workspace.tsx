"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  FileText,
  Flag,
  FolderKanban,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import type { MilestoneRecord, TaskRecord } from "@/db/schema";
import type { ProjectSummary } from "@/modules/projects/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/providers/i18n-provider";

interface ProjectDetailPayload {
  project: ProjectSummary;
  tasks: TaskRecord[];
  notes: Array<{
    id: string;
    title: string;
    icon: string | null;
    updatedAt: string;
  }>;
  milestones: Array<
    MilestoneRecord & {
      totalTasks: number;
      completedTasks: number;
      progress: number;
    }
  >;
  recentActivity: Array<{
    id: string;
    action: string;
    createdAt: string;
  }>;
}

type ProjectTab = "overview" | "tasks" | "notes" | "milestones" | "settings";

export function ProjectsWorkspace({
  initialProjects,
}: {
  initialProjects: ProjectSummary[];
}) {
  const { tr, language } = useI18n();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const projectStatusLabel = (status: string) => {
    switch (status) {
      case "planning":
        return tr("Planning", "Planejamento");
      case "active":
        return tr("Active", "Ativo");
      case "on_hold":
        return tr("On hold", "Em espera");
      case "completed":
        return tr("Completed", "Concluído");
      case "archived":
        return tr("Archived", "Arquivado");
      default:
        return status.replace("_", " ");
    }
  };

  const milestoneStatusLabel = (status: string) => {
    switch (status) {
      case "planned":
        return tr("Planned", "Planejado");
      case "active":
        return tr("Active", "Ativo");
      case "completed":
        return tr("Completed", "Concluído");
      case "cancelled":
        return tr("Cancelled", "Cancelado");
      default:
        return status;
    }
  };

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    searchParams.get("id") ?? initialProjects[0]?.id ?? null
  );
  const [activeTab, setActiveTab] = useState<ProjectTab>("overview");
  const [showNewForm, setShowNewForm] = useState(false);

  // Create project form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [creating, setCreating] = useState(false);

  // Inline create task/note/milestone
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [newMilestoneDue, setNewMilestoneDue] = useState("");

  useEffect(() => {
    const paramId = searchParams.get("id");
    if (paramId) setSelectedProjectId(paramId);
  }, [searchParams]);

  const { data: projects = initialProjects } = useQuery<ProjectSummary[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to load projects");
      const json = await res.json();
      return json.data.projects;
    },
    initialData: initialProjects,
  });

  const { data: detail, isLoading: loadingDetail } = useQuery<ProjectDetailPayload>({
    queryKey: ["project-detail", selectedProjectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${selectedProjectId}`);
      if (!res.ok) throw new Error("Failed to load project detail");
      const json = await res.json();
      return json.data;
    },
    enabled: Boolean(selectedProjectId),
  });

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["project-detail", selectedProjectId] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["notes"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim() || null,
          color: newColor,
          status: "active",
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setNewName("");
        setNewDesc("");
        setShowNewForm(false);
        setSelectedProjectId(json.data.project.id);
        await invalidateAll();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleAddProjectTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !newTaskTitle.trim()) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTaskTitle.trim(),
        projectId: selectedProjectId,
      }),
    });
    if (res.ok) {
      setNewTaskTitle("");
      await invalidateAll();
    }
  };

  const handleToggleTask = async (task: TaskRecord) => {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: task.status === "done" ? "todo" : "done",
      }),
    });
    if (res.ok) {
      await invalidateAll();
    }
  };

  const handleAddProjectNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !newNoteTitle.trim()) return;
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newNoteTitle.trim(),
        projectId: selectedProjectId,
      }),
    });
    if (res.ok) {
      setNewNoteTitle("");
      await invalidateAll();
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !newMilestoneName.trim()) return;
    const res = await fetch(`/api/projects/${selectedProjectId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newMilestoneName.trim(),
        dueDate: newMilestoneDue
          ? new Date(`${newMilestoneDue}T12:00:00.000Z`).toISOString()
          : null,
      }),
    });
    if (res.ok) {
      setNewMilestoneName("");
      setNewMilestoneDue("");
      await invalidateAll();
    }
  };

  const handleDeleteProject = async (id: string, taskCount = 0) => {
    let mode: "unlink" | "trash_all" = "unlink";
    if (taskCount > 0) {
      const choice = window.confirm(
        tr(
          `This project has ${taskCount} task(s). Click OK to move the project to Trash while keeping its tasks (unlinked), or Cancel to abort.`,
          `Este projeto possui ${taskCount} tarefa(s). Clique em OK para mover o projeto para a Lixeira preservando as tarefas (desvinculadas), ou Cancelar para desistir.`
        )
      );
      if (!choice) return;
      const alsoTrash = window.confirm(
        tr(
          "Do you also want to move this project's tasks to Trash? (OK = move tasks to Trash | Cancel = keep active tasks without project)",
          "Deseja também enviar as tarefas deste projeto para a Lixeira? (OK = enviar tarefas para a Lixeira | Cancelar = manter tarefas ativas sem projeto)"
        )
      );
      mode = alsoTrash ? "trash_all" : "unlink";
    } else if (!window.confirm(tr("Move this project to Trash?", "Mover este projeto para a Lixeira?"))) {
      return;
    }

    const res = await fetch(`/api/projects/${id}?mode=${mode}`, { method: "DELETE" });
    if (res.ok) {
      setSelectedProjectId(null);
      await invalidateAll();
    }
  };

  const handleArchiveProject = async (id: string) => {
    const res = await fetch("/api/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive_project", projectId: id }),
    });
    if (res.ok) {
      setSelectedProjectId(null);
      await invalidateAll();
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tr("Projects", "Projetos")}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {tr(
              "Organize tasks, documentation, and milestones with automatic progress tracking.",
              "Organize tarefas, documentações e marcos com acompanhamento automático de progresso."
            )}
          </p>
        </div>
        <Button onClick={() => setShowNewForm(!showNewForm)}>
          <Plus className="h-4 w-4" />
          {tr("New Project", "Novo Projeto")}
        </Button>
      </div>

      {showNewForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tr("Create Project", "Criar Projeto")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateProject} className="space-y-3">
              <div className="flex gap-2">
                <Input
                  required
                  placeholder={tr("Project name...", "Nome do projeto...")}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1"
                  aria-label={tr("Project color", "Cor do projeto")}
                />
              </div>
              <Input
                placeholder={tr("Short description (optional)...", "Descrição curta (opcional)...")}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowNewForm(false)}>
                  {tr("Cancel", "Cancelar")}
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? tr("Creating...", "Criando...") : tr("Create", "Criar")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Project Sidebar List */}
        <div className="space-y-2 lg:col-span-4">
          {projects.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-[var(--muted-foreground)]">
                {tr(
                  'No projects yet. Click "New Project" to get started.',
                  'Nenhum projeto ainda. Clique em "Novo Projeto" para começar.'
                )}
              </CardContent>
            </Card>
          ) : (
            projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProjectId(p.id)}
                className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                  selectedProjectId === p.id
                    ? "border-[var(--accent)] bg-[var(--surface)]"
                    : "border-[var(--border)] bg-[var(--surface)]/60 hover:bg-[var(--surface)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="font-medium text-sm truncate">{p.name}</span>
                  </div>
                  <Badge variant="outline">{projectStatusLabel(p.status)}</Badge>
                </div>
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${p.progress}%`, backgroundColor: p.color }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                  <span>
                    {p.completedTasks}/{p.totalTasks} {tr("tasks", "tarefas")} · {p.notesCount}{" "}
                    {tr("notes", "notas")}
                  </span>
                  <span>{p.progress}%</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Project Detail Workspace */}
        <div className="lg:col-span-8">
          {!selectedProjectId || !detail ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center text-sm text-[var(--muted-foreground)]">
                <FolderKanban className="mb-2 h-8 w-8 opacity-60" />
                {loadingDetail
                  ? tr("Loading project...", "Carregando projeto...")
                  : tr("Select a project to view details.", "Selecione um projeto para ver os detalhes.")}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="border-b border-[var(--border)] pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: detail.project.color }}
                      />
                      <CardTitle className="text-xl">{detail.project.name}</CardTitle>
                      <Badge variant="accent">{projectStatusLabel(detail.project.status)}</Badge>
                    </div>
                    {detail.project.description && (
                      <CardDescription className="mt-1">
                        {detail.project.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{detail.project.progress}%</div>
                    <div className="text-[11px] text-[var(--muted-foreground)]">
                      {tr("completed / active tasks", "concluídas / tarefas ativas")}
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="mt-4 flex flex-wrap gap-1">
                  {(
                    [
                      { id: "overview", label: tr("Overview", "Visão Geral") },
                      {
                        id: "tasks",
                        label: `${tr("Tasks", "Tarefas")} (${detail.tasks.length})`,
                      },
                      {
                        id: "notes",
                        label: `${tr("Notes", "Notas")} (${detail.notes.length})`,
                      },
                      {
                        id: "milestones",
                        label: `${tr("Milestones", "Marcos")} (${detail.milestones.length})`,
                      },
                      { id: "settings", label: tr("Settings", "Configurações") },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        activeTab === tab.id
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "bg-[var(--surface-muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="p-5">
                {activeTab === "overview" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border border-[var(--border)] p-3">
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {tr("Tasks", "Tarefas")}
                        </div>
                        <div className="text-xl font-bold">{detail.tasks.length}</div>
                      </div>
                      <div className="rounded-lg border border-[var(--border)] p-3">
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {tr("Notes", "Notas")}
                        </div>
                        <div className="text-xl font-bold">{detail.notes.length}</div>
                      </div>
                      <div className="rounded-lg border border-[var(--border)] p-3">
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {tr("Milestones", "Marcos")}
                        </div>
                        <div className="text-xl font-bold">{detail.milestones.length}</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "tasks" && (
                  <div className="space-y-4">
                    <form onSubmit={handleAddProjectTask} className="flex gap-2">
                      <Input
                        placeholder={tr("Add task to this project...", "Adicionar tarefa a este projeto...")}
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                      />
                      <Button type="submit" size="sm">
                        <Plus className="h-4 w-4" /> {tr("Add", "Adicionar")}
                      </Button>
                    </form>

                    {detail.tasks.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                        {tr("No tasks linked to this project yet.", "Nenhuma tarefa vinculada a este projeto ainda.")}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {detail.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleTask(task)}
                              className="flex items-center gap-2 text-left min-w-0 flex-1"
                            >
                              {task.status === "done" ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                              ) : (
                                <Circle className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                              )}
                              <span
                                className={`truncate ${
                                  task.status === "done"
                                    ? "line-through text-[var(--muted-foreground)]"
                                    : ""
                                }`}
                              >
                                {task.title}
                              </span>
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                              <select
                                value={task.status}
                                onChange={async (e) => {
                                  await fetch(`/api/tasks/${task.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ status: e.target.value }),
                                  });
                                  await invalidateAll();
                                }}
                                className="h-7 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
                                aria-label={tr(`Status for ${task.title}`, `Status de ${task.title}`)}
                              >
                                <option value="todo">{tr("To Do", "A Fazer")}</option>
                                <option value="in_progress">{tr("Working", "Em Progresso")}</option>
                                <option value="done">{tr("Done", "Concluída")}</option>
                                <option value="blocked">{tr("Blocked", "Bloqueada")}</option>
                                <option value="cancelled">{tr("Cancelled", "Cancelada")}</option>
                              </select>
                              <Link
                                href={`/tasks?taskId=${task.id}`}
                                className="text-xs text-[var(--accent)] hover:underline"
                              >
                                {tr("Open →", "Abrir →")}
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "notes" && (
                  <div className="space-y-4">
                    <form onSubmit={handleAddProjectNote} className="flex gap-2">
                      <Input
                        placeholder={tr(
                          "Create documentation note in this project...",
                          "Criar nota de documentação neste projeto..."
                        )}
                        value={newNoteTitle}
                        onChange={(e) => setNewNoteTitle(e.target.value)}
                      />
                      <Button type="submit" size="sm">
                        <Plus className="h-4 w-4" /> {tr("New Note", "Nova Nota")}
                      </Button>
                    </form>

                    {detail.notes.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                        {tr("No notes linked to this project yet.", "Nenhuma nota vinculada a este projeto ainda.")}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {detail.notes.map((note) => (
                          <Link
                            key={note.id}
                            href={`/notes?id=${note.id}`}
                            className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-muted)]"
                          >
                            <span className="flex items-center gap-2 font-medium">
                              <FileText className="h-4 w-4 text-[var(--muted-foreground)]" />
                              {note.title}
                            </span>
                            <span className="text-xs text-[var(--muted-foreground)]">
                              {new Date(note.updatedAt).toLocaleDateString(locale)}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "milestones" && (
                  <div className="space-y-4">
                    <form onSubmit={handleAddMilestone} className="flex flex-wrap gap-2">
                      <Input
                        className="flex-1 min-w-[180px]"
                        placeholder={tr("Milestone name...", "Nome do marco...")}
                        value={newMilestoneName}
                        onChange={(e) => setNewMilestoneName(e.target.value)}
                      />
                      <Input
                        type="date"
                        className="w-40"
                        value={newMilestoneDue}
                        onChange={(e) => setNewMilestoneDue(e.target.value)}
                      />
                      <Button type="submit" size="sm">
                        <Plus className="h-4 w-4" /> {tr("Add Milestone", "Adicionar Marco")}
                      </Button>
                    </form>

                    {detail.milestones.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                        {tr("No milestones created yet.", "Nenhum marco criado ainda.")}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {detail.milestones.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3 text-sm"
                          >
                            <div>
                              <div className="flex items-center gap-2 font-medium">
                                <Flag className="h-4 w-4 text-[var(--accent)]" />
                                {m.name}
                                <Badge variant="outline">{milestoneStatusLabel(m.status)}</Badge>
                              </div>
                              <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                                {m.completedTasks}/{m.totalTasks} {tr("tasks", "tarefas")} ({m.progress}%)
                                {m.dueDate &&
                                  ` · ${tr("Due", "Prazo")} ${new Date(m.dueDate).toLocaleDateString(locale)}`}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <select
                                value={m.status}
                                onChange={async (e) => {
                                  await fetch(`/api/milestones/${m.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ status: e.target.value }),
                                  });
                                  await invalidateAll();
                                }}
                                className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
                              >
                                <option value="planned">{tr("Planned", "Planejado")}</option>
                                <option value="active">{tr("Active", "Ativo")}</option>
                                <option value="completed">{tr("Completed", "Concluído")}</option>
                                <option value="cancelled">{tr("Cancelled", "Cancelado")}</option>
                              </select>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={async () => {
                                  await fetch(`/api/milestones/${m.id}`, {
                                    method: "DELETE",
                                  });
                                  await invalidateAll();
                                }}
                                title={tr("Delete milestone", "Excluir marco")}
                                aria-label={tr("Delete milestone", "Excluir marco")}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "settings" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Settings className="h-4 w-4" />
                      {tr("Project Status & Danger Zone", "Status do Projeto e Zona de Perigo")}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {(["planning", "active", "on_hold", "completed", "archived"] as const).map(
                        (st) => (
                          <Button
                            key={st}
                            size="sm"
                            variant={detail.project.status === st ? "default" : "outline"}
                            onClick={async () => {
                              await fetch(`/api/projects/${detail.project.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: st }),
                              });
                              await invalidateAll();
                            }}
                          >
                            {projectStatusLabel(st)}
                          </Button>
                        )
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleArchiveProject(detail.project.id)}
                      >
                        {tr("Archive Project", "Arquivar Projeto")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteProject(detail.project.id, detail.tasks.length)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {tr("Delete Project", "Excluir Projeto")}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
