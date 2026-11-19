"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Flame, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface HabitItem {
  id: string;
  title: string;
  color: string;
  habitType: string;
  frequency: string;
  targetValue: number;
  unit: string;
  todayValue: number;
  completedToday: boolean;
  currentStreak: number;
  bestStreak: number;
  consistencyRate: number;
  activityLink: { activityType: string } | null;
  heatmap: Array<{ date: string; value: number; ratio: number }>;
  manualTodayEntries: Array<{ id: string; value: number }>;
}

export function HabitsWorkspace({
  initialData,
}: {
  initialData: { habits: HabitItem[]; todayStr: string };
}) {
  const { tr } = useI18n();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [habitType, setHabitType] = useState<"boolean" | "quantitative">("boolean");
  const [frequency, setFrequency] = useState<"daily" | "weekly_count">("daily");
  const [targetValue, setTargetValue] = useState(1);
  const [unit, setUnit] = useState("minutes");
  const [activityType, setActivityType] = useState<
    "" | "focus_minutes" | "lessons_completed" | "flashcards_reviewed"
  >("");
  const [creating, setCreating] = useState(false);

  const { data = initialData } = useQuery<{ habits: HabitItem[]; todayStr: string }>({
    queryKey: ["habits"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/habits?today=${today}`);
      if (!res.ok) throw new Error("Failed to load habits");
      const json = await res.json();
      return json.data;
    },
    initialData,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["habits"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          habitType,
          frequency,
          scheduleConfig: frequency === "weekly_count" ? { targetPerPeriod: 3 } : {},
          targetValue: habitType === "boolean" ? 1 : targetValue,
          unit: habitType === "boolean" ? "times" : unit,
          activityLink: activityType ? { activityType } : null,
        }),
      });
      if (res.ok) {
        setTitle("");
        setActivityType("");
        await refresh();
      }
    } finally {
      setCreating(false);
    }
  };

  const activityLabel = (type: string) => {
    if (type === "focus_minutes") return tr("Focus minutes", "Minutos de foco");
    if (type === "lessons_completed") return tr("Lessons completed", "Aulas concluídas");
    if (type === "flashcards_reviewed") return tr("Flashcards reviewed", "Flashcards revisados");
    return type.replace("_", " ");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {tr("Habits & Consistency", "Hábitos e Consistência")}
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {tr(
            "Track daily and weekly habits with streaks, 90-day heatmaps, and Focus/Learning integration.",
            "Acompanhe hábitos diários e semanais com sequências, mapas de calor de 90 dias e integração com Foco e Aprendizado."
          )}
        </p>
      </div>

      {/* Create Habit */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{tr("New Habit", "Novo Hábito")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2">
            <Input
              className="flex-1 min-w-[180px]"
              placeholder={tr(
                "e.g. Study 60 minutes, Read 20 pages, Review flashcards...",
                "ex.: Estudar 60 minutos, Ler 20 páginas, Revisar flashcards..."
              )}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <select
              value={habitType}
              onChange={(e) =>
                setHabitType(e.target.value as "boolean" | "quantitative")
              }
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
            >
              <option value="boolean">{tr("Yes / No", "Sim / Não")}</option>
              <option value="quantitative">{tr("Quantitative", "Quantitativo")}</option>
            </select>
            {habitType === "quantitative" && (
              <>
                <Input
                  type="number"
                  min={1}
                  value={targetValue}
                  onChange={(e) => setTargetValue(Number(e.target.value) || 1)}
                  className="w-20 text-xs"
                />
                <Input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder={tr("unit", "unidade")}
                  className="w-24 text-xs"
                />
              </>
            )}
            <select
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as "daily" | "weekly_count")
              }
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
            >
              <option value="daily">{tr("Daily", "Diário")}</option>
              <option value="weekly_count">{tr("3x / Week", "3x / Semana")}</option>
            </select>
            <select
              value={activityType}
              onChange={(e) =>
                setActivityType(
                  e.target.value as
                    | ""
                    | "focus_minutes"
                    | "lessons_completed"
                    | "flashcards_reviewed"
                )
              }
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
            >
              <option value="">{tr("Manual tracking", "Rastreamento manual")}</option>
              <option value="focus_minutes">{tr("Auto: Focus minutes", "Auto: Minutos de foco")}</option>
              <option value="lessons_completed">{tr("Auto: Lessons completed", "Auto: Aulas concluídas")}</option>
              <option value="flashcards_reviewed">{tr("Auto: Flashcards reviewed", "Auto: Flashcards revisados")}</option>
            </select>
            <Button type="submit" disabled={creating || !title.trim()}>
              <Plus className="h-4 w-4" /> {tr("Add", "Adicionar")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Habits List + Heatmaps */}
      {data.habits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--muted-foreground)]">
            {tr(
              "No habits yet. Create your first habit above!",
              "Nenhum hábito ainda. Crie seu primeiro hábito acima!"
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.habits.map((habit) => (
            <Card key={habit.id}>
              <CardContent className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={Boolean(habit.activityLink)}
                      onClick={async () => {
                        if (habit.habitType === "boolean" && habit.completedToday) {
                          const entry = habit.manualTodayEntries[0];
                          if (entry) {
                            await fetch(`/api/habits/entries/${entry.id}`, {
                              method: "DELETE",
                            });
                          }
                        } else {
                          await fetch(`/api/habits/${habit.id}/entries`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              entryDate: data.todayStr,
                              value: habit.habitType === "boolean" ? 1 : Math.max(1, Math.round(habit.targetValue / 2)),
                            }),
                          });
                        }
                        await refresh();
                      }}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                        habit.completedToday
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-500"
                          : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)]"
                      }`}
                      title={
                        habit.activityLink
                          ? tr("Synced automatically from activity", "Sincronizado automaticamente da atividade")
                          : tr("Log progress for today", "Registrar progresso de hoje")
                      }
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>

                    <div>
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        <span>{habit.title}</span>
                        {habit.activityLink && (
                          <Badge variant="accent">
                            {tr("Auto", "Auto")}: {activityLabel(habit.activityLink.activityType)}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {tr("Today", "Hoje")}: {habit.todayValue} / {habit.targetValue} {habit.unit}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      <Flame className="h-3 w-3 text-amber-500" />
                      {habit.currentStreak} {tr("streak", "sequência")} ({tr("best", "melhor")} {habit.bestStreak})
                    </Badge>
                    <Badge variant="default">
                      {habit.consistencyRate}% {tr("consistency", "de consistência")}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={tr("Delete habit", "Excluir hábito")}
                      onClick={async () => {
                        await fetch(`/api/habits/${habit.id}`, { method: "DELETE" });
                        await refresh();
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>

                {/* 90-day GitHub-style Heatmap */}
                <div className="overflow-x-auto">
                  <div className="flex gap-1 min-w-max">
                    {habit.heatmap.map((cell) => {
                      const bg =
                        cell.ratio === 0
                          ? "bg-[var(--surface-muted)]"
                          : cell.ratio < 0.5
                            ? "bg-emerald-500/30"
                            : cell.ratio < 1
                              ? "bg-emerald-500/60"
                              : "bg-emerald-500";
                      return (
                        <div
                          key={cell.date}
                          title={`${cell.date}: ${cell.value}/${habit.targetValue} ${habit.unit}`}
                          className={`h-3 w-3 rounded-[2px] ${bg}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
