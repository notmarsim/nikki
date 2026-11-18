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
}: {
  userName: string;
  timezone: string;
  initialData: DashboardPayload;
}) {
  const queryClient = useQueryClient();
  const [quickText, setQuickText] = useState("");
  const [capturing, setCapturing] = useState(false);

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

  const todayFormatted = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timezone || "UTC",
  }).format(new Date());

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Greeting */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {userName}
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">{todayFormatted}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/notes?new=1">
            <Button size="sm" variant="outline">
              <FileText className="h-3.5 w-3.5" /> New Note
            </Button>
          </Link>
          <Link href="/tasks?new=1">
            <Button size="sm" variant="outline">
              <CheckSquare className="h-3.5 w-3.5" /> New Task
            </Button>
          </Link>
          <Link href="/projects">
            <Button size="sm">
              <FolderKanban className="h-3.5 w-3.5" /> Projects
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/tasks">
          <Card className="hover:border-[var(--accent)] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                Open Tasks
              </CardTitle>
              <CheckSquare className="h-4 w-4 text-[var(--muted-foreground)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.openTasks}</div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {data.overview.totalTasks} total tasks
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/projects">
          <Card className="hover:border-[var(--accent)] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                Active Projects
              </CardTitle>
              <FolderKanban className="h-4 w-4 text-[var(--muted-foreground)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.activeProjects}</div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Progress synced from tasks
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/notes">
          <Card className="hover:border-[var(--accent)] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                Recent Notes
              </CardTitle>
              <FileText className="h-4 w-4 text-[var(--muted-foreground)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.recentNotes.length}</div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Block editor &amp; [[links]]
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/inbox">
          <Card className="hover:border-[var(--accent)] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                Pending Inbox
              </CardTitle>
              <Inbox className="h-4 w-4 text-[var(--muted-foreground)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.pendingInbox}</div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Ready to triage
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Capture Widget */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Capture</CardTitle>
          <CardDescription>
            Send a thought or task straight to your Universal Inbox.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleQuickCapture} className="flex gap-2">
            <Input
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              placeholder="Capture an idea, task, or note..."
            />
            <Button type="submit" disabled={capturing || !quickText.trim()}>
              <Plus className="h-4 w-4" />
              {capturing ? "Saving..." : "Capture"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Phase 3 Productivity Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/flashcards">
          <Card className="hover:border-[var(--accent)] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                Flashcards Due
              </CardTitle>
              <Layers className="h-4 w-4 text-[var(--muted-foreground)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.flashcardsDue ?? 0}</div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Ready for FSRS review
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/focus">
          <Card className="hover:border-[var(--accent)] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                Study Time Today
              </CardTitle>
              <Timer className="h-4 w-4 text-[var(--muted-foreground)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.studyMinutesToday ?? 0}m</div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {data.activeFocus
                  ? `Active ${data.activeFocus.mode} (${data.activeFocus.status})`
                  : "Start a focus session"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/habits">
          <Card className="hover:border-[var(--accent)] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                Today&apos;s Habits
              </CardTitle>
              <Flame className="h-4 w-4 text-[var(--muted-foreground)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.overview.habitsCompletedToday ?? 0}/{data.overview.habitsTotal ?? 0}
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Daily consistency check-in
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/calendar">
          <Card className="hover:border-[var(--accent)] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                Upcoming Events
              </CardTitle>
              <Calendar className="h-4 w-4 text-[var(--muted-foreground)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.upcomingEvents?.length ?? 0}</div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Next 7 days on calendar
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Grid: Tasks Today + Active Projects */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tasks Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Tasks Today</CardTitle>
              <CardDescription>
                {data.tasksToday.completed} done · {data.tasksToday.pending} pending
                {data.tasksToday.overdue > 0 && ` · ${data.tasksToday.overdue} overdue`}
              </CardDescription>
            </div>
            <Link href="/tasks" className="text-xs font-medium text-[var(--accent)] hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            {data.tasksToday.items.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                <p>No tasks scheduled for today or overdue.</p>
                <Link href="/tasks" className="mt-2 inline-block text-xs text-[var(--accent)] hover:underline">
                  Add your first task →
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

        {/* Active Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Active Projects</CardTitle>
              <CardDescription>Real-time progress from linked tasks.</CardDescription>
            </div>
            <Link href="/projects" className="text-xs font-medium text-[var(--accent)] hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            {data.activeProjects.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                <p>No active projects yet.</p>
                <Link href="/projects" className="mt-2 inline-block text-xs text-[var(--accent)] hover:underline">
                  Create a project →
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
                        {project.completedTasks}/{project.totalTasks} tasks · {project.progress}%
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
      </div>

      {/* Bottom Grid: Recent Notes + Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Notes</CardTitle>
            <Link href="/notes" className="text-xs font-medium text-[var(--accent)] hover:underline">
              Open Notes →
            </Link>
          </CardHeader>
          <CardContent>
            {data.recentNotes.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                <p>No notes yet.</p>
                <Link href="/notes?new=1" className="mt-2 inline-block text-xs text-[var(--accent)] hover:underline">
                  Create your first note →
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
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                No recent activity recorded yet.
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
                      {new Date(event.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Calendar Events */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Upcoming Events</CardTitle>
            <CardDescription>
              Your scheduled events and time blocks for the next 7 days.
            </CardDescription>
          </div>
          <Link href="/calendar" className="text-xs font-medium text-[var(--accent)] hover:underline">
            Open Calendar →
          </Link>
        </CardHeader>
        <CardContent>
          {!data.upcomingEvents || data.upcomingEvents.length === 0 ? (
            <div className="py-6 text-center text-sm text-[var(--muted-foreground)]">
              <p>No upcoming events in the next 7 days.</p>
              <Link href="/calendar" className="mt-2 inline-block text-xs text-[var(--accent)] hover:underline">
                Schedule an event →
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
                      ? new Date(evt.startAt).toLocaleDateString()
                      : new Date(evt.startAt).toLocaleString(undefined, {
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

      {/* Phase 4: Library & Developer Hub Widgets */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Bookmarks</CardTitle>
              <CardDescription>Saved articles, docs, and resources.</CardDescription>
            </div>
            <Link href="/bookmarks" className="text-xs font-medium text-[var(--accent)] hover:underline">
              Open Library →
            </Link>
          </CardHeader>
          <CardContent>
            {!data.recentBookmarks || data.recentBookmarks.length === 0 ? (
              <div className="py-5 text-center text-sm text-[var(--muted-foreground)]">
                No bookmarks saved yet.
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Developer Hub Snippets</CardTitle>
              <CardDescription>Quick access to your saved code snippets.</CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <Link href="/knowledge-graph" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                Graph
              </Link>
              <Link href="/developer-hub" className="text-[var(--accent)] hover:underline">
                Open Dev Hub →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {!data.favoriteSnippets || data.favoriteSnippets.length === 0 ? (
              <div className="py-5 text-center text-sm text-[var(--muted-foreground)]">
                No code snippets saved yet.
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
      </div>

      {/* Phase 5: Finance & Analytics Snapshot */}
      {data.financeWidget && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Financial Snapshot ({data.financeWidget.month})
              </CardTitle>
              <CardDescription>
                {data.financeWidget.hidden
                  ? "Privacy mode is enabled in Settings."
                  : "Real-time account balance and monthly cash flow."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <Link href="/analytics" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                Analytics
              </Link>
              <Link href="/finances" className="text-[var(--accent)] hover:underline">
                Open Finances →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs text-[var(--muted-foreground)]">Available Balance</div>
              <div className="text-lg font-bold">
                {formatCents(data.financeWidget.totalBalanceCents, "BRL", true, data.financeWidget.hidden)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--muted-foreground)]">Income</div>
              <div className="text-lg font-bold text-emerald-500">
                {formatCents(data.financeWidget.monthIncomeCents, "BRL", true, data.financeWidget.hidden)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--muted-foreground)]">Expenses</div>
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
