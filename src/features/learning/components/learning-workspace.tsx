"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Edit3,
  ExternalLink,
  FileText,
  GraduationCap,
  Layers,
  Play,
  Plus,
  Sparkles,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CreateCourseFromNotesWizard } from "./create-course-from-notes-wizard";
import { InlineNoteEditorDrawer } from "./inline-note-editor-drawer";
import { LessonDetailPanel } from "./lesson-detail-panel";
import { QuizzesPanel } from "./quizzes-panel";
import { ReviewQueuePanel } from "./review-queue-panel";
import { StudyModeOverlay } from "./study-mode-overlay";

interface CourseSummary {
  id: string;
  title: string;
  description: string | null;
  platform: string | null;
  status: string;
  progress: number;
  modulesCount: number;
  totalLessons: number;
  completedLessons: number;
  studyMinutes: number;
}

interface PathSummary {
  id: string;
  title: string;
  color: string;
  goal: string | null;
  courses: CourseSummary[];
  progress: number;
}

interface CourseDetailPayload {
  course: CourseSummary & { url: string | null };
  modules: Array<{
    id: string;
    title: string;
    progress: number;
    completedLessons: number;
    totalLessons: number;
    lessons: Array<{
      id: string;
      title: string;
      status: string;
      estimatedMinutes: number | null;
      externalUrl: string | null;
    }>;
  }>;
  linkedNotes: Array<{ id: string; title: string; updatedAt: string }>;
  linkedTasks: Array<{ id: string; title: string; status: string }>;
  decks: Array<{ id: string; title: string }>;
  sessions: Array<{
    id: string;
    startedAt: string;
    actualDurationSeconds: number;
    status: string;
  }>;
}

