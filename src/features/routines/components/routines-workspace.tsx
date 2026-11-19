"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Check, Copy, ListOrdered, Pause, Play, Plus, SkipForward, Trash2 } from "lucide-react";

interface RoutineStep {
  id: string;
  title: string;
  durationMinutes: number;
  sortOrder: number;
}

interface RoutineRun {
  id: string;
  status: string;
  currentStepIndex: number;
  stepStates: Record<string, "pending" | "completed" | "skipped">;
}

interface Routine {
  id: string;
  title: string;
  description: string | null;
  scheduledTime: string | null;
  isPaused: boolean;
  steps: RoutineStep[];
  latestRun: RoutineRun | null;
}

export function RoutinesWorkspace() {
  const { t, tr } = useI18n();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [title, setTitle] = useState("");
  const [scheduledTime, setScheduledTime] = useState("20:00");
  const [stepDrafts, setStepDrafts] = useState<Array<{ title: string; durationMinutes: number }>>([
    { title: "Rest", durationMinutes: 15 },
    { title: "Study", durationMinutes: 45 },
  ]);
  const [newStepTitle, setNewStepTitle] = useState("");
  const [newStepDuration, setNewStepDuration] = useState("20");
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/routines");
    if (!res.ok) return;
    const json = (await res.json()) as { data?: { routines: Routine[] } };
    setRoutines(json.data?.routines ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRoutine(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || stepDrafts.length === 0) return;
    await fetch("/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        title: title.trim(),
        scheduledTime,
        steps: stepDrafts,
      }),
    });
    setTitle("");
    await load();
  }

  async function runAction(payload: Record<string, unknown>) {
    await fetch("/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await load();
  }

  const activeRoutine = routines.find((r) => r.id === activeRoutineId) ?? null;
  const activeRun =
    activeRoutine?.latestRun && activeRoutine.latestRun.status === "running"
      ? activeRoutine.latestRun
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ListOrdered className="h-6 w-6 text-[var(--accent)]" />
          {t("routines.title")}
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("routines.subtitle")}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form
          data-tour="routines-create"
          onSubmit={createRoutine}
          className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <h2 className="text-sm font-semibold">{tr("New Routine", "Nova Rotina")}</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tr("e.g. Productive evening", "Ex: Noite produtiva")}
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            required
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--muted-foreground)]">{tr("Time:", "Horário:")}</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium">{tr("Steps", "Etapas")} ({stepDrafts.length})</div>
            {stepDrafts.map((s, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded border border-[var(--border)] px-2.5 py-1.5 text-xs"
              >
                <span>
                  {idx + 1}. {s.title} ({s.durationMinutes} min)
                </span>
                <button
                  type="button"
                  onClick={() => setStepDrafts((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="flex gap-1.5 pt-1">
              <input
                value={newStepTitle}
                onChange={(e) => setNewStepTitle(e.target.value)}
                placeholder={tr("Step", "Etapa")}
                className="flex-1 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-xs"
              />
              <input
                type="number"
                min={1}
                value={newStepDuration}
                onChange={(e) => setNewStepDuration(e.target.value)}
                className="w-16 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newStepTitle.trim()) return;
                  setStepDrafts((prev) => [
                    ...prev,
                    { title: newStepTitle.trim(), durationMinutes: Number(newStepDuration) || 15 },
                  ]);
                  setNewStepTitle("");
                }}
                className="rounded border border-[var(--border)] px-2 py-1 text-xs"
              >
                +
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> {tr("Create Routine", "Criar Rotina")}
          </button>
        </form>

        <div className="space-y-4 lg:col-span-2">
          {activeRoutine && activeRun && (
            <div className="space-y-3 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-[var(--accent)]">{tr("Running now", "Executando agora")}</div>
                  <h3 className="text-lg font-semibold">{activeRoutine.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void runAction({
                      action: "run",
                      runAction: "finish",
                      routineId: activeRoutine.id,
                      runId: activeRun.id,
                    })
                  }
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs"
                >
                  {tr("Finish", "Finalizar")}
                </button>
              </div>
              {(() => {
                const currentStep = activeRoutine.steps[activeRun.currentStepIndex];
                if (!currentStep) return null;
                return (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface)] p-3">
                    <div>
                      <div className="text-sm font-medium">
                        {tr("Step", "Etapa")} {activeRun.currentStepIndex + 1}/{activeRoutine.steps.length}:{" "}
                        {currentStep.title}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {tr("Duration:", "Duração:")} {currentStep.durationMinutes} min
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void runAction({
                            action: "run",
                            runAction: "step",
                            routineId: activeRoutine.id,
                            runId: activeRun.id,
                            stepId: currentStep.id,
                            stepResult: "completed",
                          })
                        }
                        className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white"
                      >
                        <Check className="h-3.5 w-3.5" /> {tr("Complete step", "Concluir etapa")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void runAction({
                            action: "run",
                            runAction: "step",
                            routineId: activeRoutine.id,
                            runId: activeRun.id,
                            stepId: currentStep.id,
                            stepResult: "skipped",
                          })
                        }
                        className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2.5 py-1 text-xs"
                      >
                        <SkipForward className="h-3.5 w-3.5" /> {tr("Skip", "Pular")}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {routines.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted-foreground)]">
              {tr("No routines created yet. Build your first sequence on the side.", "Nenhuma rotina criada ainda. Monte sua primeira sequência ao lado.")}
            </div>
          ) : (
            routines.map((r) => {
              const totalMin = r.steps.reduce((s, st) => s + st.durationMinutes, 0);
              return (
                <div
                  key={r.id}
                  className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">
                        {r.title} {r.isPaused ? tr("(Paused)", "(Pausada)") : ""}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {r.scheduledTime ?? "08:00"} · {r.steps.length} {tr("steps", "etapas")} · {totalMin} min total
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          setActiveRoutineId(r.id);
                          await runAction({ action: "run", runAction: "start", routineId: r.id });
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-white"
                      >
                        <Play className="h-3.5 w-3.5" /> {tr("Start", "Iniciar")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void runAction({ action: "pause", routineId: r.id, isPaused: !r.isPaused })
                        }
                        className="rounded-lg border border-[var(--border)] p-1.5 text-xs"
                        title={r.isPaused ? tr("Resume", "Retomar") : tr("Pause", "Pausar")}
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void runAction({ action: "duplicate", routineId: r.id })}
                        className="rounded-lg border border-[var(--border)] p-1.5 text-xs"
                        title={tr("Duplicate routine", "Duplicar rotina")}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/routines?id=${encodeURIComponent(r.id)}`, {
                            method: "DELETE",
                          });
                          await load();
                        }}
                        className="rounded-lg border border-[var(--border)] p-1.5 text-xs text-red-500"
                        title={tr("Delete routine", "Excluir rotina")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {r.steps.map((st, idx) => (
                      <span
                        key={st.id}
                        className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs"
                      >
                        {idx + 1}. {st.title} ({st.durationMinutes}m)
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
