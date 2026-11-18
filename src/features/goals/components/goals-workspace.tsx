"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";

interface LifeArea {
  id: string;
  name: string;
  color: string;
}

interface LifeGoal {
  id: string;
  title: string;
  description: string | null;
  areaId: string | null;
  horizon: string;
  metricSource: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  status: string;
  computedProgress: number;
}

export function GoalsWorkspace() {
  const [areas, setAreas] = useState<LifeArea[]>([]);
  const [goals, setGoals] = useState<LifeGoal[]>([]);
  const [areaName, setAreaName] = useState("");
  const [title, setTitle] = useState("");
  const [areaId, setAreaId] = useState("");
  const [horizon, setHorizon] = useState("quarterly");
  const [targetValue, setTargetValue] = useState("100");
  const [unit, setUnit] = useState("%");

  const load = useCallback(async () => {
    const res = await fetch("/api/goals");
    if (!res.ok) return;
    const json = (await res.json()) as { data?: { areas: LifeArea[]; goals: LifeGoal[] } };
    setAreas(json.data?.areas ?? []);
    setGoals(json.data?.goals ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createArea(e: React.FormEvent) {
    e.preventDefault();
    if (!areaName.trim()) return;
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "area", name: areaName.trim() }),
    });
    setAreaName("");
    await load();
  }

  async function createGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "goal",
        title: title.trim(),
        areaId: areaId || null,
        horizon,
        targetValue: Math.max(1, Number(targetValue) || 100),
        unit: unit.trim() || "%",
      }),
    });
    setTitle("");
    await load();
  }

  async function incrementGoal(goal: LifeGoal, delta: number) {
    const next = Math.max(0, Math.min(goal.targetValue, goal.currentValue + delta));
    await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: goal.id,
        currentValue: next,
        status: next >= goal.targetValue ? "completed" : "active",
      }),
    });
    await load();
  }

  async function removeGoal(id: string) {
    await fetch(`/api/goals?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Target className="h-6 w-6 text-[var(--accent)]" />
          Goals & Life Areas
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Organize life areas, long-term horizons, and track progress across manual and linked metrics.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <form
          onSubmit={createArea}
          className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <h2 className="text-sm font-semibold">Add Life Area</h2>
          <input
            value={areaName}
            onChange={(e) => setAreaName(e.target.value)}
            placeholder="e.g. Health, Career, Learning"
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
          >
            <Plus className="h-4 w-4" /> Add Area
          </button>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {areas.map((a) => (
              <span
                key={a.id}
                className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs"
              >
                {a.name}
              </span>
            ))}
          </div>
        </form>

        <form
          onSubmit={createGoal}
          className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:col-span-2"
        >
          <h2 className="text-sm font-semibold">New Goal</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Goal title"
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm sm:col-span-2"
              required
            />
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <option value="">No life area</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
              <option value="multi_year">Multi-year</option>
            </select>
            <input
              type="number"
              min={1}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="Target"
              className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            />
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Unit (%, books, km)"
              className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Create Goal
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {goals.length === 0 ? (
          <div className="col-span-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
            No goals yet. Create a life area and your first goal above.
          </div>
        ) : (
          goals.map((g) => {
            const area = areas.find((a) => a.id === g.areaId);
            return (
              <div
                key={g.id}
                className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{g.title}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {area ? `${area.name} · ` : ""}
                      {g.horizon} · {g.status}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeGoal(g.id)}
                    className="rounded p-1 text-[var(--muted)] hover:text-red-500"
                    aria-label="Delete goal"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>
                      {g.currentValue} / {g.targetValue} {g.unit}
                    </span>
                    <span className="font-semibold">{g.computedProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className="h-full bg-[var(--accent)] transition-all"
                      style={{ width: `${Math.min(100, g.computedProgress)}%` }}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => incrementGoal(g, 1)}
                    className="rounded border border-[var(--border)] px-2.5 py-1 text-xs"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => incrementGoal(g, 10)}
                    className="rounded border border-[var(--border)] px-2.5 py-1 text-xs"
                  >
                    +10
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
