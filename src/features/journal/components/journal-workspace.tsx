"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Lock, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";

interface JournalEntry {
  id: string;
  entryDate: string;
  title: string | null;
  content: string;
  mood: string | null;
  templateKind: string;
}

export function JournalWorkspace() {
  const { tr } = useI18n();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("calm");
  const [templateKind, setTemplateKind] = useState("free");

  const load = useCallback(async () => {
    const res = await fetch("/api/journal");
    if (!res.ok) return;
    const json = (await res.json()) as { data?: { entries: JournalEntry[] } };
    setEntries(json.data?.entries ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function applyTemplate(kind: string) {
    setTemplateKind(kind);
    if (kind === "gratitude" && !content) {
      setContent(
        tr(
          "1. Grateful for:\n2. Highlight of today:\n3. One small win:",
          "1. Sou grato por:\n2. Destaque de hoje:\n3. Uma pequena vitória:"
        )
      );
    } else if (kind === "reflection" && !content) {
      setContent(
        tr(
          "What went well?\n\nWhat challenged me?\n\nWhat will I focus on tomorrow?",
          "O que deu certo?\n\nO que me desafiou?\n\nEm que vou focar amanhã?"
        )
      );
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    const res = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryDate,
        title: title.trim() || null,
        content: content.trim(),
        mood,
        templateKind,
      }),
    });
    if (res.ok) {
      setTitle("");
      setContent("");
      await load();
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/journal?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  const moodLabel = (m: string | null) => {
    if (!m) return "—";
    if (m === "calm") return tr("Calm", "Calmo");
    if (m === "energized") return tr("Energized", "Energizado");
    if (m === "focused") return tr("Focused", "Focado");
    if (m === "tired") return tr("Tired", "Cansado");
    if (m === "stressed") return tr("Stressed", "Estressado");
    return m;
  };

  const templateLabel = (k: string) => {
    if (k === "free") return tr("Free", "Livre");
    if (k === "gratitude") return tr("Gratitude", "Gratidão");
    if (k === "reflection") return tr("Reflection", "Reflexão");
    return k;
  };

  const templateButtonLabel = (k: string) => {
    if (k === "free") return tr("free template", "modelo livre");
    if (k === "gratitude") return tr("gratitude template", "modelo de gratidão");
    if (k === "reflection") return tr("reflection template", "modelo de reflexão");
    return k;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <BookOpen className="h-6 w-6 text-[var(--accent)]" />
            {tr("Nikki Journal", "Diário Nikki")}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {tr(
              "Private daily reflections, gratitude prompts, and mood tracking.",
              "Reflexões diárias privadas, prompts de gratidão e registro de humor."
            )}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1 text-xs">
          <Lock className="h-3.5 w-3.5 text-[var(--accent)]" />{" "}
          {tr("Private by default", "Privado por padrão")}
        </span>
      </header>

      <form
        onSubmit={handleSave}
        className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tr("Entry title (optional)", "Título da entrada (opcional)")}
            className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm sm:col-span-2"
          />
          <select
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="calm">{tr("Calm", "Calmo")}</option>
            <option value="energized">{tr("Energized", "Energizado")}</option>
            <option value="focused">{tr("Focused", "Focado")}</option>
            <option value="tired">{tr("Tired", "Cansado")}</option>
            <option value="stressed">{tr("Stressed", "Estressado")}</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {["free", "gratitude", "reflection"].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => applyTemplate(k)}
              className={`rounded-full border px-3 py-1 text-xs ${
                templateKind === k
                  ? "border-[var(--accent)] bg-[var(--accent)]/15"
                  : "border-[var(--border)]"
              }`}
            >
              {templateButtonLabel(k)}
            </button>
          ))}
        </div>

        <textarea
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={tr(
            "Write your private thoughts for today...",
            "Escreva seus pensamentos privados de hoje..."
          )}
          className="w-full rounded-lg border border-[var(--border)] bg-transparent p-3 text-sm"
          required
        />

        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> {tr("Save Entry", "Salvar Entrada")}
        </button>
      </form>

      <div className="space-y-3">
        {entries.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
            {tr(
              "Your private journal is empty. Write your first reflection above.",
              "Seu diário privado está vazio. Escreva sua primeira reflexão acima."
            )}
          </div>
        ) : (
          entries.map((entry) => (
            <article
              key={entry.id}
              className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{entry.title || entry.entryDate}</h3>
                  <div className="text-xs text-[var(--muted)]">
                    {entry.entryDate} · {tr("Mood", "Humor")}: {moodLabel(entry.mood)} ·{" "}
                    {templateLabel(entry.templateKind)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  className="rounded p-1 text-[var(--muted)] hover:text-red-500"
                  aria-label={tr("Delete journal entry", "Excluir entrada do diário")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm">{entry.content}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
