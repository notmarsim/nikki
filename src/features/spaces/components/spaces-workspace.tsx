"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Plus, Shield, Users } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";

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
  const { tr } = useI18n();
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
      setStatusMsg(tr("Shared space created.", "Espaço compartilhado criado."));
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
      setStatusMsg(
        tr(
          "Invitation created. Share the one-time token securely.",
          "Convite criado. Compartilhe o token de uso único com segurança."
        )
      );
      await loadDetails(selectedId);
    } else {
      setStatusMsg(json.error?.message ?? tr("Failed to invite.", "Falha ao convidar."));
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
      setStatusMsg(tr("Joined shared space!", "Você entrou no espaço compartilhado!"));
      await loadSpaces();
    } else {
      setStatusMsg(
        json.error?.message ??
          tr("Invalid or expired invitation token.", "Token de convite inválido ou expirado.")
      );
    }
  }

  async function handleSwitchSpace(spaceId: string) {
    const res = await fetch("/api/spaces/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: spaceId }),
    });
    if (res.ok) {
      setStatusMsg(tr("Active workspace switched.", "Espaço ativo alterado."));
    }
  }

  const roleLabel = (role: string) => {
    switch (role) {
      case "owner":
        return tr("Owner", "Proprietário");
      case "admin":
        return tr("Admin", "Admin");
      case "editor":
        return tr("Editor", "Editor");
      case "viewer":
        return tr("Viewer", "Leitor");
      default:
        return role;
    }
  };

  const spaceTypeLabel = (spaceType: string) => {
    switch (spaceType) {
      case "personal":
        return tr("Personal", "Pessoal");
      case "shared":
        return tr("Shared", "Compartilhado");
      default:
        return spaceType;
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Users className="h-6 w-6 text-[var(--accent)]" />
            {tr("Nikki Spaces", "Nikki Espaços")}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {tr(
              "Personal and shared workspaces to collaborate with family, friends, or teammates.",
              "Espaços pessoais e compartilhados para colaborar com família, amigos ou colegas de equipe."
            )}
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
            <h2 className="text-sm font-semibold">
              {tr("Create Shared Space", "Criar Espaço Compartilhado")}
            </h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr(
                "Space name (e.g. Family, Study Group)",
                "Nome do espaço (ex: Família, Grupo de Estudos)"
              )}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              required
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr("Optional description", "Descrição opcional")}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> {tr("Create Space", "Criar Espaço")}
            </button>
          </form>

          <form
            onSubmit={handleAcceptInvite}
            className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <h2 className="text-sm font-semibold">
              {tr("Join via Invitation Token", "Entrar com Token de Convite")}
            </h2>
            <input
              value={acceptToken}
              onChange={(e) => setAcceptToken(e.target.value)}
              placeholder={tr("Paste invite token", "Cole o token de convite")}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
            >
              {tr("Accept Invite", "Aceitar Convite")}
            </button>
          </form>

          <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-semibold">
              {tr("Your Spaces", "Seus Espaços")} ({spaces.length})
            </h2>
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
                      {spaceTypeLabel(sp.spaceType)} · {roleLabel(sp.role)}
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
                    {details.space.description || tr("No description", "Sem descrição")} ·{" "}
                    {tr("Your role:", "Seu papel:")} {roleLabel(details.space.role)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSwitchSpace(details.space.id)}
                  className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white"
                >
                  {tr("Set Active Workspace", "Definir como Espaço Ativo")}
                </button>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <Shield className="h-4 w-4 text-[var(--accent)]" /> {tr("Members", "Membros")} (
                  {details.members.length})
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
                      <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs">
                        {roleLabel(m.role)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {(details.space.role === "owner" || details.space.role === "admin") && (
                <form onSubmit={handleInvite} className="space-y-3 border-t border-[var(--border)] pt-4">
                  <h3 className="text-sm font-semibold">{tr("Invite Member", "Convidar Membro")}</h3>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder={tr("colleague@example.com", "colega@exemplo.com")}
                      className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                      required
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as "admin" | "editor" | "viewer")}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    >
                      <option value="editor">{tr("Editor", "Editor")}</option>
                      <option value="viewer">{tr("Viewer", "Leitor")}</option>
                      <option value="admin">{tr("Admin", "Admin")}</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                    >
                      {tr("Generate Invite", "Gerar Convite")}
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
                        {copied ? tr("Copied", "Copiado") : tr("Copy", "Copiar")}
                      </button>
                    </div>
                  )}
                </form>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
              {tr(
                "Select a space to view members and invitations.",
                "Selecione um espaço para ver membros e convites."
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
