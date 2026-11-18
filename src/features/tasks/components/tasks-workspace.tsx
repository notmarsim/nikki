"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Copy,
  FileText,
  FolderKanban,
  Plus,
  Repeat,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { NoteRecord, ProjectRecord, TaskCommentRecord } from "@/db/schema";
import type { TaskWithRelations } from "@/modules/tasks/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type TaskViewMode = "today" | "upcoming" | "all" | "board" | "completed";
type TaskStatus = "todo" | "in_progress" | "blocked" | "done" | "cancelled";
type TaskPriority = "none" | "low" | "medium" | "high" | "urgent";

const BOARD_COLUMNS: Array<{ id: TaskStatus; label: string }> = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "Working" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
];

const PRIORITY_BADGE: Record<TaskPriority, "default" | "outline" | "accent" | "warning"> = {
  none: "outline",
  low: "default",
  medium: "accent",
  high: "warning",
  urgent: "warning",
};

function KanbanCard({
  task,
  onSelect,
}: {
  task: TaskWithRelations;
  onSelect: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(task.id)}
      className={`cursor-grab rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm shadow-xs transition-shadow hover:border-[var(--accent)] ${
        isDragging ? "opacity-60 shadow-md" : ""
      }`}
    >
      <div className="font-medium leading-snug">{task.title}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant={PRIORITY_BADGE[task.priority]}>{task.priority}</Badge>
        {task.projectName && (
          <Badge variant="outline" className="max-w-[120px] truncate">
            {task.projectName}
          </Badge>
        )}
        {task.dueAt && (
          <span className="text-[11px] text-[var(--muted-foreground)]">
            {new Date(task.dueAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({
  id,
  label,
  tasks,
  onSelect,
}: {
  id: TaskStatus;
  label: string;
  tasks: TaskWithRelations[];
  onSelect: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[380px] flex-col rounded-xl border border-[var(--border)] p-3 transition-colors ${
        isOver ? "bg-[var(--surface-muted)]" : "bg-[var(--surface)]/50"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          {label}
        </span>
        <Badge variant="default">{tasks.length}</Badge>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <KanbanCard key={task.id} task={task} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

export function TasksWorkspace({
  initialTasks,
  projects,
  notes,
}: {
  initialTasks: TaskWithRelations[];
  projects: ProjectRecord[];
  notes: Array<Pick<NoteRecord, "id" | "title">>;
}) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const [view, setView] = useState<TaskViewMode>("all");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    searchParams.get("taskId")
  );

  // Quick Add state
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newProjectId, setNewProjectId] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newRecurrence, setNewRecurrence] = useState<"" | "daily" | "weekly" | "monthly">("");
  const [creating, setCreating] = useState(false);

  // Subtask & comment inputs
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const { data: tasks = initialTasks } = useQuery<TaskWithRelations[]>({
    queryKey: ["tasks"],
    queryFn: async () => {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Failed to load tasks");
      const json = await res.json();
      return json.data.tasks;
    },
    initialData: initialTasks,
  });

  const { data: comments = [] } = useQuery<TaskCommentRecord[]>({
    queryKey: ["task-comments", selectedTaskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${selectedTaskId}/comments`);
      if (!res.ok) throw new Error("Failed to load comments");
      const json = await res.json();
      return json.data.comments;
    },
    enabled: Boolean(selectedTaskId),
  });

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          priority: newPriority,
          projectId: newProjectId || null,
          dueAt: newDueDate ? new Date(`${newDueDate}T12:00:00.000Z`).toISOString() : null,
          recurrence: newRecurrence ? { frequency: newRecurrence, interval: 1 } : null,
        }),
      });
      if (res.ok) {
        setNewTitle("");
        setNewDueDate("");
        setNewRecurrence("");
        await invalidateAll();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateTask = async (
    taskId: string,
    patch: Record<string, unknown>
  ) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      await invalidateAll();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedTaskId === taskId) setSelectedTaskId(null);
      await invalidateAll();
    }
  };

  const handleDuplicateTask = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}/duplicate`, { method: "POST" });
    if (res.ok) {
      await invalidateAll();
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const nextStatus = String(over.id) as TaskStatus;
    const current = tasks.find((t) => t.id === taskId);
    if (!current || current.status === nextStatus) return;
    await handleUpdateTask(taskId, { status: nextStatus });
  };

  const topLevelTasks = useMemo(
    () => tasks.filter((t) => t.parentTaskId === null),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const q = search.trim().toLowerCase();

    return topLevelTasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q) && !(t.description ?? "").toLowerCase().includes(q)) {
        return false;
      }
      if (projectFilter && t.projectId !== projectFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;

      if (view === "completed") return t.status === "done";
      if (view === "today") {
        if (t.status === "done" || t.status === "cancelled") return false;
        if (!t.dueAt) return false;
        return new Date(t.dueAt) <= endOfToday;
      }
      if (view === "upcoming") {
        if (t.status === "done" || t.status === "cancelled") return false;
        return t.dueAt !== null && new Date(t.dueAt) >= startOfToday;
      }
      if (view === "all") {
        return t.status !== "cancelled";
      }
      return true;
    });
  }, [topLevelTasks, search, projectFilter, priorityFilter, view]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const subtasksOfSelected = selectedTask
    ? tasks.filter((t) => t.parentTaskId === selectedTask.id)
    : [];

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !subtaskTitle.trim()) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: subtaskTitle.trim(),
        parentTaskId: selectedTask.id,
        projectId: selectedTask.projectId,
        priority: "medium",
      }),
    });
    if (res.ok) {
      setSubtaskTitle("");
      await invalidateAll();
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Manage tasks, subtasks, recurrence, and Kanban workflows linked to your projects and notes.
          </p>
        </div>
      </div>

      {/* Quick Add Form */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleCreateTask} className="flex flex-wrap items-center gap-2">
            <Input
              className="flex-1 min-w-[200px]"
              placeholder="Add a task..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
              aria-label="Task priority"
            >
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="none">None</option>
            </select>
            <Input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="w-36 text-xs"
              aria-label="Due date"
            />
            <select
              value={newProjectId}
              onChange={(e) => setNewProjectId(e.target.value)}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
              aria-label="Project"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={newRecurrence}
              onChange={(e) =>
                setNewRecurrence(e.target.value as "" | "daily" | "weekly" | "monthly")
              }
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
              aria-label="Recurrence"
            >
              <option value="">One-time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <Button type="submit" disabled={creating || !newTitle.trim()}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Views + Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {(
            [
              { id: "all", label: "All Tasks" },
              { id: "today", label: "Today" },
              { id: "upcoming", label: "Upcoming" },
              { id: "board", label: "Board" },
              { id: "completed", label: "Completed" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                view === tab.id
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "bg-[var(--surface-muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter tasks..."
              className="h-8 w-44 pl-8 text-xs"
            />
          </div>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
            aria-label="Filter by project"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
            aria-label="Filter by priority"
          >
            <option value="">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>

      {/* Main View */}
      {view === "board" ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {BOARD_COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                label={col.label}
                tasks={filteredTasks.filter((t) => t.status === col.id)}
                onSelect={setSelectedTaskId}
              />
            ))}
          </div>
        </DndContext>
      ) : filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--muted-foreground)]">
            No tasks match this view. Create one above!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => {
            const isOverdue =
              task.dueAt &&
              task.status !== "done" &&
              new Date(task.dueAt) < new Date(new Date().setHours(0, 0, 0, 0));

            return (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--accent)] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateTask(task.id, {
                        status: task.status === "done" ? "todo" : "done",
                      })
                    }
                    className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--accent)]"
                    aria-label={
                      task.status === "done" ? "Reopen task" : "Complete task"
                    }
                  >
                    {task.status === "done" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTaskId(task.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div
                      className={`text-sm font-medium truncate ${
                        task.status === "done"
                          ? "line-through text-[var(--muted-foreground)]"
                          : ""
                      }`}
                    >
                      {task.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      {task.projectName && (
                        <span className="inline-flex items-center gap-1">
                          <FolderKanban className="h-3 w-3" />
                          {task.projectName}
                        </span>
                      )}
                      {task.noteTitle && (
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {task.noteTitle}
                        </span>
                      )}
                      {task.dueAt && (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            isOverdue ? "text-red-500 font-medium" : ""
                          }`}
                        >
                          <Calendar className="h-3 w-3" />
                          {new Date(task.dueAt).toLocaleDateString()}
                        </span>
                      )}
                      {task.recurrence && (
                        <span className="inline-flex items-center gap-1">
                          <Repeat className="h-3 w-3" />
                          {task.recurrence.frequency}
                        </span>
                      )}
                    </div>
                  </button>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={PRIORITY_BADGE[task.priority]}>{task.priority}</Badge>
                  <select
                    value={task.status}
                    onChange={(e) =>
                      handleUpdateTask(task.id, { status: e.target.value })
                    }
                    className="h-7 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
                    aria-label={`Status for ${task.title}`}
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">Working</option>
                    <option value="done">Done</option>
                    <option value="blocked">Blocked</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-over Task Detail Drawer */}
      {selectedTask && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={() => setSelectedTaskId(null)}>
          <div
            className="h-full w-full max-w-md overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Task Detail
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDuplicateTask(selectedTask.id)}
                  title="Duplicate task"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDeleteTask(selectedTask.id)}
                  title="Delete task"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSelectedTaskId(null)}
                  aria-label="Close detail panel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)]">
                  Title
                </label>
                <Input
                  defaultValue={selectedTask.title}
                  key={`title-${selectedTask.id}`}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val && val !== selectedTask.title) {
                      handleUpdateTask(selectedTask.id, { title: val });
                    }
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)]">
                  Description
                </label>
                <textarea
                  rows={3}
                  defaultValue={selectedTask.description ?? ""}
                  key={`desc-${selectedTask.id}`}
                  onBlur={(e) => {
                    if (e.target.value !== (selectedTask.description ?? "")) {
                      handleUpdateTask(selectedTask.id, {
                        description: e.target.value || null,
                      });
                    }
                  }}
                  placeholder="Add notes or context..."
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[var(--muted-foreground)]">
                    Status
                  </label>
                  <select
                    value={selectedTask.status}
                    onChange={(e) =>
                      handleUpdateTask(selectedTask.id, { status: e.target.value })
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">Working</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-[var(--muted-foreground)]">
                    Priority
                  </label>
                  <select
                    value={selectedTask.priority}
                    onChange={(e) =>
                      handleUpdateTask(selectedTask.id, { priority: e.target.value })
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[var(--muted-foreground)]">
                    Due Date
                  </label>
                  <Input
                    type="date"
                    value={
                      selectedTask.dueAt
                        ? new Date(selectedTask.dueAt).toISOString().slice(0, 10)
                        : ""
                    }
                    onChange={(e) =>
                      handleUpdateTask(selectedTask.id, {
                        dueAt: e.target.value
                          ? new Date(`${e.target.value}T12:00:00.000Z`).toISOString()
                          : null,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[var(--muted-foreground)]">
                    Estimate (min)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    defaultValue={selectedTask.estimatedMinutes ?? ""}
                    key={`est-${selectedTask.id}`}
                    onBlur={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      if (val !== selectedTask.estimatedMinutes) {
                        handleUpdateTask(selectedTask.id, { estimatedMinutes: val });
                      }
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[var(--muted-foreground)]">
                    Project
                  </label>
                  <select
                    value={selectedTask.projectId ?? ""}
                    onChange={(e) =>
                      handleUpdateTask(selectedTask.id, {
                        projectId: e.target.value || null,
                      })
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
                  >
                    <option value="">None</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-[var(--muted-foreground)]">
                    Linked Note
                  </label>
                  <select
                    value={selectedTask.noteId ?? ""}
                    onChange={(e) =>
                      handleUpdateTask(selectedTask.id, {
                        noteId: e.target.value || null,
                      })
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
                  >
                    <option value="">None</option>
                    {notes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedTask.noteId && (
                <Link
                  href={`/notes?id=${selectedTask.noteId}`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Open linked note →
                </Link>
              )}

              {/* Tags */}
              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)]">
                  Tags
                </label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {selectedTask.tags.map((tag) => (
                    <Badge key={tag.id} variant="default" className="gap-1">
                      {tag.name}
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateTask(selectedTask.id, {
                            tags: selectedTask.tags
                              .filter((t) => t.id !== tag.id)
                              .map((t) => t.name),
                          })
                        }
                        aria-label={`Remove tag ${tag.name}`}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const next = tagInput.trim();
                    if (!next) return;
                    handleUpdateTask(selectedTask.id, {
                      tags: [...selectedTask.tags.map((t) => t.name), next],
                    });
                    setTagInput("");
                  }}
                >
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add tag..."
                    className="h-8 text-xs"
                  />
                  <Button type="submit" size="sm" variant="outline">
                    Add
                  </Button>
                </form>
              </div>

              {/* Subtasks */}
              <div className="border-t border-[var(--border)] pt-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Subtasks ({subtasksOfSelected.length})
                </label>
                <div className="mt-2 space-y-1.5">
                  {subtasksOfSelected.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateTask(sub.id, {
                            status: sub.status === "done" ? "todo" : "done",
                          })
                        }
                        className="flex items-center gap-2 text-left"
                      >
                        {sub.status === "done" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Circle className="h-3.5 w-3.5" />
                        )}
                        <span
                          className={
                            sub.status === "done"
                              ? "line-through text-[var(--muted-foreground)]"
                              : ""
                          }
                        >
                          {sub.title}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(sub.id)}
                        className="text-[var(--muted-foreground)] hover:text-red-500"
                        aria-label="Delete subtask"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddSubtask} className="mt-2 flex gap-2">
                  <Input
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    placeholder="Add subtask..."
                    className="h-8 text-xs"
                  />
                  <Button type="submit" size="sm" variant="outline">
                    Add
                  </Button>
                </form>
              </div>

              {/* Comments */}
              <div className="border-t border-[var(--border)] pt-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Comments ({comments.length})
                </label>
                <div className="mt-2 space-y-2">
                  {comments.length === 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      No comments yet.
                    </p>
                  ) : (
                    comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-2.5 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="whitespace-pre-wrap text-[var(--foreground)]">
                            {comment.content}
                          </p>
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch(
                                `/api/tasks/${selectedTask.id}/comments/${comment.id}`,
                                { method: "DELETE" }
                              );
                              await queryClient.invalidateQueries({
                                queryKey: ["task-comments", selectedTask.id],
                              });
                            }}
                            className="shrink-0 text-[var(--muted-foreground)] hover:text-red-500"
                            aria-label="Delete comment"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="mt-1 text-[10px] text-[var(--muted-foreground)]">
                          {new Date(comment.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form
                  className="mt-2 flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!commentInput.trim()) return;
                    setPostingComment(true);
                    try {
                      const res = await fetch(
                        `/api/tasks/${selectedTask.id}/comments`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ content: commentInput.trim() }),
                        }
                      );
                      if (res.ok) {
                        setCommentInput("");
                        await Promise.all([
                          queryClient.invalidateQueries({
                            queryKey: ["task-comments", selectedTask.id],
                          }),
                          queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
                        ]);
                      }
                    } finally {
                      setPostingComment(false);
                    }
                  }}
                >
                  <Input
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Write a comment..."
                    className="h-8 text-xs"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={postingComment || !commentInput.trim()}
                  >
                    Post
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
