"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  Lock,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

interface PlannerBlock {
  id: string;
  title: string;
  sourceType: string;
  sourceId: string | null;
  startMinute: number;
  endMinute: number;
  status: string;
  priority: string;
}

interface RecoveryTask {
  id: string;
  title: string;
  priority: string;
  dueAt: string | null;
  blockedBy: string[];
}

interface RecoveryData {
  needsRecovery: boolean;
  daysInactive: number;
  overdueCount: number;
  urgentTasks: RecoveryTask[];
  blockedTasks: RecoveryTask[];
  otherOverdueTasks: RecoveryTask[];
}

function fmtMinute(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function DayPlannerWorkspace() {
  const [planDate, setPlanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [blocks, setBlocks] = useState<PlannerBlock[]>([]);
  const [unscheduled, setUnscheduled] = useState<Array<{ id: string; title: string; reason: string }>>([]);
  const [recovery, setRecovery] = useState<RecoveryData | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryDecisions, setRecoveryDecisions] = useState<
    Record<string, { decision: "reschedule" | "complete" | "cancel" | "keep"; newDueAt?: string }>
  >({});
  const [manualTitle, setManualTitle] = useState("");
  const [manualStart, setManualStart] = useState("12:00");
  const [manualEnd, setManualEnd] = useState("13:00");
  const [manualType, setManualType] = useState<"custom" | "blocked">("blocked");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const [planRes, recRes] = await Promise.all([
      fetch(`/api/day-planner?date=${encodeURIComponent(planDate)}`),
      fetch("/api/recovery"),
    ]);
    if (planRes.ok) {
      const json = (await planRes.json()) as { data?: { blocks: PlannerBlock[] } };
      setBlocks(json.data?.blocks ?? []);
    }
    if (recRes.ok) {
      const rJson = (await recRes.json()) as { data?: RecoveryData };
      if (rJson.data) setRecovery(rJson.data);
    }
  }, [planDate]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generatePlan() {
    setLoading(true);
    try {
      const res = await fetch("/api/day-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", planDate }),
      });
      const json = (await res.json()) as {
        data?: { unscheduled?: Array<{ id: string; title: string; reason: string }> };
      };
      setUnscheduled(json.data?.unscheduled ?? []);
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function updateBlock(blockId: string, patch: { startMinute?: number; endMinute?: number; status?: string }) {
    await fetch("/api/day-planner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", blockId, ...patch }),
    });
    await load();
  }

  async function shiftBlock(b: PlannerBlock, deltaMinutes: number) {
    const dur = b.endMinute - b.startMinute;
    const nextStart = Math.max(0, Math.min(1440 - dur, b.startMinute + deltaMinutes));
    await updateBlock(b.id, { startMinute: nextStart, endMinute: nextStart + dur });
  }

  async function addManualBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!manualTitle.trim()) return;
    const [sh, sm] = manualStart.split(":").map(Number);
    const [eh, em] = manualEnd.split(":").map(Number);
    const startMinute = (sh || 0) * 60 + (sm || 0);
    const endMinute = Math.max(startMinute + 15, (eh || 0) * 60 + (em || 0));

    await fetch("/api/day-planner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "manual",
        planDate,
        title: manualTitle.trim(),
        sourceType: manualType,
        startMinute,
        endMinute,
      }),
    });
    setManualTitle("");
    await load();
  }

  async function removeBlock(id: string) {
    await fetch(`/api/day-planner?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  async function applyRecovery() {
    const items = Object.entries(recoveryDecisions).map(([taskId, cfg]) => ({
      taskId,
      decision: cfg.decision,
      newDueAt: cfg.newDueAt,
    }));
    if (items.length === 0) return;
    await fetch("/api/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "apply", items }),
    });
    setShowRecovery(false);
    setRecoveryDecisions({});
    await load();
  }

  const allOverdue = recovery
    ? [...recovery.urgentTasks, ...recovery.otherOverdueTasks, ...recovery.blockedTasks]
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <CalendarClock className="h-6 w-6 text-[var(--accent)]" />
            Day Planner
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Distribua suas tarefas nos horários livres respeitando compromissos, rotinas e dependências.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={planDate}
            onChange={(e) => setPlanDate(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            data-tour="day-planner-generate"
            disabled={loading}
            onClick={() => void generatePlan()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" /> {loading ? "Planejando..." : "Gerar Sugestão"}
          </button>
        </div>
      </header>

      {recovery && recovery.overdueCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <div className="font-medium">
                Você tem {recovery.overdueCount} atividade(s) pendente(s) atrasada(s). Deseja reorganizar seu planejamento?
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">
                O Recovery Assistant ajuda a adiar, concluir ou cancelar em lote com prévia.
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowRecovery(true)}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-black"
            >
              Abrir Recovery
            </button>
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/recovery", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "dismiss", hours: 24 }),
                });
                await load();
              }}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"
            >
              Dispensar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {blocks.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted-foreground)]">
              Nenhum bloco planejado para {planDate}. Clique em <strong>Gerar Sugestão</strong> ou bloqueie um horário ao lado.
            </div>
          ) : (
            blocks.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    {b.sourceType === "blocked" && <Lock className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />}
                    <span>{b.title}</span>
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] capitalize">
                      {b.status}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {fmtMinute(b.startMinute)} – {fmtMinute(b.endMinute)} ({b.endMinute - b.startMinute} min) ·{" "}
                    {b.sourceType} · prioridade {b.priority}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void shiftBlock(b, -30)}
                    className="rounded border border-[var(--border)] p-1.5 text-xs"
                    title="Mover 30m antes"
                    aria-label="Move 30 minutes earlier"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void shiftBlock(b, 30)}
                    className="rounded border border-[var(--border)] p-1.5 text-xs"
                    title="Mover 30m depois"
                    aria-label="Move 30 minutes later"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  {b.status === "suggested" && (
                    <button
                      type="button"
                      onClick={() => void updateBlock(b.id, { status: "accepted" })}
                      className="inline-flex items-center gap-1 rounded bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-white"
                    >
                      <Check className="h-3.5 w-3.5" /> Aceitar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void removeBlock(b.id)}
                    className="rounded border border-[var(--border)] p-1.5 text-xs text-red-500"
                    title="Remover do plano"
                    aria-label="Remove block"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-4">
          <form
            onSubmit={addManualBlock}
            className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <h2 className="text-sm font-semibold">Bloquear Horário ou Bloco Manual</h2>
            <input
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="Ex: Almoço, Academia, Foco livre"
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              required
            />
            <select
              value={manualType}
              onChange={(e) => setManualType(e.target.value as "custom" | "blocked")}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <option value="blocked">Horário bloqueado</option>
              <option value="custom">Atividade manual</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-sm"
              />
              <input
                type="time"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" /> Adicionar Bloco
            </button>
          </form>

          {unscheduled.length > 0 && (
            <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="text-sm font-semibold">Tarefas sem horário ({unscheduled.length})</h2>
              {unscheduled.map((u) => (
                <div key={u.id} className="rounded-lg border border-[var(--border)] p-2.5 text-xs">
                  <div className="font-medium">{u.title}</div>
                  <div className="text-[var(--muted-foreground)]">{u.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showRecovery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-lg font-semibold">Nikki Recovery Assistant</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Escolha o que fazer com cada tarefa atrasada. Nenhuma alteração é aplicada sem sua confirmação.
            </p>
            <div className="space-y-2">
              {allOverdue.map((t) => {
                const dec = recoveryDecisions[t.id]?.decision ?? "keep";
                return (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-3 text-xs"
                  >
                    <div>
                      <div className="font-medium">{t.title}</div>
                      <div className="text-[var(--muted-foreground)]">
                        Prioridade: {t.priority}
                        {t.blockedBy.length > 0 ? ` · Bloqueada por: ${t.blockedBy.join(", ")}` : ""}
                      </div>
                    </div>
                    <select
                      value={dec}
                      onChange={(e) => {
                        const val = e.target.value as "reschedule" | "complete" | "cancel" | "keep";
                        setRecoveryDecisions((prev) => ({
                          ...prev,
                          [t.id]: {
                            decision: val,
                            newDueAt:
                              val === "reschedule"
                                ? new Date(Date.now() + 86400000).toISOString().slice(0, 10) + "T23:59:00"
                                : undefined,
                          },
                        }));
                      }}
                      className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
                    >
                      <option value="keep">Manter como está</option>
                      <option value="reschedule">Adiar para amanhã</option>
                      <option value="complete">Marcar concluída</option>
                      <option value="cancel">Cancelar</option>
                    </select>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRecovery(false)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => void applyRecovery()}
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white"
              >
                Confirmar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
