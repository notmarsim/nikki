"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Square, Timer, Trash2 } from "lucide-react";
import type { ProjectRecord, TaskRecord } from "@/db/schema";
import { computeElapsedFocusSeconds } from "@/modules/focus/utils";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface FocusOverviewPayload {
  activeSession: {
    id: string;
    mode: "pomodoro" | "stopwatch";
    status: "running" | "paused";
    description: string | null;
    category: string | null;
    taskId: string | null;
    projectId: string | null;
    courseId: string | null;
    intervals: Array<{
      id: string;
      intervalType: string;
      startedAt: string;
      endedAt: string | null;
    }>;
    elapsedSeconds: number;
  } | null;
  preferences: {
    focusMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    cyclesBeforeLongBreak: number;
    soundEnabled: boolean;
  };
  recentSessions: Array<{
    id: string;
    mode: string;
    startedAt: string;
    actualDurationSeconds: number;
    description: string | null;
    category: string | null;
  }>;
  analytics: {
    todayMinutes: number;
    weekMinutes: number;
    sessionsCount: number;
    avgMinutes: number;
  };
}

function formatDuration(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

export function FocusWorkspace({
  initialOverview,
  tasks,
  projects,
  courses,
}: {
  initialOverview: FocusOverviewPayload;
  tasks: TaskRecord[];
  projects: ProjectRecord[];
  courses: Array<{ id: string; title: string }>;
}) {
  const { tr, language } = useI18n();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"pomodoro" | "stopwatch">("pomodoro");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [taskId, setTaskId] = useState(searchParams.get("taskId") ?? "");
  const [projectId, setProjectId] = useState(searchParams.get("projectId") ?? "");
  const [courseId, setCourseId] = useState(searchParams.get("courseId") ?? "");
  const [liveSeconds, setLiveSeconds] = useState(
    initialOverview.activeSession?.elapsedSeconds ?? 0
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: overview = initialOverview } = useQuery<FocusOverviewPayload>({
    queryKey: ["focus-overview"],
    queryFn: async () => {
      const res = await fetch("/api/focus");
      if (!res.ok) throw new Error("Failed to load focus overview");
      const json = await res.json();
      return json.data;
    },
    initialData: initialOverview,
  });

  // Rehydrate reliable elapsed time from server timestamps every second
  useEffect(() => {
    const active = overview.activeSession;
    if (!active) {
      setLiveSeconds(0);
      return;
    }

    const computeNow = () => {
      const parsedIntervals = active.intervals.map((i) => ({
        intervalType: i.intervalType,
        startedAt: new Date(i.startedAt),
        endedAt: i.endedAt ? new Date(i.endedAt) : null,
      }));
      setLiveSeconds(computeElapsedFocusSeconds(parsedIntervals, new Date()));
    };

    computeNow();
    if (active.status !== "running") return;

    const timer = setInterval(computeNow, 1000);
    return () => clearInterval(timer);
  }, [overview.activeSession]);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["focus-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["habits"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const handleStart = async () => {
    setErrorMsg(null);
    const res = await fetch("/api/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        description: description.trim() || null,
        category: category.trim() || null,
        taskId: taskId || null,
        projectId: projectId || null,
        courseId: courseId || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErrorMsg(
        json?.error?.message ?? tr("Unable to start session", "Não foi possível iniciar a sessão")
      );
      await refreshAll();
      return;
    }
    await refreshAll();
  };

  const handleTransition = async (action: "pause" | "resume" | "complete" | "discard") => {
    if (!overview.activeSession) return;
    const res = await fetch(`/api/focus/${overview.activeSession.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      if (action === "complete" || action === "discard") {
        setDescription("");
      }
      await refreshAll();
    }
  };

  const active = overview.activeSession;
  const targetSeconds = overview.preferences.focusMinutes * 60;
  const displaySeconds =
    active?.mode === "pomodoro"
      ? Math.max(0, targetSeconds - liveSeconds)
      : liveSeconds;

  const modeLabel = (m: string) =>
    m === "pomodoro"
      ? tr("Pomodoro", "Pomodoro")
      : m === "stopwatch"
        ? tr("Stopwatch", "Cronômetro")
        : m;

  const statusLabel = (s: string) =>
    s === "running"
      ? tr("running", "em andamento")
      : s === "paused"
        ? tr("paused", "pausado")
        : s;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {tr("Focus & Time Tracking", "Foco e Controle de Tempo")}
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {tr(
            "Pomodoro and Stopwatch sessions linked to your Tasks, Projects, and Courses.",
            "Sessões de Pomodoro e Cronômetro vinculadas às suas Tarefas, Projetos e Cursos."
          )}
        </p>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-[var(--muted-foreground)]">
              {tr("Focused Today", "Focado Hoje")}
            </div>
            <div className="text-2xl font-bold">{overview.analytics.todayMinutes}m</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-[var(--muted-foreground)]">
              {tr("This Week", "Esta Semana")}
            </div>
            <div className="text-2xl font-bold">{overview.analytics.weekMinutes}m</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-[var(--muted-foreground)]">
              {tr("Sessions", "Sessões")}
            </div>
            <div className="text-2xl font-bold">{overview.analytics.sessionsCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-[var(--muted-foreground)]">
              {tr("Avg Session", "Média por Sessão")}
            </div>
            <div className="text-2xl font-bold">{overview.analytics.avgMinutes}m</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Timer Card */}
      <Card>
        <CardContent className="p-6 space-y-5">
          {errorMsg && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
              {errorMsg}
            </div>
          )}

          {!active ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                {(["pomodoro", "stopwatch"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
                      mode === m
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "bg-[var(--surface-muted)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {modeLabel(m)}
                  </button>
                ))}
              </div>

              <div className="py-4 text-center font-mono text-6xl font-bold tracking-tight">
                {mode === "pomodoro"
                  ? formatDuration(overview.preferences.focusMinutes * 60)
                  : "00:00"}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
                >
                  <option value="">{tr("Link Task (optional)", "Vincular Tarefa (opcional)")}</option>
                  {tasks
                    .filter((t) => t.status !== "done" && t.status !== "cancelled")
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>

                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
                >
                  <option value="">{tr("Link Project (optional)", "Vincular Projeto (opcional)")}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
                >
                  <option value="">{tr("Link Course (optional)", "Vincular Curso (opcional)")}</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>

                <Input
                  placeholder={tr("Category or note...", "Categoria ou observação...")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex justify-center pt-2">
                <Button size="lg" onClick={handleStart}>
                  <Play className="h-4 w-4" />{" "}
                  {mode === "pomodoro"
                    ? tr("Start Pomodoro", "Iniciar Pomodoro")
                    : tr("Start Stopwatch", "Iniciar Cronômetro")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5 text-center">
              <div className="flex items-center justify-center gap-2">
                <Badge variant="accent">
                  {modeLabel(active.mode)}
                </Badge>
                <Badge variant={active.status === "running" ? "success" : "warning"}>
                  {statusLabel(active.status)}
                </Badge>
              </div>

              <div className="font-mono text-6xl font-bold tracking-tight">
                {formatDuration(displaySeconds)}
              </div>

              {active.description && (
                <p className="text-sm text-[var(--muted-foreground)]">{active.description}</p>
              )}

              <div className="flex flex-wrap items-center justify-center gap-2">
                {active.status === "running" ? (
                  <Button variant="outline" onClick={() => handleTransition("pause")}>
                    <Pause className="h-4 w-4" /> {tr("Pause", "Pausar")}
                  </Button>
                ) : (
                  <Button onClick={() => handleTransition("resume")}>
                    <Play className="h-4 w-4" /> {tr("Resume", "Retomar")}
                  </Button>
                )}

                <Button variant="default" onClick={() => handleTransition("complete")}>
                  <Square className="h-4 w-4" /> {tr("Complete & Save", "Concluir e Salvar")}
                </Button>

                <Button variant="ghost" onClick={() => handleTransition("discard")}>
                  <Trash2 className="h-4 w-4 text-red-500" /> {tr("Discard", "Descartar")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preferences & Recent History */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {tr("Pomodoro Preferences", "Preferências do Pomodoro")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">
                  {tr("Focus (min)", "Foco (min)")}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={180}
                  defaultValue={overview.preferences.focusMinutes}
                  onBlur={async (e) => {
                    const v = Number(e.target.value);
                    if (v >= 1) {
                      await fetch("/api/focus/preferences", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ focusMinutes: v }),
                      });
                      await refreshAll();
                    }
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">
                  {tr("Short Break", "Pausa Curta")}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  defaultValue={overview.preferences.shortBreakMinutes}
                  onBlur={async (e) => {
                    const v = Number(e.target.value);
                    if (v >= 1) {
                      await fetch("/api/focus/preferences", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ shortBreakMinutes: v }),
                      });
                      await refreshAll();
                    }
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">
                  {tr("Long Break", "Pausa Longa")}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  defaultValue={overview.preferences.longBreakMinutes}
                  onBlur={async (e) => {
                    const v = Number(e.target.value);
                    if (v >= 1) {
                      await fetch("/api/focus/preferences", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ longBreakMinutes: v }),
                      });
                      await refreshAll();
                    }
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Timer className="h-4 w-4" /> {tr("Recent Sessions", "Sessões Recentes")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {overview.recentSessions.length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--muted-foreground)]">
                {tr("No completed focus sessions yet.", "Nenhuma sessão de foco concluída ainda.")}
              </p>
            ) : (
              overview.recentSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
                >
                  <div className="truncate">
                    <span className="font-medium">{modeLabel(s.mode)}</span>
                    {s.description && (
                      <span className="text-[var(--muted-foreground)]">
                        {" "}
                        — {s.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline">
                      {Math.max(1, Math.round(s.actualDurationSeconds / 60))}m
                    </Badge>
                    <span className="text-[var(--muted-foreground)]">
                      {new Date(s.startedAt).toLocaleDateString(locale)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
