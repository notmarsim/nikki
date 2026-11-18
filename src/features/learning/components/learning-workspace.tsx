"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileText,
  GraduationCap,
  Layers,
  Plus,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    initialOverview.courses[0]?.id ?? null
  );
  const [tab, setTab] = useState<"curriculum" | "notes" | "flashcards" | "sessions">(
    "curriculum"
  );

  // Forms
  const [newPathTitle, setNewPathTitle] = useState("");
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCoursePathId, setNewCoursePathId] = useState("");
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newLessonTitleByMod, setNewLessonTitleByMod] = useState<Record<string, string>>({});
  const [newNoteTitle, setNewNoteTitle] = useState("");

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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Learning Hub</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Organize Learning Paths, Courses, Modules, and Lessons with linked Notes, Flashcards, and Focus sessions.
        </p>
      </div>

      {/* Quick Create Bar */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">New Learning Path</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex gap-2"
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
                placeholder="e.g. Offensive Security, Music Theory..."
                value={newPathTitle}
                onChange={(e) => setNewPathTitle(e.target.value)}
              />
              <Button type="submit" size="sm">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">New Course</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-wrap gap-2"
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
                className="flex-1 min-w-[160px]"
                placeholder="Course title..."
                value={newCourseTitle}
                onChange={(e) => setNewCourseTitle(e.target.value)}
              />
              <select
                value={newCoursePathId}
                onChange={(e) => setNewCoursePathId(e.target.value)}
                className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
              >
                <option value="">No path</option>
                {overview.paths.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm">
                <Plus className="h-4 w-4" /> Add
              </Button>
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
                Learning Paths
              </div>
              {overview.paths.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{p.title}</span>
                    <Badge variant="outline">{p.progress}%</Badge>
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {p.courses.length} courses
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Courses
            </div>
            {overview.courses.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                  No courses yet. Create one above!
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
                      {c.completedLessons}/{c.totalLessons} lessons
                    </span>
                    <span>{c.studyMinutes}m studied</span>
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
                Select a course to manage modules, lessons, and study materials.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="border-b border-[var(--border)] pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{courseDetail.course.title}</CardTitle>
                    <div className="mt-1 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                      <span>
                        {courseDetail.course.completedLessons}/{courseDetail.course.totalLessons}{" "}
                        lessons ({courseDetail.course.progress}%)
                      </span>
                      <span>· {courseDetail.course.studyMinutes} min studied</span>
                    </div>
                  </div>
                  <Link href={`/focus?courseId=${courseDetail.course.id}`}>
                    <Button size="sm">
                      <Timer className="h-3.5 w-3.5" /> Start Study Focus
                    </Button>
                  </Link>
                </div>

                <div className="mt-4 flex flex-wrap gap-1">
                  {(
                    [
                      { id: "curriculum", label: "Curriculum" },
                      { id: "notes", label: `Notes (${courseDetail.linkedNotes.length})` },
                      { id: "flashcards", label: `Flashcards (${courseDetail.decks.length})` },
                      { id: "sessions", label: `Sessions (${courseDetail.sessions.length})` },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
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

              <CardContent className="p-5 space-y-4">
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
                        placeholder="Add module..."
                        value={newModuleTitle}
                        onChange={(e) => setNewModuleTitle(e.target.value)}
                      />
                      <Button type="submit" size="sm">
                        <Plus className="h-4 w-4" /> Module
                      </Button>
                    </form>

                    {courseDetail.modules.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                        No modules yet. Add your first module above!
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {courseDetail.modules.map((mod) => (
                          <div
                            key={mod.id}
                            className="rounded-xl border border-[var(--border)] p-3.5 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 font-semibold text-sm">
                                <BookOpen className="h-4 w-4 text-[var(--accent)]" />
                                {mod.title}
                              </div>
                              <Badge variant="outline">
                                {mod.completedLessons}/{mod.totalLessons} ({mod.progress}%)
                              </Badge>
                            </div>

                            <div className="space-y-1.5">
                              {mod.lessons.map((lesson) => (
                                <div
                                  key={lesson.id}
                                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
                                >
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
                                placeholder="Add lesson..."
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
                                Add
                              </Button>
                            </form>
                          </div>
                        ))}
                      </div>
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
                        }
                      }}
                    >
                      <Input
                        placeholder="Create study note for this course..."
                        value={newNoteTitle}
                        onChange={(e) => setNewNoteTitle(e.target.value)}
                      />
                      <Button type="submit" size="sm">
                        <Plus className="h-4 w-4" /> Note
                      </Button>
                    </form>

                    {courseDetail.linkedNotes.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                        No notes linked to this course yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {courseDetail.linkedNotes.map((n) => (
                          <Link
                            key={n.id}
                            href={`/notes?id=${n.id}`}
                            className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-muted)]"
                          >
                            <span className="flex items-center gap-2 font-medium">
                              <FileText className="h-4 w-4" />
                              {n.title}
                            </span>
                            <span className="text-xs text-[var(--muted-foreground)]">
                              Open →
                            </span>
                          </Link>
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
                          <Layers className="h-3.5 w-3.5" /> Open Flashcards
                        </Button>
                      </Link>
                    </div>
                    {courseDetail.decks.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                        No flashcard decks linked to this course yet.
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

                {tab === "sessions" && (
                  <div className="space-y-2">
                    {courseDetail.sessions.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                        No focus sessions recorded for this course yet.
                      </p>
                    ) : (
                      courseDetail.sessions.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
                        >
                          <span>{new Date(s.startedAt).toLocaleString()}</span>
                          <Badge variant="outline">
                            {Math.round(s.actualDurationSeconds / 60)} min · {s.status}
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
    </div>
  );
}
