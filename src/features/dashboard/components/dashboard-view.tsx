"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CheckSquare,
  FileText,
  Flame,
  FolderKanban,
  Inbox,
  Layers,
  Plus,
  Timer,
} from "lucide-react";
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
import { formatCents } from "@/modules/finances/money";

export interface DashboardPayload {
  overview: {
    totalNotes: number;
    totalTasks: number;
    openTasks: number;
    activeProjects: number;
    pendingInbox: number;
    flashcardsDue?: number;
    studyMinutesToday?: number;
    habitsCompletedToday?: number;
    habitsTotal?: number;
  };
  tasksToday: {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
    items: Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      dueAt: string | Date | null;
    }>;
  };
  activeProjects: Array<{
    id: string;
    name: string;
    color: string;
    status: string;
    progress: number;
    totalTasks: number;
    completedTasks: number;
  }>;
  recentNotes: Array<{
    id: string;
    title: string;
    icon: string | null;
    updatedAt: string | Date;
  }>;
  recentActivity: Array<{
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    payload: Record<string, unknown> | null;
    createdAt: string | Date;
  }>;
  upcomingEvents?: Array<{
    id: string;
    title: string;
    startAt: string | Date;
    endAt: string | Date;
    allDay: boolean;
    color: string | null;
  }>;
  activeFocus?: {
    id: string;
    mode: string;
    status: string;
    startedAt: string | Date;
    elapsedSeconds: number;
  } | null;
  recentBookmarks?: Array<{
    id: string;
    title: string;
    url: string;
    domain: string;
    readingStatus: string;
  }>;
  favoriteSnippets?: Array<{
    id: string;
    title: string;
    language: string;
    isFavorite: boolean;
  }>;
  financeWidget?: {
    hidden: boolean;
    month: string;
    totalBalanceCents: number;
    monthIncomeCents: number;
    monthExpenseCents: number;
  } | null;
}

const ACTIVITY_LABELS: Record<string, string> = {
  "task.created": "Task Created",
  "task.updated": "Task Updated",
  "task.completed": "Task Completed",
  "task.commented": "Task Commented",
  "note.created": "Note Created",
  "note.updated": "Note Updated",
  "note.archived": "Note Archived",
  "project.created": "Project Created",
  "project.updated": "Project Updated",
  "inbox.converted_to_note": "Inbox Converted to Note",
  "inbox.converted_to_task": "Inbox Converted to Task",
};

