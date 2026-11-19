"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Plus, Shield, Users } from "lucide-react";

interface SpaceItem {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  spaceType: string;
  role: string;
}

interface SpaceDetails {
  space: SpaceItem;
  members: Array<{ userId: string; name: string; email: string; role: string }>;
  invitations: Array<{ id: string; email: string; role: string; expiresAt: string }>;
}

export function SpacesWorkspace() {
  const [spaces, setSpaces] = useState<SpaceItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<SpaceDetails | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [inviteTokenOut, setInviteTokenOut] = useState<string | null>(null);
  const [acceptToken, setAcceptToken] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadSpaces = useCallback(async () => {
    const res = await fetch("/api/spaces");
    if (!res.ok) return;
    const json = (await res.json()) as { data?: { spaces: SpaceItem[] } };
    const list = json.data?.spaces ?? [];
    setSpaces(list);
    if (!selectedId && list[0]) {
      setSelectedId(list[0].id);
    }
  }, [selectedId]);

  const loadDetails = useCallback(async (id: string) => {
    const res = await fetch(`/api/spaces?spaceId=${encodeURIComponent(id)}`);
    if (!res.ok) return;
    const json = (await res.json()) as { data?: SpaceDetails };
    if (json.data) setDetails(json.data);
  }, []);

  useEffect(() => {
    void loadSpaces();
  }, [loadSpaces]);

  useEffect(() => {
    if (selectedId) void loadDetails(selectedId);
  }, [selectedId, loadDetails]);

  async function handleCreateSpace(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
    });
    if (res.ok) {
      setName("");
      setDescription("");
      setStatusMsg("Shared space created.");
      await loadSpaces();
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !inviteEmail.trim()) return;
    const res = await fetch("/api/spaces/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: selectedId, email: inviteEmail.trim(), role: inviteRole }),
    });
    const json = (await res.json()) as { data?: { rawToken?: string }; error?: { message?: string } };
    if (res.ok) {
      setInviteEmail("");
      setInviteTokenOut(json.data?.rawToken ?? null);
      setStatusMsg("Invitation created. Share the one-time token securely.");
      await loadDetails(selectedId);
    } else {
      setStatusMsg(json.error?.message ?? "Failed to invite.");
    }
  }

  async function handleAcceptInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptToken.trim()) return;
    const res = await fetch("/api/spaces/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: acceptToken.trim() }),
    });
    const json = (await res.json()) as { error?: { message?: string } };
    if (res.ok) {
      setAcceptToken("");
      setStatusMsg("Joined shared space!");
      await loadSpaces();
    } else {
      setStatusMsg(json.error?.message ?? "Invalid or expired invitation token.");
    }
  }

  async function handleSwitchSpace(spaceId: string) {
    const res = await fetch("/api/spaces/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: spaceId }),
    });
    if (res.ok) {
      setStatusMsg("Active workspace switched.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Users className="h-6 w-6 text-[var(--accent)]" />
            Nikki Spaces
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Personal and shared workspaces to collaborate with family, friends, or teammates.
          </p>
        </div>
        {statusMsg && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs">
            {statusMsg}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <form
            onSubmit={handleCreateSpace}
            className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <h2 className="text-sm font-semibold">Create Shared Space</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Space name (e.g. Family, Study Group)"
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              required
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Create Space
            </button>
          </form>

          <form
            onSubmit={handleAcceptInvite}
            className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <h2 className="text-sm font-semibold">Join via Invitation Token</h2>
            <input
              value={acceptToken}
              onChange={(e) => setAcceptToken(e.target.value)}
              placeholder="Paste invite token"
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
            >
              Accept Invite
            </button>
          </form>

          <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-semibold">Your Spaces ({spaces.length})</h2>
            <div className="space-y-2">
              {spaces.map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => setSelectedId(sp.id)}
                  className={`flex w-full items-center justify-between rounded-lg border p-2.5 text-left text-sm transition ${
                    selectedId === sp.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)]"
                  }`}
                >
                  <div>
                    <div className="font-medium">{sp.name}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {sp.spaceType} · {sp.role}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {details?.space ? (
            <div className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
                <div>
                  <h2 className="text-lg font-semibold">{details.space.name}</h2>
                  <p className="text-xs text-[var(--muted)]">
                    {details.space.description || "No description"} · Your role: {details.space.role}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSwitchSpace(details.space.id)}
                  className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white"
                >
                  Set Active Workspace
                </button>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <Shield className="h-4 w-4 text-[var(--accent)]" /> Members ({details.members.length})
                </h3>
                <div className="space-y-2">
                  {details.members.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-[var(--muted)]">{m.email}</div>
                      </div>
                      <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs capitalize">
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {(details.space.role === "owner" || details.space.role === "admin") && (
                <form onSubmit={handleInvite} className="space-y-3 border-t border-[var(--border)] pt-4">
                  <h3 className="text-sm font-semibold">Invite Member</h3>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@example.com"
                      className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                      required
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as "admin" | "editor" | "viewer")}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                    >
                      Generate Invite
                    </button>
                  </div>
                  {inviteTokenOut && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-2.5 text-xs">
                      <span className="truncate font-mono">{inviteTokenOut}</span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(inviteTokenOut);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        }}
                        className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--border)] px-2 py-1"
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  )}
                </form>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
              Select a space to view members and invitations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
