"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import type { TaskRecord } from "@/db/schema";
import type { CalendarOccurrenceWithLinks } from "@/modules/calendar/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/providers/i18n-provider";

type CalendarView = "month" | "week" | "day" | "agenda";

function getRangeForView(anchor: Date, view: CalendarView): { start: Date; end: Date } {
  if (view === "day") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 0, 0, 0);
    const end = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 23, 59, 59);
    return { start, end };
  }
  if (view === "week") {
    const day = anchor.getDay();
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - day, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59);
    return { start, end };
  }
  if (view === "agenda") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 30, 23, 59, 59);
    return { start, end };
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 0, 0, 0);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

export function CalendarWorkspace({
  tasks,
  timezone,
}: {
  tasks: TaskRecord[];
  timezone: string;
}) {
  const { tr, language } = useI18n();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const queryClient = useQueryClient();

  const viewLabel = (v: CalendarView) => {
    switch (v) {
      case "day":
        return tr("Day", "Dia");
      case "week":
        return tr("Week", "Semana");
      case "month":
        return tr("Month", "Mês");
      case "agenda":
        return tr("Agenda", "Agenda");
    }
  };

  const priorityLabel = (priority: string) => {
    switch (priority) {
      case "urgent":
        return tr("Urgent", "Urgente");
      case "high":
        return tr("High", "Alta");
      case "medium":
        return tr("Medium", "Média");
      case "low":
        return tr("Low", "Baixa");
      default:
        return priority;
    }
  };
  const [view, setView] = useState<CalendarView>("week");
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [showNewModal, setShowNewModal] = useState(false);

  // Create event form
  const [title, setTitle] = useState("");
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [isAllDay, setIsAllDay] = useState(false);
  const [color, setColor] = useState("#3b82f6");
  const [recurrence, setRecurrence] = useState<"" | "daily" | "weekly" | "monthly">("");
  const [linkedTaskId, setLinkedTaskId] = useState("");
  const [creating, setCreating] = useState(false);

  const range = useMemo(() => getRangeForView(anchorDate, view), [anchorDate, view]);

  const { data: occurrences = [], isLoading } = useQuery<CalendarOccurrenceWithLinks[]>({
    queryKey: ["calendar", view, range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/calendar?start=${encodeURIComponent(range.start.toISOString())}&end=${encodeURIComponent(range.end.toISOString())}`
      );
      if (!res.ok) throw new Error("Failed to load calendar");
      const json = await res.json();
      return json.data.occurrences;
    },
  });

  const refreshCalendar = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["calendar"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const shiftAnchor = (dir: -1 | 1) => {
    const next = new Date(anchorDate);
    if (view === "day") next.setDate(next.getDate() + dir);
    else if (view === "week") next.setDate(next.getDate() + dir * 7);
    else next.setMonth(next.getMonth() + dir);
    setAnchorDate(next);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const startsAt = isAllDay
        ? new Date(`${dateStr}T00:00:00.000Z`).toISOString()
        : new Date(`${dateStr}T${startTime}:00`).toISOString();
      const endsAt = isAllDay
        ? new Date(`${dateStr}T23:59:59.000Z`).toISOString()
        : new Date(`${dateStr}T${endTime}:00`).toISOString();

      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          startsAt,
          endsAt,
          timezone,
          isAllDay,
          allDayDate: isAllDay ? dateStr : null,
          color,
          recurrence: recurrence ? { frequency: recurrence, interval: 1 } : null,
          taskId: linkedTaskId || null,
        }),
      });
      if (res.ok) {
        setTitle("");
        setLinkedTaskId("");
        setRecurrence("");
        setShowNewModal(false);
        await refreshCalendar();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleScheduleTaskOnDate = async (taskId: string, targetDate: Date) => {
    const start = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      9,
      0,
      0
    );
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const res = await fetch("/api/calendar/schedule-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        timezone,
      }),
    });
    if (res.ok) {
      await refreshCalendar();
    }
  };

  const handleDeleteOccurrence = async (
    occ: CalendarOccurrenceWithLinks,
    scope: "single" | "series"
  ) => {
    const url =
      scope === "single"
        ? `/api/calendar/${occ.eventId}?scope=single&occurrence=${encodeURIComponent(new Date(occ.originalOccurrence).toISOString())}`
        : `/api/calendar/${occ.eventId}`;
    const res = await fetch(url, { method: "DELETE" });
    if (res.ok) {
      await refreshCalendar();
    }
  };

  const openTasks = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");

  const daysInView = useMemo(() => {
    const days: Date[] = [];
    const cursor = new Date(range.start);
    while (cursor <= range.end && days.length < 42) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [range]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tr("Calendar", "Calendário")}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {tr(
              `Schedule events, recurring blocks, and drag tasks into time blocks (${timezone}).`,
              `Agende eventos, blocos recorrentes e arraste tarefas para blocos de horário (${timezone}).`
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
            {(["day", "week", "month", "agenda"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  view === v
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {viewLabel(v)}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => shiftAnchor(-1)}
            aria-label={tr("Previous", "Anterior")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchorDate(new Date())}>
            {tr("Today", "Hoje")}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => shiftAnchor(1)}
            aria-label={tr("Next", "Próximo")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button size="sm" onClick={() => setShowNewModal(true)}>
            <Plus className="h-4 w-4" /> {tr("New Event", "Novo Evento")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Main Calendar Grid */}
        <div className="lg:col-span-9">
          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-[var(--muted-foreground)]">
                {tr("Loading calendar...", "Carregando calendário...")}
              </CardContent>
            </Card>
          ) : view === "agenda" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {tr("Upcoming 30 Days", "Próximos 30 Dias")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {occurrences.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                    {tr(
                      "No events scheduled in the next 30 days.",
                      "Nenhum evento agendado nos próximos 30 dias."
                    )}
                  </p>
                ) : (
                  occurrences.map((occ) => (
                    <div
                      key={occ.occurrenceId}
                      className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3 text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: occ.color }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 font-medium">
                            <span className="truncate">{occ.title}</span>
                            {occ.isRecurring && <Repeat className="h-3 w-3 opacity-60" />}
                            {occ.hasConflict && (
                              <Badge variant="warning" className="gap-1">
                                <AlertTriangle className="h-3 w-3" /> {tr("Conflict", "Conflito")}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)]">
                            {occ.isAllDay
                              ? `${occ.allDayDate} · ${tr("All day", "Dia inteiro")}`
                              : `${new Date(occ.startsAt).toLocaleString(locale)} – ${new Date(occ.endsAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          handleDeleteOccurrence(occ, occ.isRecurring ? "single" : "series")
                        }
                        title={
                          occ.isRecurring
                            ? tr("Cancel this occurrence", "Cancelar esta ocorrência")
                            : tr("Delete event", "Excluir evento")
                        }
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : (
            <div
              className={`grid gap-2 ${
                view === "day"
                  ? "grid-cols-1"
                  : "grid-cols-1 sm:grid-cols-2 md:grid-cols-7"
              }`}
            >
              {daysInView.map((day) => {
                const dayKey = day.toISOString().slice(0, 10);
                const dayOccs = occurrences.filter((o) => {
                  if (o.isAllDay) return o.allDayDate === dayKey;
                  const s = new Date(o.startsAt);
                  return (
                    s.getFullYear() === day.getFullYear() &&
                    s.getMonth() === day.getMonth() &&
                    s.getDate() === day.getDate()
                  );
                });

                const isToday = day.toDateString() === new Date().toDateString();

                return (
                  <div
                    key={dayKey}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const taskId = e.dataTransfer.getData("text/task-id");
                      if (taskId) void handleScheduleTaskOnDate(taskId, day);
                    }}
                    className={`min-h-[140px] rounded-xl p-2.5 flex flex-col gap-1.5 ${
                      isToday
                        ? "border-2 border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/25"
                        : "border border-[var(--border)] bg-[var(--surface)]/60"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={
                            isToday
                              ? "rounded-md bg-[var(--accent)] px-1.5 py-0.5 text-white"
                              : ""
                          }
                        >
                          {day.toLocaleDateString(locale, {
                            weekday: view === "month" ? undefined : "short",
                            day: "numeric",
                            month: view === "day" ? "long" : "short",
                          })}
                        </span>
                        {isToday && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                            {tr("Today", "Hoje")}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDateStr(dayKey);
                          setShowNewModal(true);
                        }}
                        className="rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]"
                        title={tr("Add event on this day", "Adicionar evento neste dia")}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1 flex-1">
                      {dayOccs.map((occ) => (
                        <div
                          key={occ.occurrenceId}
                          style={{ borderLeftColor: occ.color }}
                          className="group rounded-md border border-[var(--border)] border-l-4 bg-[var(--surface-muted)]/60 p-1.5 text-xs"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-medium leading-tight truncate">
                              {occ.title}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteOccurrence(
                                  occ,
                                  occ.isRecurring ? "single" : "series"
                                )
                              }
                              className="opacity-0 group-hover:opacity-100 text-red-500"
                              title={tr("Delete", "Excluir")}
                            >
                              ×
                            </button>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                            <Clock className="h-2.5 w-2.5" />
                            {occ.isAllDay
                              ? tr("All day", "Dia inteiro")
                              : new Date(occ.startsAt).toLocaleTimeString(locale, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                            {occ.hasConflict && (
                              <AlertTriangle
                                className="h-2.5 w-2.5 text-amber-500"
                                aria-label={tr("Time conflict", "Conflito de horário")}
                              />
                            )}
                          </div>
                          {occ.linkedTask && (
                            <Link
                              href={`/tasks?taskId=${occ.linkedTask.id}`}
                              className="mt-0.5 block truncate text-[10px] text-[var(--accent)] hover:underline"
                            >
                              {tr("Task", "Tarefa")}: {occ.linkedTask.title}
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Time-Blocking Task Drawer */}
        <aside className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4 text-[var(--accent)]" />
                {tr("Drag Tasks to Schedule", "Arraste Tarefas para Agendar")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[540px] overflow-y-auto">
              {openTasks.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)]">
                  {tr("No open tasks to schedule.", "Nenhuma tarefa aberta para agendar.")}
                </p>
              ) : (
                openTasks.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/task-id", t.id)}
                    className="cursor-grab rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-2 text-xs hover:border-[var(--accent)]"
                  >
                    <div className="font-medium truncate">{t.title}</div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--muted-foreground)]">
                      <span>{priorityLabel(t.priority)}</span>
                      <button
                        type="button"
                        onClick={() => handleScheduleTaskOnDate(t.id, anchorDate)}
                        className="text-[var(--accent)] hover:underline"
                      >
                        {tr("+ Block 1h", "+ Bloquear 1h")}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Create Event Modal */}
      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowNewModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold">
              {tr("New Calendar Event", "Novo Evento no Calendário")}
            </h2>
            <form onSubmit={handleCreateEvent} className="mt-4 space-y-3">
              <Input
                required
                placeholder={tr("Event title...", "Título do evento...")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  required
                />
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5">
                  <input
                    type="checkbox"
                    id="all-day"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                  />
                  <label htmlFor="all-day" className="text-xs">
                    {tr("All day", "Dia inteiro")}
                  </label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    aria-label={tr("Event color", "Cor do evento")}
                    className="ml-auto h-7 w-10 rounded border border-[var(--border)]"
                  />
                </div>
              </div>

              {!isAllDay && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-[var(--muted-foreground)]">
                      {tr("Start", "Início")}
                    </label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-[var(--muted-foreground)]">
                      {tr("End", "Fim")}
                    </label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select
                  value={recurrence}
                  onChange={(e) =>
                    setRecurrence(e.target.value as "" | "daily" | "weekly" | "monthly")
                  }
                  className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
                >
                  <option value="">{tr("Does not repeat", "Não se repete")}</option>
                  <option value="daily">{tr("Daily", "Diariamente")}</option>
                  <option value="weekly">{tr("Weekly", "Semanalmente")}</option>
                  <option value="monthly">{tr("Monthly", "Mensalmente")}</option>
                </select>

                <select
                  value={linkedTaskId}
                  onChange={(e) => setLinkedTaskId(e.target.value)}
                  className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
                >
                  <option value="">{tr("Link task (optional)", "Vincular tarefa (opcional)")}</option>
                  {openTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowNewModal(false)}>
                  {tr("Cancel", "Cancelar")}
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? tr("Saving...", "Salvando...") : tr("Save Event", "Salvar Evento")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