function formatActivityAction(action: string): string {
  if (ACTIVITY_LABELS[action]) return ACTIVITY_LABELS[action];
  return action
    .split(/[._]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function DashboardView({
  userName,
  timezone,
  initialData,
  hiddenWidgets = [],
}: {
  userName: string;
  timezone: string;
  initialData: DashboardPayload;
  hiddenWidgets?: string[];
}) {
  const { t, tr, language } = useI18n();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const showWidget = (id: string) => !hiddenWidgets.includes(id);
  const queryClient = useQueryClient();
  const [quickText, setQuickText] = useState("");
  const [capturing, setCapturing] = useState(false);

  const { data: onboardingData, refetch: refetchOnboarding } = useQuery<{
    suggestions: Array<{
      id: string;
      title: string;
      description: string;
      actionLabel: string;
      titlePt?: string;
      descriptionPt?: string;
      actionLabelPt?: string;
      href: string;
    }>;
  }>({
    queryKey: ["onboarding-suggestions"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding");
      if (!res.ok) return { suggestions: [] };
      const json = await res.json();
      return { suggestions: json.data?.suggestions ?? [] };
    },
  });

  const { data } = useQuery<DashboardPayload>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to refresh dashboard");
      const json = await res.json();
      return json.data;
    },
    initialData,
  });

  const handleQuickCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickText.trim()) return;
    setCapturing(true);
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "quick_note", content: quickText.trim() }),
      });
      if (res.ok) {
        setQuickText("");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
          queryClient.invalidateQueries({ queryKey: ["inbox"] }),
        ]);
      }
    } finally {
      setCapturing(false);
    }
  };

  const todayFormatted = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timezone || "UTC",
  }).format(new Date());

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Greeting */}
      <div
        data-tour="dashboard-header"
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("dash.welcome")}, {userName}
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">{todayFormatted}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/notes?new=1">
            <Button size="sm" variant="outline">
              <FileText className="h-3.5 w-3.5" /> {t("dash.newNote")}
            </Button>
          </Link>
          <Link href="/tasks?new=1">
            <Button size="sm" variant="outline">
              <CheckSquare className="h-3.5 w-3.5" /> {t("dash.newTask")}
            </Button>
          </Link>
          <Link href="/projects">
            <Button size="sm">
              <FolderKanban className="h-3.5 w-3.5" /> {t("dash.projects")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Contextual Dashboard Suggestions */}
      {(onboardingData?.suggestions ?? []).length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {(onboardingData?.suggestions ?? []).map((sug) => (
            <div
              key={sug.id}
              className="flex flex-col justify-between gap-2 rounded-xl border border-[var(--accent)]/35 bg-[var(--accent)]/5 p-3.5 text-xs"
            >
              <div>
                <div className="font-semibold text-[var(--foreground)]">
                  {language === "pt-BR" ? (sug.titlePt ?? sug.title) : sug.title}
                </div>
                <p className="mt-0.5 text-[var(--muted-foreground)]">
                  {language === "pt-BR" ? (sug.descriptionPt ?? sug.description) : sug.description}
                </p>
              </div>
              <div className="flex items-center justify-between pt-1">
                <Link href={sug.href} className="font-medium text-[var(--accent)] hover:underline">
                  {language === "pt-BR" ? (sug.actionLabelPt ?? sug.actionLabel) : sug.actionLabel} →
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/onboarding", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ dismissSuggestionId: sug.id }),
                    });
                    void refetchOnboarding();
                  }}
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  {t("dash.dismiss")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Overview Stats */}
      {showWidget("overview") && (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/tasks">
          <Card className="hover:border-[var(--accent)] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                {tr("Open Tasks", "Tarefas Abertas")}
              </CardTitle>
              <CheckSquare className="h-4 w-4 text-[var(--muted-foreground)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.openTasks}</div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {data.overview.totalTasks} {tr("total tasks", "tarefas no total")}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/projects">
          <Card className="hover:border-[var(--accent)] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                {tr("Active Projects", "Projetos Ativos")}
              </CardTitle>
              <FolderKanban className="h-4 w-4 text-[var(--muted-foreground)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.activeProjects}</div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {tr("Progress synced from tasks", "Progresso sincronizado das tarefas")}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/notes">
          <Card className="hover:border-[var(--accent)] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                {tr("Recent Notes", "Notas Recentes")}
              </CardTitle>
              <FileText className="h-4 w-4 text-[var(--muted-foreground)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.recentNotes.length}</div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {tr("Block editor & links", "Editor em blocos e links")}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/inbox">
          <Card className="hover:border-[var(--accent)] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                {tr("Pending Inbox", "Inbox Pendente")}
              </CardTitle>
              <Inbox className="h-4 w-4 text-[var(--muted-foreground)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.pendingInbox}</div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {tr("Ready to triage", "Pronto para triagem")}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
      )}

      {/* Quick Capture Widget */}
      {showWidget("quick_capture") && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr("Quick Capture", "Captura Rápida")}</CardTitle>
          <CardDescription>
            {tr("Send a thought or task straight to your Universal Inbox.", "Envie uma ideia ou tarefa direto para sua Inbox Universal.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleQuickCapture} className="flex gap-2">
            <Input
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              placeholder={tr("Capture an idea, task, or note...", "Capture uma ideia, tarefa ou nota...")}
            />
            <Button type="submit" disabled={capturing || !quickText.trim()}>
              <Plus className="h-4 w-4" />
              {capturing ? tr("Saving...", "Salvando...") : tr("Capture", "Capturar")}
            </Button>
          </form>
        </CardContent>
      </Card>
      )}

      {/* Phase 3 Productivity Strip */}
      {showWidget("learning_overview") && (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/flashcards">
          <Card className="hover:border-[var(--accent)] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                {tr("Flashcards Due", "Flashcards para Revisar")}
              </CardTitle>
              <Layers className="h-4 w-4 text-[var(--muted-foreground)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.flashcardsDue ?? 0}</div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {tr("Ready for review", "Prontos para revisão")}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/focus">
          <Card className="hover:border-[var(--accent)] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                {tr("Study Time Today", "Tempo de Foco Hoje")}
              </CardTitle>
              <Timer className="h-4 w-4 text-[var(--muted-foreground)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.studyMinutesToday ?? 0}m</div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {data.activeFocus
                  ? `${tr("Active", "Ativo")} ${data.activeFocus.mode} (${data.activeFocus.status})`
                  : tr("Start a focus session", "Iniciar sessão de foco")}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/habits">
          <Card className="hover:border-[var(--accent)] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                {tr("Today's Habits", "Hábitos de Hoje")}
              </CardTitle>
              <Flame className="h-4 w-4 text-[var(--muted-foreground)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.overview.habitsCompletedToday ?? 0}/{data.overview.habitsTotal ?? 0}
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {tr("Daily consistency check-in", "Check-in diário de consistência")}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/calendar">
          <Card className="hover:border-[var(--accent)] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                {tr("Upcoming Events", "Próximos Eventos")}
              </CardTitle>
              <Calendar className="h-4 w-4 text-[var(--muted-foreground)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.upcomingEvents?.length ?? 0}</div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {tr("Next 7 days on calendar", "Próximos 7 dias no calendário")}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
      )}

      {/* Main Grid: Tasks Today + Active Projects */}
      {(showWidget("tasks_today") || showWidget("active_projects")) && (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tasks Today */}
        {showWidget("tasks_today") && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{tr("Tasks Today", "Tarefas de Hoje")}</CardTitle>
              <CardDescription>
                {data.tasksToday.completed} {tr("done", "concluídas")} · {data.tasksToday.pending} {tr("pending", "pendentes")}
                {data.tasksToday.overdue > 0 && ` · ${data.tasksToday.overdue} ${tr("overdue", "atrasadas")}`}
              </CardDescription>
            </div>
            <Link href="/tasks" className="text-xs font-medium text-[var(--accent)] hover:underline">
              {tr("View all →", "Ver tudo →")}
            </Link>
          </CardHeader>
          <CardContent>
            {data.tasksToday.items.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                <p>{tr("No tasks scheduled for today or overdue.", "Nenhuma tarefa agendada para hoje ou atrasada.")}</p>
                <Link href="/tasks" className="mt-2 inline-block text-xs text-[var(--accent)] hover:underline">
                  {tr("Add your first task →", "Adicionar primeira tarefa →")}
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {data.tasksToday.items.map((task) => {
                  const isOverdue =
                    task.dueAt &&
                    task.status !== "done" &&
                    new Date(task.dueAt) < new Date(new Date().setHours(0, 0, 0, 0));
                  return (
                    <Link
                      key={task.id}
                      href={`/tasks?taskId=${task.id}`}
                      className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-muted)]"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {task.status === "done" ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        ) : isOverdue ? (
                          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                        ) : (
                          <CheckSquare className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                        )}
                        <span
                          className={`truncate ${
                            task.status === "done" ? "line-through text-[var(--muted-foreground)]" : ""
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                      <Badge variant={isOverdue ? "warning" : "outline"}>{task.priority}</Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Active Projects */}
        {showWidget("active_projects") && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{tr("Active Projects", "Projetos Ativos")}</CardTitle>
              <CardDescription>{tr("Real-time progress from linked tasks.", "Progresso em tempo real das tarefas vinculadas.")}</CardDescription>
            </div>
            <Link href="/projects" className="text-xs font-medium text-[var(--accent)] hover:underline">
              {tr("View all →", "Ver tudo →")}
            </Link>
          </CardHeader>
          <CardContent>
            {data.activeProjects.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                <p>{tr("No active projects yet.", "Nenhum projeto ativo ainda.")}</p>
                <Link href="/projects" className="mt-2 inline-block text-xs text-[var(--accent)] hover:underline">
                  {tr("Create a project →", "Criar um projeto →")}
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {data.activeProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects?id=${project.id}`}
                    className="block rounded-lg border border-[var(--border)] p-3 hover:bg-[var(--surface-muted)]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="text-sm font-medium">{project.name}</span>
                      </div>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {project.completedTasks}/{project.totalTasks} {tr("tasks", "tarefas")} · {project.progress}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${project.progress}%`,
                          backgroundColor: project.color,
                        }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>
      )}

      {/* Bottom Grid: Recent Notes + Recent Activity */}
      {(showWidget("recent_notes") || showWidget("recent_activity")) && (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {showWidget("recent_notes") && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{tr("Recent Notes", "Notas Recentes")}</CardTitle>
            <Link href="/notes" className="text-xs font-medium text-[var(--accent)] hover:underline">
              {tr("Open Notes →", "Abrir Notas →")}
            </Link>
          </CardHeader>
          <CardContent>
            {data.recentNotes.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                <p>{tr("No notes yet.", "Nenhuma nota ainda.")}</p>
                <Link href="/notes?new=1" className="mt-2 inline-block text-xs text-[var(--accent)] hover:underline">
                  {tr("Create your first note →", "Criar primeira nota →")}
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {data.recentNotes.map((note) => (
                  <Link
                    key={note.id}
                    href={`/notes?id=${note.id}`}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-muted)]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                      <span className="truncate font-medium">{note.title}</span>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {new Date(note.updatedAt).toLocaleDateString(locale)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {showWidget("recent_activity") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tr("Recent Activity", "Atividade Recente")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                {tr("No recent activity recorded yet.", "Nenhuma atividade recente registrada ainda.")}
              </div>
            ) : (
              <div className="space-y-2">
                {data.recentActivity.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
                  >
                    <div className="truncate">
                      <span className="font-medium">{formatActivityAction(event.action)}</span>
                      {event.payload && typeof event.payload.title === "string" && (
                        <span className="text-[var(--muted-foreground)]">
                          {" "}
                          — {event.payload.title}
                        </span>
                      )}
                      {event.payload && typeof event.payload.name === "string" && (
                        <span className="text-[var(--muted-foreground)]">
                          {" "}
                          — {event.payload.name}
                        </span>
                      )}
                    </div>
                    <span className="ml-2 shrink-0 text-[var(--muted-foreground)]">
                      {new Date(event.createdAt).toLocaleDateString(locale)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>
      )}

      {/* Upcoming Calendar Events */}
      {showWidget("upcoming_events") && (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">{tr("Upcoming Events", "Próximos Eventos")}</CardTitle>
            <CardDescription>
              {tr("Your scheduled events and time blocks for the next 7 days.", "Seus eventos e blocos de tempo agendados para os próximos 7 dias.")}
            </CardDescription>
          </div>
          <Link href="/calendar" className="text-xs font-medium text-[var(--accent)] hover:underline">
            {tr("Open Calendar →", "Abrir Calendário →")}
          </Link>
        </CardHeader>
        <CardContent>
          {!data.upcomingEvents || data.upcomingEvents.length === 0 ? (
            <div className="py-6 text-center text-sm text-[var(--muted-foreground)]">
              <p>{tr("No upcoming events in the next 7 days.", "Nenhum evento nos próximos 7 dias.")}</p>
              <Link href="/calendar" className="mt-2 inline-block text-xs text-[var(--accent)] hover:underline">
                {tr("Schedule an event →", "Agendar um evento →")}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {data.upcomingEvents.map((evt) => (
                <Link
                  key={evt.id}
                  href={`/calendar?eventId=${evt.id}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-muted)]"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: evt.color ?? "var(--accent)" }}
                    />
                    <span className="truncate font-medium">{evt.title}</span>
                  </div>
                  <span className="ml-2 shrink-0 text-xs text-[var(--muted-foreground)]">
                    {evt.allDay
                      ? new Date(evt.startAt).toLocaleDateString(locale)
                      : new Date(evt.startAt).toLocaleString(locale, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Phase 4: Library & Developer Hub Widgets */}
      {(showWidget("recent_bookmarks") || showWidget("developer_snippets")) && (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {showWidget("recent_bookmarks") && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{tr("Recent Bookmarks", "Favoritos Recentes")}</CardTitle>
              <CardDescription>{tr("Saved articles, docs, and resources.", "Artigos, documentações e recursos salvos.")}</CardDescription>
            </div>
            <Link href="/bookmarks" className="text-xs font-medium text-[var(--accent)] hover:underline">
              {tr("Open Library →", "Abrir Biblioteca →")}
            </Link>
          </CardHeader>
          <CardContent>
            {!data.recentBookmarks || data.recentBookmarks.length === 0 ? (
              <div className="py-5 text-center text-sm text-[var(--muted-foreground)]">
                {tr("No bookmarks saved yet.", "Nenhum favorito salvo ainda.")}
              </div>
            ) : (
              <div className="space-y-2">
                {data.recentBookmarks.map((b) => (
                  <a
                    key={b.id}
                    href={b.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-muted)]"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{b.title}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">{b.domain}</div>
                    </div>
                    <Badge variant="outline" className="ml-2 shrink-0 text-[10px] capitalize">
                      {b.readingStatus}
                    </Badge>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {showWidget("developer_snippets") && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{tr("Developer Hub Snippets", "Snippets do Developer Hub")}</CardTitle>
              <CardDescription>{tr("Quick access to your saved code snippets.", "Acesso rápido aos seus snippets de código salvos.")}</CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <Link href="/knowledge-graph" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                {tr("Graph", "Grafo")}
              </Link>
              <Link href="/developer-hub" className="text-[var(--accent)] hover:underline">
                {tr("Open Dev Hub →", "Abrir Dev Hub →")}
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {!data.favoriteSnippets || data.favoriteSnippets.length === 0 ? (
              <div className="py-5 text-center text-sm text-[var(--muted-foreground)]">
                {tr("No code snippets saved yet.", "Nenhum snippet de código salvo ainda.")}
              </div>
            ) : (
              <div className="space-y-2">
                {data.favoriteSnippets.map((s) => (
                  <Link
                    key={s.id}
                    href={`/developer-hub?tab=snippets&id=${s.id}`}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-muted)]"
                  >
                    <span className="truncate font-medium">{s.title}</span>
                    <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                      {s.language}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>
      )}

      {/* Phase 5: Finance & Analytics Snapshot */}
      {showWidget("finances") && data.financeWidget && (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base">
                {t("dash.finTitle")} ({data.financeWidget.month})
              </CardTitle>
              <CardDescription>
                {data.financeWidget.hidden
                  ? t("dash.finPrivacy")
                  : t("dash.finDesc")}
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-xs font-medium whitespace-nowrap">
              <Link href="/analytics" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                {t("dash.analytics")}
              </Link>
              <Link href="/finances" className="text-[var(--accent)] hover:underline">
                {t("dash.openFinances")}
              </Link>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs text-[var(--muted-foreground)]">{t("dash.balance")}</div>
              <div className="text-lg font-bold">
                {formatCents(data.financeWidget.totalBalanceCents, "BRL", true, data.financeWidget.hidden)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--muted-foreground)]">{t("dash.income")}</div>
              <div className="text-lg font-bold text-emerald-500">
                {formatCents(data.financeWidget.monthIncomeCents, "BRL", true, data.financeWidget.hidden)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--muted-foreground)]">{t("dash.expenses")}</div>
              <div className="text-lg font-bold text-red-500">
                {formatCents(data.financeWidget.monthExpenseCents, "BRL", true, data.financeWidget.hidden)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
