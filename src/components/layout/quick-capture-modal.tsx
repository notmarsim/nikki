"use client";

import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Inbox, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUiStore } from "@/stores/ui-store";

export function QuickCaptureModal() {
  const queryClient = useQueryClient();
  const { quickCaptureOpen, setQuickCaptureOpen } = useUiStore();
  const [type, setType] = useState<"note" | "idea" | "link" | "task" | "quick_note">("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "i") {
        event.preventDefault();
        setQuickCaptureOpen(!quickCaptureOpen);
      } else if (event.key === "Escape" && quickCaptureOpen) {
        setQuickCaptureOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [quickCaptureOpen, setQuickCaptureOpen]);

  if (!quickCaptureOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim() || null,
          content: content.trim(),
          url: url.trim() || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message ?? "Failed to capture item");
        return;
      }

      setTitle("");
      setContent("");
      setUrl("");
      setQuickCaptureOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inbox"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[14vh] px-4"
      onClick={() => setQuickCaptureOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Quick Capture"
    >
      <div
        className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-[var(--accent)]" />
            <h2 className="text-base font-semibold">Quick Capture to Inbox</h2>
          </div>
          <button
            type="button"
            onClick={() => setQuickCaptureOpen(false)}
            className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]"
            aria-label="Close Quick Capture"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {(["note", "idea", "task", "link", "quick_note"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  type === t
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "bg-[var(--surface-muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {t.replace("_", " ")}
              </button>
            ))}
          </div>

          <Input
            placeholder="Optional title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <textarea
            autoFocus
            rows={4}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Capture a thought, task, snippet, or reference..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          />

          {type === "link" && (
            <Input
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-[var(--muted-foreground)]">
              Shortcut: <kbd className="rounded border border-[var(--border)] px-1">Ctrl+Shift+I</kbd>
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuickCaptureOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Capturing..." : "Capture"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
