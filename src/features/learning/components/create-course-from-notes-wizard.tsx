"use client";

import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, GraduationCap, Plus, Trash2, X } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SimpleNote {
  id: string;
  title: string;
}

interface WizardModule {
  id: string;
  title: string;
  lessons: Array<{
    id: string;
    title: string;
    noteIds: string[];
  }>;
}

export function CreateCourseFromNotesWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (courseId: string) => void;
}) {
  const { tr } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [notes, setNotes] = useState<SimpleNote[]>([]);
  const [noteFilter, setNoteFilter] = useState("");
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

  const [courseTitle, setCourseTitle] = useState("");
  const [courseDesc, setCourseDesc] = useState("");
  const [courseCategory, setCourseCategory] = useState("");

  const [modules, setModules] = useState<WizardModule[]>([
    { id: "m1", title: "Module 1", lessons: [] },
  ]);
  const [newModTitle, setNewModTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/notes");
      if (res.ok) {
        const json = await res.json();
        setNotes(json.data?.notes ?? []);
      }
    })();
  }, []);

  const noteMap = new Map(notes.map((n) => [n.id, n]));
  const filteredNotes = notes.filter((n) =>
    n.title.toLowerCase().includes(noteFilter.trim().toLowerCase())
  );

  // When advancing from Step 3 -> Step 4, ensure every selected note is placed in at least one lesson if modules have no lessons yet
  const seedLessonsIfEmpty = () => {
    const alreadyAssigned = new Set(
      modules.flatMap((m) => m.lessons.flatMap((l) => l.noteIds))
    );
    const unassigned = selectedNoteIds.filter((id) => !alreadyAssigned.has(id));
    if (unassigned.length > 0 && modules.length > 0) {
      setModules((prev) => {
        const copy = [...prev];
        const first = { ...copy[0]!, lessons: [...copy[0]!.lessons] };
        for (const nid of unassigned) {
          const nTitle = noteMap.get(nid)?.title ?? "Lesson";
          first.lessons.push({
            id: `l-${nid}`,
            title: nTitle,
            noteIds: [nid],
          });
        }
        copy[0] = first;
        return copy;
      });
    }
  };

  const moveModule = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= modules.length) return;
    setModules((prev) => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item!);
      return next;
    });
  };

  const moveLesson = (modIdx: number, lIdx: number, dir: -1 | 1) => {
    setModules((prev) =>
      prev.map((m, i) => {
        if (i !== modIdx) return m;
        const target = lIdx + dir;
        if (target < 0 || target >= m.lessons.length) return m;
        const lessons = [...m.lessons];
        const [item] = lessons.splice(lIdx, 1);
        lessons.splice(target, 0, item!);
        return { ...m, lessons };
      })
    );
  };

  const handleConfirm = async () => {
    if (!courseTitle.trim()) return;
    setSaving(true);
    try {
      const payloadModules = modules
        .filter((m) => m.lessons.length > 0)
        .map((m) => ({
          title: m.title.trim() || "Module",
          lessons: m.lessons.map((l) => ({
            title: l.title.trim() || "Lesson",
            noteIds: l.noteIds,
          })),
        }));
      if (payloadModules.length === 0) return;

      const res = await fetch("/api/learning/from-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "course",
          title: courseTitle.trim(),
          description: courseDesc.trim() || null,
          category: courseCategory.trim() || null,
          modules: payloadModules,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        onCreated(json.data.course.id);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <GraduationCap className="h-4 w-4 text-[var(--accent)]" />
              {tr("Create Course from Notes", "Criar Curso a partir de Notas")}
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              {tr(`Step ${step} of 6`, `Etapa ${step} de 6`)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[var(--surface-muted)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step 1: Select Notes */}
        {step === 1 && (
          <div className="space-y-3">
            <Input
              value={noteFilter}
              onChange={(e) => setNoteFilter(e.target.value)}
              placeholder={tr("Search notes...", "Pesquisar notas...")}
            />
            <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
              {filteredNotes.map((n) => {
                const checked = selectedNoteIds.includes(n.id);
                return (
                  <label
                    key={n.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-[var(--surface-muted)]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedNoteIds((prev) =>
                          checked ? prev.filter((id) => id !== n.id) : [...prev, n.id]
                        )
                      }
                    />
                    <span className="truncate font-medium">{n.title}</span>
                  </label>
                );
              })}
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">
              {selectedNoteIds.length} {tr("note(s) selected", "nota(s) selecionada(s)")}
            </div>
          </div>
        )}

        {/* Step 2: Course Info */}
        {step === 2 && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">{tr("Course Title", "Título do Curso")}</label>
              <Input
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                placeholder={tr("e.g. Linux Privilege Escalation", "Ex: Escalação de Privilégios Linux")}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{tr("Description", "Descrição")}</label>
              <textarea
                rows={3}
                value={courseDesc}
                onChange={(e) => setCourseDesc(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{tr("Category", "Categoria")}</label>
              <Input
                value={courseCategory}
                onChange={(e) => setCourseCategory(e.target.value)}
                placeholder={tr("e.g. Security, Programming", "Ex: Segurança, Programação")}
              />
            </div>
          </div>
        )}

        {/* Step 3: Modules */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newModTitle}
                onChange={(e) => setNewModTitle(e.target.value)}
                placeholder={tr("New module title...", "Título do novo módulo...")}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (!newModTitle.trim()) return;
                  setModules((prev) => [
                    ...prev,
                    { id: `m-${Date.now()}`, title: newModTitle.trim(), lessons: [] },
                  ]);
                  setNewModTitle("");
                }}
              >
                <Plus className="h-4 w-4" /> {tr("Add", "Adicionar")}
              </Button>
            </div>
            <div className="space-y-2">
              {modules.map((m, idx) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-2"
                >
                  <Input
                    value={m.title}
                    onChange={(e) =>
                      setModules((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x))
                      )
                    }
                    className="h-8 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => moveModule(idx, -1)}
                    className="rounded border border-[var(--border)] p-1"
                    title={tr("Move up", "Mover para cima")}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveModule(idx, 1)}
                    className="rounded border border-[var(--border)] p-1"
                    title={tr("Move down", "Mover para baixo")}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  {modules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setModules((prev) => prev.filter((_, i) => i !== idx))}
                      className="rounded border border-[var(--border)] p-1 text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4 & 5: Assign Notes to Lessons & Reorder */}
        {(step === 4 || step === 5) && (
          <div className="space-y-3">
            {modules.map((m, mIdx) => (
              <div key={m.id} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{m.title}</span>
                  {step === 4 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() =>
                        setModules((prev) =>
                          prev.map((x, i) =>
                            i === mIdx
                              ? {
                                  ...x,
                                  lessons: [
                                    ...x.lessons,
                                    {
                                      id: `l-${Date.now()}`,
                                      title: `Lesson ${x.lessons.length + 1}`,
                                      noteIds: [],
                                    },
                                  ],
                                }
                              : x
                          )
                        )
                      }
                    >
                      + {tr("Lesson", "Aula")}
                    </Button>
                  )}
                </div>

                {m.lessons.map((l, lIdx) => (
                  <div
                    key={l.id}
                    className="space-y-1.5 rounded border border-[var(--border)] bg-[var(--background)] p-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={l.title}
                        onChange={(e) =>
                          setModules((prev) =>
                            prev.map((x, i) =>
                              i === mIdx
                                ? {
                                    ...x,
                                    lessons: x.lessons.map((ll, j) =>
                                      j === lIdx ? { ...ll, title: e.target.value } : ll
                                    ),
                                  }
                                : x
                            )
                          )
                        }
                        className="h-7 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => moveLesson(mIdx, lIdx, -1)}
                        className="rounded border border-[var(--border)] p-1"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLesson(mIdx, lIdx, 1)}
                        className="rounded border border-[var(--border)] p-1"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setModules((prev) =>
                            prev.map((x, i) =>
                              i === mIdx
                                ? { ...x, lessons: x.lessons.filter((_, j) => j !== lIdx) }
                                : x
                            )
                          )
                        }
                        className="rounded border border-[var(--border)] p-1 text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {l.noteIds.map((nid) => (
                        <span
                          key={nid}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px]"
                        >
                          {noteMap.get(nid)?.title ?? "Note"}
                          <button
                            type="button"
                            onClick={() =>
                              setModules((prev) =>
                                prev.map((x, i) =>
                                  i === mIdx
                                    ? {
                                        ...x,
                                        lessons: x.lessons.map((ll, j) =>
                                          j === lIdx
                                            ? { ...ll, noteIds: ll.noteIds.filter((id) => id !== nid) }
                                            : ll
                                        ),
                                      }
                                    : x
                                )
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {step === 4 && selectedNoteIds.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            const nid = e.target.value;
                            if (!nid) return;
                            setModules((prev) =>
                              prev.map((x, i) =>
                                i === mIdx
                                  ? {
                                      ...x,
                                      lessons: x.lessons.map((ll, j) =>
                                        j === lIdx && !ll.noteIds.includes(nid)
                                          ? { ...ll, noteIds: [...ll.noteIds, nid] }
                                          : ll
                                      ),
                                    }
                                  : x
                              )
                            );
                          }}
                          className="h-6 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 text-[11px]"
                        >
                          <option value="">+ {tr("Attach note", "Anexar nota")}</option>
                          {selectedNoteIds.map((nid) => (
                            <option key={nid} value={nid}>
                              {noteMap.get(nid)?.title ?? nid}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Step 6: Review & Confirm */}
        {step === 6 && (
          <div className="space-y-2 rounded-lg border border-[var(--border)] p-3 text-xs">
            <div className="text-sm font-semibold">{courseTitle}</div>
            {courseDesc && <p className="text-[var(--muted-foreground)]">{courseDesc}</p>}
            <div className="space-y-1.5 pt-2">
              {modules.map((m) => (
                <div key={m.id}>
                  <div className="font-semibold">{m.title}</div>
                  <ul className="ml-4 list-disc text-[var(--muted-foreground)]">
                    {m.lessons.map((l) => (
                      <li key={l.id}>
                        {l.title} ({l.noteIds.length} {tr("notes", "notas")})
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1) as typeof step)}
          >
            {tr("Back", "Voltar")}
          </Button>
          {step < 6 ? (
            <Button
              type="button"
              size="sm"
              disabled={
                (step === 1 && selectedNoteIds.length === 0) ||
                (step === 2 && !courseTitle.trim())
              }
              onClick={() => {
                if (step === 3) seedLessonsIfEmpty();
                setStep((s) => Math.min(6, s + 1) as typeof step);
              }}
            >
              {tr("Next", "Próximo")}
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={saving} onClick={handleConfirm}>
              <Check className="h-4 w-4" />
              {saving ? tr("Creating...", "Criando...") : tr("Create Course", "Criar Curso")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
