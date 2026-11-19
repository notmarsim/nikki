"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, LayoutTemplate, Sparkles } from "lucide-react";

interface BuiltinTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  projectTitle: string;
  noteTitle: string;
  tasks: string[];
}

export function TemplatesWorkspace() {
  const [builtin, setBuiltin] = useState<BuiltinTemplate[]>([]);
  const [installedId, setInstalledId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/templates");
    if (!res.ok) return;
    const json = (await res.json()) as { data?: { builtin: BuiltinTemplate[] } };
    setBuiltin(json.data?.builtin ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function install(templateId: string) {
    setBusyId(templateId);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    setBusyId(null);
    if (res.ok) setInstalledId(templateId);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <LayoutTemplate className="h-6 w-6 text-[var(--accent)]" />
          Nikki Templates
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Start faster with ready-to-use packs of Projects, Notes, and starter Tasks.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {builtin.map((tpl) => (
          <div
            key={tpl.id}
            className="flex flex-col justify-between space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
          >
            <div className="space-y-2">
              <span className="inline-block rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs uppercase">
                {tpl.category}
              </span>
              <h2 className="font-semibold">{tpl.name}</h2>
              <p className="text-xs text-[var(--muted)]">{tpl.description}</p>
              <ul className="space-y-1 pt-2 text-xs text-[var(--muted)]">
                <li>• Project: {tpl.projectTitle}</li>
                <li>• Note: {tpl.noteTitle}</li>
                <li>• {tpl.tasks.length} starter tasks</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => install(tpl.id)}
              disabled={busyId === tpl.id}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {installedId === tpl.id ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Installed
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> {busyId === tpl.id ? "Installing..." : "Use Template"}
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
