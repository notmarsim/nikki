"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, GraduationCap, X } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CourseItem {
  id: string;
  title: string;
}

interface ModuleItem {
  id: string;
  title: string;
  lessons: Array<{ id: string; title: string }>;
}

export function LinkToLearningModal({
  noteId,
  noteTitle,
  onClose,
  onLinked,
}: {
  noteId: string;
  noteTitle: string;
  onClose: () => void;
  onLinked: () => void;
}) {
  const { tr } = useI18n();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [courseSearch, setCourseSearch] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [purpose, setPurpose] = useState<
    "main_content" | "supplementary" | "reference" | "exercise" | "summary" | "personal_annotation"
  >("supplementary");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/learning/overview");
      if (res.ok) {
        const json = await res.json();
        const list: CourseItem[] = json.data?.courses ?? [];
        setCourses(list);
        if (list[0]) setSelectedCourseId(list[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedCourseId) {
      setModules([]);
      return;
    }
    void (async () => {
      const res = await fetch(`/api/learning/courses/${selectedCourseId}`);
      if (res.ok) {
        const json = await res.json();
        const mods: ModuleItem[] = json.data?.modules ?? [];
        setModules(mods);
        setSelectedModuleId(mods[0]?.id ?? "");
        setSelectedLessonId("");
      }
    })();
  }, [selectedCourseId]);

  const filteredCourses = courses.filter((c) =>
    c.title.toLowerCase().includes(courseSearch.trim().toLowerCase())
  );
  const currentModule = modules.find((m) => m.id === selectedModuleId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;
    setSaving(true);
    try {
      let lessonIdToLink = selectedLessonId || null;
      if (newLessonTitle.trim() && selectedModuleId) {
        const lRes = await fetch("/api/learning/lessons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moduleId: selectedModuleId,
            title: newLessonTitle.trim(),
          }),
        });
        if (lRes.ok) {
          const lJson = await lRes.json();
          lessonIdToLink = lJson.data?.lesson?.id ?? null;
        }
      }

      const res = await fetch("/api/learning/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteId,
          courseId: selectedCourseId,
          moduleId: selectedModuleId || null,
          lessonId: lessonIdToLink,
          purpose,
        }),
      });
      if (res.ok) {
        onLinked();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <BookOpen className="h-4 w-4 text-[var(--accent)]" />
            {tr("Link to Learning", "Vincular ao Learning")}
          </h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[var(--surface-muted)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          {tr("Linking note:", "Vinculando nota:")} <strong>{noteTitle}</strong>
        </p>

        <div>
          <label className="mb-1 block text-xs font-medium">{tr("Search course", "Pesquisar curso")}</label>
          <Input
            value={courseSearch}
            onChange={(e) => setCourseSearch(e.target.value)}
            placeholder={tr("Filter courses...", "Filtrar cursos...")}
            className="mb-2"
          />
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
            required
          >
            <option value="">{tr("Select a course...", "Selecione um curso...")}</option>
            {filteredCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {modules.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">{tr("Module (optional)", "Módulo (opcional)")}</label>
              <select
                value={selectedModuleId}
                onChange={(e) => {
                  setSelectedModuleId(e.target.value);
                  setSelectedLessonId("");
                }}
                className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
              >
                <option value="">{tr("Course-level link", "Vínculo no curso")}</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{tr("Lesson (optional)", "Aula (opcional)")}</label>
              <select
                value={selectedLessonId}
                onChange={(e) => setSelectedLessonId(e.target.value)}
                disabled={!selectedModuleId}
                className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs disabled:opacity-50"
              >
                <option value="">{tr("Module-level link", "Vínculo no módulo")}</option>
                {(currentModule?.lessons ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {selectedModuleId && (
          <div>
            <label className="mb-1 block text-xs font-medium">
              {tr("Or create a new lesson in this module", "Ou criar uma nova aula neste módulo")}
            </label>
            <Input
              value={newLessonTitle}
              onChange={(e) => setNewLessonTitle(e.target.value)}
              placeholder={tr("New lesson title (optional)...", "Título da nova aula (opcional)...")}
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium">{tr("Purpose in Learning", "Finalidade no conteúdo")}</label>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as typeof purpose)}
            className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
          >
            <option value="main_content">{tr("Main Content", "Conteúdo Principal")}</option>
            <option value="supplementary">{tr("Supplementary Material", "Material Complementar")}</option>
            <option value="reference">{tr("Reference", "Referência")}</option>
            <option value="exercise">{tr("Exercise", "Exercício")}</option>
            <option value="summary">{tr("Summary", "Resumo")}</option>
            <option value="personal_annotation">{tr("Personal Annotation", "Anotação Pessoal")}</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {tr("Cancel", "Cancelar")}
          </Button>
          <Button type="submit" size="sm" disabled={saving || !selectedCourseId}>
            {saving ? tr("Linking...", "Vinculando...") : tr("Link Note", "Vincular Nota")}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function CreateLessonFromNoteModal({
  noteId,
  noteTitle,
  onClose,
  onCreated,
}: {
  noteId: string;
  noteTitle: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { tr } = useI18n();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [courseId, setCourseId] = useState("");
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [moduleId, setModuleId] = useState("");
  const [newModuleTitle, setNewModuleTitle] = useState("Module 1");
  const [lessonTitle, setLessonTitle] = useState(noteTitle);
  const [description, setDescription] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("30");
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [objectivesText, setObjectivesText] = useState("");
  const [prerequisitesText, setPrerequisitesText] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/learning/overview");
      if (res.ok) {
        const json = await res.json();
        const list: CourseItem[] = json.data?.courses ?? [];
        setCourses(list);
        if (list[0]) setCourseId(list[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!courseId) {
      setModules([]);
      setModuleId("");
      return;
    }
    void (async () => {
      const res = await fetch(`/api/learning/courses/${courseId}`);
      if (res.ok) {
        const json = await res.json();
        const mods: ModuleItem[] = json.data?.modules ?? [];
        setModules(mods);
        setModuleId(mods[0]?.id ?? "");
      }
    })();
  }, [courseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitle.trim()) return;
    if (!courseId && !newCourseTitle.trim()) return;
    setSaving(true);
    try {
      const objectives = objectivesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const prerequisites = prerequisitesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const resources = resourceUrl.trim()
        ? [{ title: tr("Reference", "Referência"), url: resourceUrl.trim() }]
        : [];

      const res = await fetch("/api/learning/from-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "lesson",
          noteId,
          courseId: courseId || null,
          newCourseTitle: courseId ? undefined : newCourseTitle.trim(),
          moduleId: moduleId || null,
          newModuleTitle: moduleId ? undefined : newModuleTitle.trim() || "Module 1",
          lessonTitle: lessonTitle.trim(),
          description: description.trim() || null,
          estimatedMinutes: Number(estimatedMinutes) || 30,
          difficulty,
          objectives,
          prerequisites,
          resources,
        }),
      });
      if (res.ok) {
        onCreated();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <GraduationCap className="h-4 w-4 text-[var(--accent)]" />
            {tr("Create Lesson from Note", "Criar Aula a partir da Nota")}
          </h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[var(--surface-muted)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium">{tr("Course", "Curso")}</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
            >
              <option value="">{tr("+ New Course", "+ Novo Curso")}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          {!courseId ? (
            <div>
              <label className="mb-1 block text-xs font-medium">{tr("New Course Name", "Nome do Novo Curso")}</label>
              <Input
                value={newCourseTitle}
                onChange={(e) => setNewCourseTitle(e.target.value)}
                placeholder={tr("Course title...", "Título do curso...")}
                required
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium">{tr("Module", "Módulo")}</label>
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
              >
                <option value="">{tr("+ New Module", "+ Novo Módulo")}</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {!moduleId && (
          <div>
            <label className="mb-1 block text-xs font-medium">{tr("New Module Name", "Nome do Novo Módulo")}</label>
            <Input
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              placeholder="Module 1"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium">{tr("Lesson Title", "Título da Aula")}</label>
          <Input value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} required />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium">{tr("Description", "Descrição")}</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tr("What will be learned...", "O que será aprendido...")}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium">{tr("Estimated Duration (min)", "Duração Estimada (min)")}</label>
            <Input
              type="number"
              min={5}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{tr("Difficulty", "Dificuldade")}</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
              className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
            >
              <option value="beginner">{tr("Beginner", "Iniciante")}</option>
              <option value="intermediate">{tr("Intermediate", "Intermediário")}</option>
              <option value="advanced">{tr("Advanced", "Avançado")}</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium">
            {tr("Learning Objectives (one per line)", "Objetivos de Aprendizado (um por linha)")}
          </label>
          <textarea
            rows={2}
            value={objectivesText}
            onChange={(e) => setObjectivesText(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2 text-xs"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium">
            {tr("Prerequisites (one per line)", "Pré-requisitos (um por linha)")}
          </label>
          <textarea
            rows={2}
            value={prerequisitesText}
            onChange={(e) => setPrerequisitesText(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2 text-xs"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium">{tr("Supplementary URL (optional)", "Link Complementar (opcional)")}</label>
          <Input
            type="url"
            value={resourceUrl}
            onChange={(e) => setResourceUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {tr("Cancel", "Cancelar")}
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? tr("Creating...", "Criando...") : tr("Create Lesson", "Criar Aula")}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function LinkedNoteDeleteDialog({
  noteTitle,
  impact,
  onCancel,
  onArchive,
  onConfirmDelete,
}: {
  noteTitle: string;
  impact: {
    linkedLearning: Array<{
      course: { title: string } | null;
      lesson: { title: string } | null;
    }>;
    flashcardsCount: number;
    quizzes: Array<{ title: string }>;
  };
  onCancel: () => void;
  onArchive: () => void;
  onConfirmDelete: () => void;
}) {
  const { tr } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl"
      >
        <h3 className="text-base font-semibold text-red-500">
          {tr("Delete Linked Note?", "Excluir Nota Vinculada?")}
        </h3>
        <p className="text-xs text-[var(--muted-foreground)]">
          {tr(
            `"${noteTitle}" is referenced by Learning content. Deleting it will show a removed-content notice in affected lessons.`,
            `"${noteTitle}" é usada em conteúdos de Learning. Ao excluir, as aulas afetadas continuarão acessíveis exibindo um aviso de conteúdo removido.`
          )}
        </p>
        <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2.5 text-xs">
          {impact.linkedLearning.map((l, idx) => (
            <li key={idx}>
              • {l.course?.title ?? "Course"} {l.lesson ? `→ ${l.lesson.title}` : ""}
            </li>
          ))}
          {impact.flashcardsCount > 0 && (
            <li>
              • {impact.flashcardsCount} {tr("flashcard(s)", "flashcard(s)")}
            </li>
          )}
          {impact.quizzes.map((q, idx) => (
            <li key={`q-${idx}`}>• Quiz: {q.title}</li>
          ))}
        </ul>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {tr("Cancel", "Cancelar")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onArchive}>
            {tr("Archive Instead", "Arquivar em vez disso")}
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={onConfirmDelete}>
            {tr("Delete Permanently", "Excluir Definitivamente")}
          </Button>
        </div>
      </div>
    </div>
  );
}