export function LearningWorkspace({
  initialOverview,
}: {
  initialOverview: { paths: PathSummary[]; courses: CourseSummary[] };
}) {
  const { tr, language } = useI18n();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    initialOverview.courses[0]?.id ?? null
  );
  const [tab, setTab] = useState<"curriculum" | "notes" | "flashcards" | "quizzes" | "sessions">(
    "curriculum"
  );
  const [topView, setTopView] = useState<"courses" | "reviews" | "quizzes">("courses");
  const [showCourseWizard, setShowCourseWizard] = useState(false);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [studyModeOpen, setStudyModeOpen] = useState(false);

  // Forms
  const [newPathTitle, setNewPathTitle] = useState("");
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCoursePathId, setNewCoursePathId] = useState("");
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newLessonTitleByMod, setNewLessonTitleByMod] = useState<Record<string, string>>({});
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [renamingTarget, setRenamingTarget] = useState<{
    kind: "path" | "course" | "lesson";
    id: string;
    title: string;
  } | null>(null);
  const [savingRename, setSavingRename] = useState(false);

  const handleSaveRename = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!renamingTarget) return;
    const trimmed = renamingTarget.title.trim();
    if (!trimmed) return;
    setSavingRename(true);
    try {
      const endpoint =
        renamingTarget.kind === "path"
          ? `/api/learning/paths/${renamingTarget.id}`
          : renamingTarget.kind === "course"
            ? `/api/learning/courses/${renamingTarget.id}`
            : `/api/learning/lessons/${renamingTarget.id}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (res.ok) {
        setRenamingTarget(null);
        await refresh();
      }
    } finally {
      setSavingRename(false);
    }
  };

  const { data: overview = initialOverview } = useQuery({
    queryKey: ["learning-overview"],
    queryFn: async () => {
      const res = await fetch("/api/learning/overview");
      if (!res.ok) throw new Error("Failed to load learning overview");
      const json = await res.json();
      return json.data as { paths: PathSummary[]; courses: CourseSummary[] };
    },
    initialData: initialOverview,
  });

  const { data: courseDetail } = useQuery<CourseDetailPayload>({
    queryKey: ["learning-course", selectedCourseId],
    queryFn: async () => {
      const res = await fetch(`/api/learning/courses/${selectedCourseId}`);
      if (!res.ok) throw new Error("Failed to load course");
      const json = await res.json();
      return json.data;
    },
    enabled: Boolean(selectedCourseId),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["learning-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["learning-course", selectedCourseId] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const handleDeletePath = async (id: string, title: string) => {
    if (
      !window.confirm(
        tr(
          `Delete learning path "${title}"? Courses inside it will be kept.`,
          `Excluir a trilha de aprendizado "${title}"? Os cursos dentro dela serão mantidos.`
        )
      )
    ) {
      return;
    }
    const res = await fetch(`/api/learning/paths/${id}`, { method: "DELETE" });
    if (res.ok) {
      await refresh();
    }
  };

  const handleDeleteCourse = async (id: string, title: string) => {
    if (
      !window.confirm(
        tr(
          `Delete course "${title}" and all its modules and lessons?`,
          `Excluir o curso "${title}" e todos os seus módulos e aulas?`
        )
      )
    ) {
      return;
    }
    const res = await fetch(`/api/learning/courses/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedCourseId === id) {
        setSelectedCourseId(null);
      }
      await refresh();
    }
  };

  const sessionStatusLabel = (status: string) => {
    if (status === "completed") return tr("completed", "concluída");
    if (status === "running") return tr("running", "em andamento");
    if (status === "paused") return tr("paused", "pausada");
    if (status === "discarded") return tr("discarded", "descartada");
    return status;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {tr("Learning Hub", "Central de Aprendizado")}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
            {tr(
              "Organize Learning Paths, Courses, Modules, and Lessons with linked Notes, Flashcards, and Focus sessions.",
              "Organize Trilhas de Aprendizado, Cursos, Módulos e Aulas com Notas, Flashcards e sessões de Foco vinculados."
            )}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            size="sm"
            variant="outline"
            data-tour="learning-course-from-notes"
            onClick={() => setShowCourseWizard(true)}
            className="w-full sm:w-auto justify-center"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {tr("Create Course from Notes", "Criar Curso de Notas")}
          </Button>
          <div className="flex w-full sm:w-auto rounded-lg border border-[var(--border)] p-0.5 text-xs">
            {(
              [
                ["courses", tr("Courses", "Cursos")],
                ["reviews", tr("Review Queue", "Fila de Revisão")],
                ["quizzes", tr("Quizzes", "Quizzes")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTopView(id)}
                className={`flex-1 sm:flex-initial rounded-md px-2.5 py-1.5 sm:py-1 font-medium whitespace-nowrap text-center ${
                  topView === id
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Knowledge Overview Strip */}
      {"knowledgeOverview" in overview && Boolean((overview as { knowledgeOverview?: unknown }).knowledgeOverview) && (
        (() => {
          const ko = (overview as {
            knowledgeOverview: {
              linkedNotesCount: number;
              flashcardsCount: number;
              pendingReviewsCount: number;
              totalStudyMinutes: number;
            };
          }).knowledgeOverview;
          return (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="text-xs text-[var(--muted-foreground)]">{tr("Linked Notes", "Notas Vinculadas")}</div>
                <div className="mt-1 text-lg font-bold">{ko.linkedNotesCount}</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="text-xs text-[var(--muted-foreground)]">{tr("Courses", "Cursos")}</div>
                <div className="mt-1 text-lg font-bold">{overview.courses.length}</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="text-xs text-[var(--muted-foreground)]">{tr("Pending Reviews", "Revisões Pendentes")}</div>
                <div className="mt-1 text-lg font-bold text-amber-500">{ko.pendingReviewsCount}</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="text-xs text-[var(--muted-foreground)]">{tr("Study Time", "Tempo de Estudo")}</div>
                <div className="mt-1 text-lg font-bold">{ko.totalStudyMinutes}m</div>
              </div>
            </div>
          );
        })()
      )}

      {topView === "reviews" && <ReviewQueuePanel />}
      {topView === "quizzes" && <QuizzesPanel />}
      {topView === "courses" && (
      <>

      {/* Quick Create Bar */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {tr("New Learning Path", "Nova Trilha de Aprendizado")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col sm:flex-row gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newPathTitle.trim()) return;
                const res = await fetch("/api/learning/paths", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title: newPathTitle.trim() }),
                });
                if (res.ok) {
                  setNewPathTitle("");
                  await refresh();
                }
              }}
            >
              <Input
                placeholder={tr(
                  "e.g. Offensive Security, Music Theory...",
                  "ex.: Segurança Ofensiva, Teoria Musical..."
                )}
                value={newPathTitle}
                onChange={(e) => setNewPathTitle(e.target.value)}
              />
              <Button type="submit" size="sm" className="w-full sm:w-auto shrink-0">
                <Plus className="h-4 w-4" /> {tr("Add", "Adicionar")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{tr("New Course", "Novo Curso")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col sm:flex-row sm:flex-wrap gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newCourseTitle.trim()) return;
                const res = await fetch("/api/learning/courses", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    title: newCourseTitle.trim(),
                    pathId: newCoursePathId || null,
                  }),
                });
                if (res.ok) {
                  const json = await res.json();
                  setNewCourseTitle("");
                  setSelectedCourseId(json.data.course.id);
                  await refresh();
                }
              }}
            >
              <Input
                className="flex-1 min-w-0 sm:min-w-[160px]"
                placeholder={tr("Course title...", "Título do curso...")}
                value={newCourseTitle}
                onChange={(e) => setNewCourseTitle(e.target.value)}
              />
              <div className="flex gap-2">
                <select
                  value={newCoursePathId}
                  onChange={(e) => setNewCoursePathId(e.target.value)}
                  className="h-9 flex-1 sm:flex-initial rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
                >
                  <option value="">{tr("No path", "Sem trilha")}</option>
                  {overview.paths.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" className="shrink-0">
                  <Plus className="h-4 w-4" /> {tr("Add", "Adicionar")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Main Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left List: Paths & Courses */}
        <div className="space-y-4 lg:col-span-4">
          {overview.paths.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {tr("Learning Paths", "Trilhas de Aprendizado")}
              </div>
              {overview.paths.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    {renamingTarget?.kind === "path" && renamingTarget.id === p.id ? (
                      <form onSubmit={handleSaveRename} className="flex flex-1 items-center gap-1.5">
                        <Input
                          value={renamingTarget.title}
                          onChange={(e) =>
                            setRenamingTarget({ ...renamingTarget, title: e.target.value })
                          }
                          className="h-7 text-xs"
                          autoFocus
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          disabled={savingRename}
                          className="h-7 px-2"
                          title={tr("Save", "Salvar")}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setRenamingTarget(null)}
                          className="h-7 px-2"
                          title={tr("Cancel", "Cancelar")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    ) : (
                      <>
                        <span className="font-semibold truncate">{p.title}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="outline">{p.progress}%</Badge>
                          <button
                            type="button"
                            onClick={() =>
                              setRenamingTarget({ kind: "path", id: p.id, title: p.title })
                            }
                            title={tr("Rename learning path", "Renomear trilha de aprendizado")}
                            aria-label={tr(
                              `Rename learning path ${p.title}`,
                              `Renomear trilha de aprendizado ${p.title}`
                            )}
                            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePath(p.id, p.title)}
                            title={tr("Delete learning path", "Excluir trilha de aprendizado")}
                            aria-label={tr(
                              `Delete learning path ${p.title}`,
                              `Excluir trilha de aprendizado ${p.title}`
                            )}
                            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {p.courses.length} {tr("courses", "cursos")}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              {tr("Courses", "Cursos")}
            </div>
            {overview.courses.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                  {tr("No courses yet. Create one above!", "Nenhum curso ainda. Crie um acima!")}
                </CardContent>
              </Card>
            ) : (
              overview.courses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCourseId(c.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    selectedCourseId === c.id
                      ? "border-[var(--accent)] bg-[var(--surface)]"
                      : "border-[var(--border)] bg-[var(--surface)]/60 hover:bg-[var(--surface)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{c.title}</span>
                    <span className="text-xs font-semibold">{c.progress}%</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all"
                      style={{ width: `${c.progress}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
                    <span>
                      {c.completedLessons}/{c.totalLessons} {tr("lessons", "aulas")}
                    </span>
                    <span>
                      {c.studyMinutes}m {tr("studied", "estudados")}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Course Detail */}
        <div className="lg:col-span-8">
          {!selectedCourseId || !courseDetail ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center text-sm text-[var(--muted-foreground)]">
                <GraduationCap className="mb-2 h-8 w-8 opacity-60" />
                {tr(
                  "Select a course to manage modules, lessons, and study materials.",
                  "Selecione um curso para gerenciar módulos, aulas e materiais de estudo."
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="border-b border-[var(--border)] pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {renamingTarget?.kind === "course" &&
                    renamingTarget.id === courseDetail.course.id ? (
                      <form onSubmit={handleSaveRename} className="flex items-center gap-1.5 max-w-md">
                        <Input
                          value={renamingTarget.title}
                          onChange={(e) =>
                            setRenamingTarget({ ...renamingTarget, title: e.target.value })
                          }
                          className="h-8 text-base font-semibold"
                          autoFocus
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          disabled={savingRename}
                          title={tr("Save", "Salvar")}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setRenamingTarget(null)}
                          title={tr("Cancel", "Cancelar")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl truncate">
                          {courseDetail.course.title}
                        </CardTitle>
                        <button
                          type="button"
                          onClick={() =>
                            setRenamingTarget({
                              kind: "course",
                              id: courseDetail.course.id,
                              title: courseDetail.course.title,
                            })
                          }
                          title={tr("Rename course", "Renomear curso")}
                          aria-label={tr(
                            `Rename course ${courseDetail.course.title}`,
                            `Renomear curso ${courseDetail.course.title}`
                          )}
                          className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="mt-1 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                      <span>
                        {courseDetail.course.completedLessons}/{courseDetail.course.totalLessons}{" "}
                        {tr("lessons", "aulas")} ({courseDetail.course.progress}%)
                      </span>
                      <span>
                        · {courseDetail.course.studyMinutes} {tr("min studied", "min estudados")}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      data-tour="learning-study-mode"
                      onClick={() => setStudyModeOpen(true)}
                    >
                      <Play className="h-3.5 w-3.5" /> {tr("Study Mode", "Modo Estudo")}
                    </Button>
                    <Link href={`/focus?courseId=${courseDetail.course.id}`}>
                      <Button size="sm" variant="outline">
                        <Timer className="h-3.5 w-3.5" />{" "}
                        {tr("Focus Timer", "Timer de Foco")}
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleDeleteCourse(courseDetail.course.id, courseDetail.course.title)
                      }
                      title={tr("Delete course", "Excluir curso")}
                      aria-label={tr(
                        `Delete course ${courseDetail.course.title}`,
                        `Excluir curso ${courseDetail.course.title}`
                      )}
                      className="text-red-500 hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
                  {(
                    [
                      { id: "curriculum", label: tr("Curriculum", "Currículo") },
                      {
                        id: "notes",
                        label: `${tr("Notes", "Notas")} (${courseDetail.linkedNotes.length})`,
                      },
                      {
                        id: "flashcards",
                        label: `${tr("Flashcards", "Flashcards")} (${courseDetail.decks.length})`,
                      },
                      {
                        id: "quizzes",
                        label: tr("Quizzes", "Quizzes"),
                      },
                      {
                        id: "sessions",
                        label: `${tr("Sessions", "Sessões")} (${courseDetail.sessions.length})`,
                      },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                        tab === t.id
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "bg-[var(--surface-muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="p-3.5 sm:p-5 space-y-4">
                {tab === "curriculum" && (
                  <>
                    <form
                      className="flex gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!newModuleTitle.trim()) return;
                        const res = await fetch("/api/learning/modules", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            courseId: courseDetail.course.id,
                            title: newModuleTitle.trim(),
                          }),
                        });
                        if (res.ok) {
                          setNewModuleTitle("");
                          await refresh();
                        }
                      }}
                    >
                      <Input
                        placeholder={tr("Add module...", "Adicionar módulo...")}
                        value={newModuleTitle}
                        onChange={(e) => setNewModuleTitle(e.target.value)}
                      />
                      <Button type="submit" size="sm">
                        <Plus className="h-4 w-4" /> {tr("Module", "Módulo")}
                      </Button>
                    </form>

                    {courseDetail.modules.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                        {tr(
                          "No modules yet. Add your first module above!",
                          "Nenhum módulo ainda. Adicione seu primeiro módulo acima!"
                        )}
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {courseDetail.modules.map((mod) => (
                          <div
                            key={mod.id}
                            className="rounded-xl border border-[var(--border)] p-3.5 space-y-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 font-semibold text-sm min-w-0">
                                <BookOpen className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                                <span className="truncate">{mod.title}</span>
                              </div>
                              <Badge variant="outline" className="shrink-0">
                                {mod.completedLessons}/{mod.totalLessons} ({mod.progress}%)
                              </Badge>
                            </div>

                            <div className="space-y-1.5">
                              {mod.lessons.map((lesson) => (
                                <div
                                  key={lesson.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
                                >
                                  {renamingTarget?.kind === "lesson" &&
                                  renamingTarget.id === lesson.id ? (
                                    <form
                                      onSubmit={handleSaveRename}
                                      className="flex flex-1 items-center gap-1.5"
                                    >
                                      <Input
                                        value={renamingTarget.title}
                                        onChange={(e) =>
                                          setRenamingTarget({
                                            ...renamingTarget,
                                            title: e.target.value,
                                          })
                                        }
                                        className="h-7 text-xs"
                                        autoFocus
                                      />
                                      <Button
                                        type="submit"
                                        size="sm"
                                        variant="outline"
                                        disabled={savingRename}
                                        className="h-7 px-2"
                                        title={tr("Save", "Salvar")}
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setRenamingTarget(null)}
                                        className="h-7 px-2"
                                        title={tr("Cancel", "Cancelar")}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </form>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          await fetch(`/api/learning/lessons/${lesson.id}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                              status:
                                                lesson.status === "completed"
                                                  ? "not_started"
                                                  : "completed",
                                            }),
                                          });
                                          await refresh();
                                        }}
                                        className="flex items-center gap-2 text-left min-w-0 flex-1"
                                      >
                                        {lesson.status === "completed" ? (
                                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                                        ) : (
                                          <Circle className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                                        )}
                                        <span
                                          className={`truncate ${
                                            lesson.status === "completed"
                                              ? "line-through text-[var(--muted-foreground)]"
                                              : "font-medium"
                                          }`}
                                        >
                                          {lesson.title}
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setRenamingTarget({
                                            kind: "lesson",
                                            id: lesson.id,
                                            title: lesson.title,
                                          })
                                        }
                                        title={tr("Rename lesson", "Renomear aula")}
                                        aria-label={tr(
                                          `Rename lesson ${lesson.title}`,
                                          `Renomear aula ${lesson.title}`
                                        )}
                                        className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                                      >
                                        <Edit3 className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveLessonId(
                                        activeLessonId === lesson.id ? null : lesson.id
                                      )
                                    }
                                    className="rounded border border-[var(--border)] px-2 py-0.5 text-[11px] hover:bg-[var(--surface-muted)]"
                                  >
                                    {activeLessonId === lesson.id
                                      ? tr("Close", "Fechar")
                                      : tr("Open", "Abrir")}
                                  </button>
                                  {lesson.externalUrl && (
                                    <a
                                      href={lesson.externalUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[var(--accent)]"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>

                            <form
                              className="flex gap-2"
                              onSubmit={async (e) => {
                                e.preventDefault();
                                const title = (newLessonTitleByMod[mod.id] ?? "").trim();
                                if (!title) return;
                                const res = await fetch("/api/learning/lessons", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ moduleId: mod.id, title }),
                                });
                                if (res.ok) {
                                  setNewLessonTitleByMod((p) => ({ ...p, [mod.id]: "" }));
                                  await refresh();
                                }
                              }}
                            >
                              <Input
                                placeholder={tr("Add lesson...", "Adicionar aula...")}
                                className="h-8 text-xs"
                                value={newLessonTitleByMod[mod.id] ?? ""}
                                onChange={(e) =>
                                  setNewLessonTitleByMod((p) => ({
                                    ...p,
                                    [mod.id]: e.target.value,
                                  }))
                                }
                              />
                              <Button type="submit" size="sm" variant="outline">
                                {tr("Add", "Adicionar")}
                              </Button>
                            </form>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeLessonId && (
                      <LessonDetailPanel
                        lessonId={activeLessonId}
                        courseId={courseDetail.course.id}
                        onClose={() => setActiveLessonId(null)}
                        onOpenNote={(nid) => setEditingNoteId(nid)}
                        onStartStudyMode={() => setStudyModeOpen(true)}
                        onChanged={() => void refresh()}
                      />
                    )}
                  </>
                )}

                {tab === "notes" && (
                  <div className="space-y-4">
                    <form
                      className="flex gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!newNoteTitle.trim()) return;
                        const noteRes = await fetch("/api/notes", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ title: newNoteTitle.trim() }),
                        });
                        if (noteRes.ok) {
                          const json = await noteRes.json();
                          await fetch("/api/learning/links", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              courseId: courseDetail.course.id,
                              noteId: json.data.note.id,
                            }),
                          });
                          setNewNoteTitle("");
                          await refresh();
                          setEditingNoteId(json.data.note.id);
                        }
                      }}
                    >
                      <Input
                        placeholder={tr(
                          "Create study note for this course...",
                          "Criar nota de estudo para este curso..."
                        )}
                        value={newNoteTitle}
                        onChange={(e) => setNewNoteTitle(e.target.value)}
                      />
                      <Button type="submit" size="sm">
                        <Plus className="h-4 w-4" /> {tr("Note", "Nota")}
                      </Button>
                    </form>

                    {courseDetail.linkedNotes.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                        {tr(
                          "No notes linked to this course yet.",
                          "Nenhuma nota vinculada a este curso ainda."
                        )}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {courseDetail.linkedNotes.map((n) => (
                          <div
                            key={n.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-muted)]"
                          >
                            <button
                              type="button"
                              onClick={() => setEditingNoteId(n.id)}
                              className="flex flex-1 items-center gap-2 text-left font-medium"
                            >
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="truncate">{n.title}</span>
                            </button>
                            <div className="flex items-center gap-2 text-xs">
                              <button
                                type="button"
                                onClick={() => setEditingNoteId(n.id)}
                                className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
                              >
                                <Edit3 className="h-3 w-3" /> {tr("Edit", "Editar")}
                              </button>
                              <Link
                                href={`/notes?id=${n.id}`}
                                className="text-[var(--muted-foreground)] hover:underline"
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

                {tab === "flashcards" && (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <Link href="/flashcards">
                        <Button size="sm" variant="outline">
                          <Layers className="h-3.5 w-3.5" />{" "}
                          {tr("Open Flashcards", "Abrir Flashcards")}
                        </Button>
                      </Link>
                    </div>
                    {courseDetail.decks.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                        {tr(
                          "No flashcard decks linked to this course yet.",
                          "Nenhum baralho de flashcards vinculado a este curso ainda."
                        )}
                      </p>
                    ) : (
                      courseDetail.decks.map((d) => (
                        <Link
                          key={d.id}
                          href={`/flashcards?deckId=${d.id}`}
                          className="block rounded-lg border border-[var(--border)] p-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
                        >
                          {d.title}
                        </Link>
                      ))
                    )}
                  </div>
                )}

                {tab === "quizzes" && <QuizzesPanel courseId={courseDetail.course.id} />}

                {tab === "sessions" && (
                  <div className="space-y-2">
                    {courseDetail.sessions.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                        {tr(
                          "No focus sessions recorded for this course yet.",
                          "Nenhuma sessão de foco registrada para este curso ainda."
                        )}
                      </p>
                    ) : (
                      courseDetail.sessions.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
                        >
                          <span>{new Date(s.startedAt).toLocaleString(locale)}</span>
                          <Badge variant="outline">
                            {Math.round(s.actualDurationSeconds / 60)} min ·{" "}
                            {sessionStatusLabel(s.status)}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      </>
      )}

      {showCourseWizard && (
        <CreateCourseFromNotesWizard
          onClose={() => setShowCourseWizard(false)}
          onCreated={(cid) => {
            setSelectedCourseId(cid);
            setTopView("courses");
            void refresh();
          }}
        />
      )}

      {editingNoteId && (
        <InlineNoteEditorDrawer
          noteId={editingNoteId}
          onClose={() => setEditingNoteId(null)}
          onUpdated={() => void refresh()}
        />
      )}

      {studyModeOpen && courseDetail && (
        <StudyModeOverlay
          courseId={courseDetail.course.id}
          courseTitle={courseDetail.course.title}
          lessons={courseDetail.modules.flatMap((m) => m.lessons)}
          initialLessonId={activeLessonId ?? undefined}
          onClose={() => {
            setStudyModeOpen(false);
            void refresh();
          }}
          onLessonStatusChange={async (lid, status) => {
            await fetch(`/api/learning/lessons/${lid}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status }),
            });
            await refresh();
          }}
        />
      )}
    </div>
  );
}
