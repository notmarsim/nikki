"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Clock, Pause, Play, RotateCcw } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReviewItem {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  lastRating: string | null;
  paused: boolean;
  dueAt: string;
}

interface ReviewQueuePayload {
  overdue: ReviewItem[];
  dueToday: ReviewItem[];
  upcoming: ReviewItem[];
  difficult: ReviewItem[];
  paused: ReviewItem[];
  dueFlashcardsCount: number;
}

export function ReviewQueuePanel() {
  const { tr, language } = useI18n();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const [queue, setQueue] = useState<ReviewQueuePayload | null>(null);

  const load = async () => {
    const res = await fetch("/api/learning/reviews");
    if (res.ok) {
      const json = await res.json();
      setQueue(json.data);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const rate = async (reviewId: string, rating: "again" | "hard" | "good" | "easy") => {
    await fetch("/api/learning/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rate", reviewId, rating }),
    });
    await load();
  };

  const togglePause = async (reviewId: string, paused: boolean) => {
    await fetch("/api/learning/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pause", reviewId, paused }),
    });
    await load();
  };

  if (!queue) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-xs text-[var(--muted-foreground)]">
        {tr("Loading Review Queue...", "Carregando Fila de Revisão...")}
      </div>
    );
  }

  const dueItems = [...queue.overdue, ...queue.dueToday];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-[var(--muted-foreground)]">{tr("Overdue", "Atrasadas")}</div>
            <div className="text-xl font-bold text-red-500">{queue.overdue.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-[var(--muted-foreground)]">{tr("Due Today", "Para Hoje")}</div>
            <div className="text-xl font-bold">{queue.dueToday.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-[var(--muted-foreground)]">{tr("Difficult", "Difíceis")}</div>
            <div className="text-xl font-bold text-amber-500">{queue.difficult.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-[var(--muted-foreground)]">{tr("Due Flashcards", "Flashcards Pendentes")}</div>
            <div className="text-xl font-bold">
              <Link href="/flashcards" className="text-[var(--accent)] hover:underline">
                {queue.dueFlashcardsCount} →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RotateCcw className="h-4 w-4 text-[var(--accent)]" />
            {tr("Review Queue (Spaced Repetition)", "Fila de Revisão (Repetição Espaçada)")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dueItems.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--muted-foreground)]">
              {tr(
                "No reviews due right now. Schedule notes or flag lessons during Study Mode.",
                "Nenhuma revisão pendente agora. Agende notas ou marque aulas durante o Modo Estudo."
              )}
            </div>
          ) : (
            dueItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <span>{item.title}</span>
                    <Badge variant="outline">{item.entityType}</Badge>
                    {item.lapses > 0 && (
                      <Badge variant="warning" className="inline-flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {item.lapses} {tr("lapses", "lapsos")}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 text-[var(--muted-foreground)]">
                    {tr("Interval:", "Intervalo:")} {item.intervalDays}d · {tr("Reps:", "Reps:")} {item.repetitions}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void rate(item.id, "again")}
                    className="rounded border border-red-500/40 bg-red-500/10 px-2.5 py-1 font-medium text-red-500"
                  >
                    {tr("Again", "De novo")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void rate(item.id, "hard")}
                    className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-medium text-amber-500"
                  >
                    {tr("Hard", "Difícil")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void rate(item.id, "good")}
                    className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-500"
                  >
                    {tr("Good", "Bom")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void rate(item.id, "easy")}
                    className="rounded border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 font-medium text-blue-500"
                  >
                    {tr("Easy", "Fácil")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void togglePause(item.id, true)}
                    className="rounded border border-[var(--border)] p-1 text-[var(--muted-foreground)]"
                    title={tr("Pause review", "Pausar revisão")}
                  >
                    <Pause className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {queue.upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-[var(--muted-foreground)]" />
              {tr("Upcoming Reviews", "Próximas Revisões")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            {queue.upcoming.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded border border-[var(--border)] px-3 py-2"
              >
                <span>{u.title}</span>
                <span className="text-[var(--muted-foreground)]">
                  {new Date(u.dueAt).toLocaleDateString(locale)} ({u.intervalDays}d)
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {queue.paused.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{tr("Paused Reviews", "Revisões Pausadas")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            {queue.paused.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded border border-[var(--border)] px-3 py-2"
              >
                <span>{p.title}</span>
                <button
                  type="button"
                  onClick={() => void togglePause(p.id, false)}
                  className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1"
                >
                  <Play className="h-3 w-3" /> {tr("Resume", "Retomar")}
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
