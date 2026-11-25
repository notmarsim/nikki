"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Flag,
  Pause,
  Play,
  Timer,
  X,
} from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface StudyLesson {
  id: string;
  moduleId?: string;
  title: string;
  status: string;
}

export function StudyModeOverlay({
  courseId,
  courseTitle,
  lessons,
  initialLessonId,
  onClose,
  onLessonStatusChange,
}: {
  courseId: string;
  courseTitle: string;
  lessons: StudyLesson[];
  initialLessonId?: string;
  onClose: () => void;
  onLessonStatusChange: (lessonId: string, status: "not_started" | "in_progress" | "completed") => Promise<void>;
}) {
  const { tr } = useI18n();
  const [idx, setIdx] = useState(() => {
    const found = initialLessonId ? lessons.findIndex((l) => l.id === initialLessonId) : 0;
    return found >= 0 ? found : 0;
  });
  const [running, setRunning] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [activeRecallHide, setActiveRecallHide] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [flagged, setFlagged] = useState(false);
  const [studyNotes, setStudyNotes] = useState("");
  const [completedCount, setCompletedCount] = useState(0);
  const [summary, setSummary] = useState<{ durationSeconds: number; lessonsCompleted: number } | null>(null);
  const [lessonContents, setLessonContents] = useState<
    Array<{ id: string; title: string; contentType: string; body: string | null; noteId: string | null }>
  >([]);

  const currentLesson = lessons[idx] ?? null;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!currentLesson) return;
    void (async () => {
      const res = await fetch(`/api/learning/contents?lessonId=${currentLesson.id}`);
      if (res.ok) {
        const json = await res.json();
        setLessonContents(json.data?.contents ?? []);
      }
    })();
  }, [currentLesson]);

  const fmtTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  const handleFinish = async () => {
    setRunning(false);
    await fetch("/api/learning/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
        lessonId: currentLesson?.id ?? null,
        durationSeconds: seconds,
        lessonsCompleted: completedCount,
        difficultyRating: difficulty,
        flaggedForReview: flagged,
        notesText: studyNotes.trim() || null,
      }),
    });
    if (flagged && currentLesson) {
      await fetch("/api/learning/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule",
          entityType: "lesson",
          entityId: currentLesson.id,
          title: currentLesson.title,
        }),
      });
    }
    setSummary({ durationSeconds: seconds, lessonsCompleted: completedCount });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)]">
      {/* Top Focus Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div>
          <div className="text-xs text-[var(--muted-foreground)]">{courseTitle}</div>
          <h2 className="text-base font-semibold">
            {currentLesson ? currentLesson.title : tr("Study Mode", "Modo Estudo")}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-mono">
            <Timer className="h-3.5 w-3.5 text-[var(--accent)]" />
            {fmtTimer(seconds)}
          </div>
          <Button size="sm" variant="outline" onClick={() => setRunning((r) => !r)}>
            {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {running ? tr("Pause", "Pausar") : tr("Resume", "Retomar")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveRecallHide((v) => !v)}
          >
            {activeRecallHide ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {activeRecallHide ? tr("Show Content", "Mostrar Conteúdo") : tr("Active Recall", "Active Recall")}
          </Button>
          {!summary && (
            <Button size="sm" onClick={handleFinish}>
              {tr("Finish Session", "Finalizar Sessão")}
            </Button>
          )}
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[var(--surface-muted)]">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        {summary ? (
          <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h3 className="text-lg font-semibold">{tr("Study Session Completed!", "Sessão de Estudo Concluída!")}</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-[var(--muted-foreground)]">{tr("Time Studied", "Tempo Estudado")}</div>
                <div className="mt-1 text-lg font-bold">{fmtTimer(summary.durationSeconds)}</div>
              </div>
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-[var(--muted-foreground)]">{tr("Lessons Completed", "Aulas Concluídas")}</div>
                <div className="mt-1 text-lg font-bold">{summary.lessonsCompleted}</div>
              </div>
            </div>
            <Button onClick={onClose}>{tr("Back to Learning", "Voltar ao Learning")}</Button>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Lesson Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={idx <= 0}
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> {tr("Previous", "Anterior")}
              </Button>
              {currentLesson && (
                <Button
                  size="sm"
                  variant={currentLesson.status === "completed" ? "outline" : "default"}
                  onClick={async () => {
                    const next = currentLesson.status === "completed" ? "in_progress" : "completed";
                    await onLessonStatusChange(currentLesson.id, next);
                    if (next === "completed") setCompletedCount((c) => c + 1);
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {currentLesson.status === "completed"
                    ? tr("Completed", "Concluída")
                    : tr("Mark Lesson Completed", "Concluir Aula")}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={idx >= lessons.length - 1}
                onClick={() => setIdx((i) => Math.min(lessons.length - 1, i + 1))}
              >
                {tr("Next", "Próxima")} <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Lesson Contents (Hidden in Active Recall mode) */}
            {activeRecallHide ? (
              <div className="rounded-xl border border-dashed border-[var(--accent)] p-8 text-center text-sm text-[var(--muted-foreground)]">
                {tr(
                  "Active Recall Mode: try to recall the key concepts from memory before revealing the lesson content.",
                  "Modo Active Recall: tente lembrar dos conceitos principais antes de revelar o conteúdo."
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {lessonContents.length === 0 ? (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-xs text-[var(--muted-foreground)]">
                    {tr("No content blocks added to this lesson yet.", "Nenhum conteúdo adicionado a esta aula ainda.")}
                  </div>
                ) : (
                  lessonContents.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{c.title}</span>
                        <Badge variant="outline">{c.contentType}</Badge>
                      </div>
                      {c.body && <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--muted-foreground)]">{c.body}</p>}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Session Reflection & Notes */}
            <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{tr("Session Notes & Difficulty", "Anotações da Sessão & Dificuldade")}</span>
                <div className="flex items-center gap-2">
                  {(["easy", "medium", "hard"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={`rounded border px-2 py-1 capitalize ${
                        difficulty === d ? "border-[var(--accent)] bg-[var(--accent)]/15" : "border-[var(--border)]"
                      }`}
                    >
                      {d === "easy" ? tr("Easy", "Fácil") : d === "medium" ? tr("Medium", "Médio") : tr("Hard", "Difícil")}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFlagged((f) => !f)}
                    className={`inline-flex items-center gap-1 rounded border px-2 py-1 ${
                      flagged ? "border-amber-500 bg-amber-500/15 text-amber-500" : "border-[var(--border)]"
                    }`}
                  >
                    <Flag className="h-3 w-3" /> {tr("Flag for Review", "Marcar para Revisão")}
                  </button>
                </div>
              </div>
              <textarea
                rows={3}
                value={studyNotes}
                onChange={(e) => setStudyNotes(e.target.value)}
                placeholder={tr("Write key takeaways, questions, or difficult points...", "Escreva pontos-chave, dúvidas ou dificuldades...")}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2.5 text-xs"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
