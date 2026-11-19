"use client";

import { useCallback, useEffect, useState } from "react";
import { FileLock2, Plus, Trash2 } from "lucide-react";

interface VaultDoc {
  id: string;
  name: string;
  description: string | null;
  category: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: string | null;
}

export function VaultWorkspace() {
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("identity");
  const [storagePath, setStoragePath] = useState("");
  const [mimeType, setMimeType] = useState("application/pdf");
  const [sizeBytes, setSizeBytes] = useState("102400");
  const [expiresAt, setExpiresAt] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/vault");
    if (!res.ok) return;
    const json = (await res.json()) as { data?: { documents: VaultDoc[] } };
    setDocs(json.data?.documents ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const res = await fetch("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        category,
        storagePath: storagePath.trim() || `vault/${Date.now()}-${name.trim()}`,
        mimeType,
        sizeBytes: Math.max(1, Number(sizeBytes) || 1024),
        expiresAt: expiresAt || null,
      }),
    });
    const json = (await res.json()) as { error?: { message?: string } };
    if (!res.ok) {
      setErrorMsg(json.error?.message ?? "Failed to save vault record.");
      return;
    }
    setName("");
    setStoragePath("");
    setExpiresAt("");
    await load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/vault?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <FileLock2 className="h-6 w-6 text-[var(--accent)]" />
          Document Vault
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Keep important personal documents organized with categories and expiration reminders.
        </p>
      </header>

      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Document name (e.g. Passport Scan)"
            className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            required
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="identity">Identity</option>
            <option value="contract">Contract</option>
            <option value="medical">Medical</option>
            <option value="tax">Tax & Finance</option>
            <option value="other">Other</option>
          </select>
          <select
            value={mimeType}
            onChange={(e) => setMimeType(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="application/pdf">PDF (application/pdf)</option>
            <option value="image/png">PNG Image</option>
            <option value="image/jpeg">JPEG Image</option>
            <option value="text/plain">Plain Text</option>
          </select>
          <input
            value={storagePath}
            onChange={(e) => setStoragePath(e.target.value)}
            placeholder="Storage path (optional)"
            className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={1}
            max={20 * 1024 * 1024}
            value={sizeBytes}
            onChange={(e) => setSizeBytes(e.target.value)}
            placeholder="Size (bytes)"
            className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          />
        </div>
        {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> Register Document
        </button>
      </form>

      <div className="space-y-2">
        {docs.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
            Your vault is empty. Register private documents above.
          </div>
        ) : (
          docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
            >
              <div>
                <div className="font-medium">{doc.name}</div>
                <div className="text-xs text-[var(--muted)]">
                  {doc.category} · {doc.mimeType} · {Math.round(doc.sizeBytes / 1024)} KB
                  {doc.expiresAt ? ` · Expires ${doc.expiresAt.slice(0, 10)}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(doc.id)}
                className="rounded p-1 text-[var(--muted)] hover:text-red-500"
                aria-label="Delete document"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
