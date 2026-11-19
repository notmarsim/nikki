"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, ExternalLink, Plus, Rss, Trash2 } from "lucide-react";

interface FeedSource {
  id: string;
  title: string;
  url: string;
  category: string;
}

interface FeedEntry {
  id: string;
  sourceId: string;
  title: string;
  link: string;
  summary: string | null;
  isRead: boolean;
  isSaved: boolean;
}

export function FeedWorkspace() {
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("Tech");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/feed");
    if (!res.ok) return;
    const json = (await res.json()) as { data?: { sources: FeedSource[]; entries: FeedEntry[] } };
    setSources(json.data?.sources ?? []);
    setEntries(json.data?.entries ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAddSource(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    const res = await fetch("/api/feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim(), category }),
    });
    const json = (await res.json()) as { error?: { message?: string } };
    setLoading(false);
    if (!res.ok) {
      setErrorMsg(json.error?.message ?? "Failed to subscribe to feed.");
      return;
    }
    setUrl("");
    await load();
  }

  async function toggleEntry(entry: FeedEntry, patch: { isRead?: boolean; isSaved?: boolean }) {
    await fetch("/api/feed", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, ...patch }),
    });
    await load();
  }

  async function saveToBookmarks(entry: FeedEntry) {
    await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: entry.link,
        title: entry.title,
        description: entry.summary ?? "",
      }),
    });
    await toggleEntry(entry, { isSaved: true });
  }

  async function removeSource(id: string) {
    await fetch(`/api/feed?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Rss className="h-6 w-6 text-[var(--accent)]" />
          Nikki Feed
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Follow your favorite blogs and RSS/Atom feeds and save articles straight to Bookmarks.
        </p>
      </header>

      <form
        onSubmit={handleAddSource}
        className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row"
      >
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/rss.xml"
          className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          required
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
          className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm sm:w-36"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> {loading ? "Fetching..." : "Subscribe"}
        </button>
      </form>
      {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm font-semibold">Subscriptions ({sources.length})</h2>
          {sources.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{s.title}</div>
                <div className="truncate text-xs text-[var(--muted)]">{s.category}</div>
              </div>
              <button
                type="button"
                onClick={() => removeSource(s.id)}
                className="rounded p-1 text-[var(--muted)] hover:text-red-500"
                aria-label="Unsubscribe"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-3 lg:col-span-2">
          {entries.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
              Subscribe to an RSS or Atom feed to start reading articles here.
            </div>
          ) : (
            entries.map((entry) => (
              <article
                key={entry.id}
                className={`space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 ${
                  entry.isRead ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={entry.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => void toggleEntry(entry, { isRead: true })}
                    className="inline-flex items-center gap-1.5 font-semibold hover:underline"
                  >
                    {entry.title} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => saveToBookmarks(entry)}
                      className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-xs"
                    >
                      <Bookmark className="h-3.5 w-3.5" /> {entry.isSaved ? "Saved" : "Bookmark"}
                    </button>
                  </div>
                </div>
                {entry.summary && <p className="text-xs text-[var(--muted)]">{entry.summary}</p>}
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
