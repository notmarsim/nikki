"use client";

import { useCallback, useEffect, useState } from "react";
import { Pause, Play, Plus, Radio, Users } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";

interface FocusRoom {
  id: string;
  name: string;
  inviteCode: string;
  mode: "synchronized" | "independent";
  status: string;
  focusMinutes: number;
  cycleStartedAt: string | null;
}

interface RoomDetails {
  room: FocusRoom;
  participants: Array<{ userId: string; name: string; shareActivity: boolean }>;
}

export function FocusRoomsWorkspace() {
  const { tr } = useI18n();
  const [rooms, setRooms] = useState<FocusRoom[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<RoomDetails | null>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"synchronized" | "independent">("synchronized");
  const [focusMinutes, setFocusMinutes] = useState("25");
  const [inviteCode, setInviteCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    const res = await fetch("/api/focus-rooms");
    if (!res.ok) return;
    const json = (await res.json()) as { data?: { rooms: FocusRoom[] } };
    const list = json.data?.rooms ?? [];
    setRooms(list);
    if (!selectedId && list[0]) setSelectedId(list[0].id);
  }, [selectedId]);

  const loadDetails = useCallback(async (roomId: string) => {
    const res = await fetch(`/api/focus-rooms?roomId=${encodeURIComponent(roomId)}`);
    if (!res.ok) return;
    const json = (await res.json()) as { data?: RoomDetails };
    if (json.data) setDetails(json.data);
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (selectedId) void loadDetails(selectedId);
  }, [selectedId, loadDetails]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/focus-rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name: name.trim(),
        mode,
        focusMinutes: Math.max(5, Math.min(120, Number(focusMinutes) || 25)),
      }),
    });
    if (res.ok) {
      setName("");
      setMsg(tr("Focus room created.", "Sala de foco criada."));
      await loadRooms();
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    const res = await fetch("/api/focus-rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", inviteCode: inviteCode.trim() }),
    });
    if (res.ok) {
      setInviteCode("");
      setMsg(tr("Joined focus room.", "Você entrou na sala de foco."));
      await loadRooms();
    } else {
      setMsg(tr("Invalid invite code.", "Código de convite inválido."));
    }
  }

  async function setRoomState(status: "idle" | "running" | "paused" | "break" | "ended") {
    if (!selectedId) return;
    await fetch("/api/focus-rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "state", roomId: selectedId, status }),
    });
    await loadDetails(selectedId);
    await loadRooms();
  }

  const roomStatusLabel = (status: string) => {
    if (status === "idle") return tr("idle", "ociosa");
    if (status === "running") return tr("running", "em andamento");
    if (status === "paused") return tr("paused", "pausada");
    if (status === "break") return tr("break", "pausa");
    if (status === "ended") return tr("ended", "encerrada");
    return status;
  };

  const roomModeLabel = (roomMode: FocusRoom["mode"]) =>
    roomMode === "synchronized"
      ? tr("Synchronized", "Sincronizada")
      : tr("Independent", "Independente");

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Radio className="h-6 w-6 text-[var(--accent)]" />
            {tr("Focus Rooms", "Salas de Foco")}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {tr(
              "Shared study and co-working rooms with synchronized Pomodoro timers.",
              "Salas compartilhadas de estudo e coworking com cronômetros Pomodoro sincronizados."
            )}
          </p>
        </div>
        {msg && <span className="rounded border border-[var(--border)] px-3 py-1 text-xs">{msg}</span>}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <form
            onSubmit={handleCreate}
            className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <h2 className="text-sm font-semibold">{tr("Create Focus Room", "Criar Sala de Foco")}</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr(
                "Room name (e.g. Deep Work Sprint)",
                "Nome da sala (ex.: Sprint de Trabalho Profundo)"
              )}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "synchronized" | "independent")}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <option value="synchronized">{tr("Synchronized", "Sincronizada")}</option>
                <option value="independent">{tr("Independent", "Independente")}</option>
              </select>
              <input
                type="number"
                min={5}
                max={120}
                value={focusMinutes}
                onChange={(e) => setFocusMinutes(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> {tr("Create Room", "Criar Sala")}
            </button>
          </form>

          <form
            onSubmit={handleJoin}
            className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <h2 className="text-sm font-semibold">
              {tr("Join by Invite Code", "Entrar com Código de Convite")}
            </h2>
            <div className="flex gap-2">
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder={tr("ROOM-CODE", "CODIGO-SALA")}
                className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm uppercase"
              />
              <button
                type="submit"
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
              >
                {tr("Join", "Entrar")}
              </button>
            </div>
          </form>

          <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-semibold">
              {tr("Your Rooms", "Suas Salas")} ({rooms.length})
            </h2>
            {rooms.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={`w-full rounded-lg border p-2.5 text-left text-sm ${
                  selectedId === r.id
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border)]"
                }`}
              >
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-[var(--muted)]">
                  {tr("Code", "Código")}: {r.inviteCode} · {roomStatusLabel(r.status)}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          {details ? (
            <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-4">
                <div>
                  <h2 className="text-lg font-semibold">{details.room.name}</h2>
                  <p className="text-xs text-[var(--muted)]">
                    {tr("Invite Code:", "Código de Convite:")}{" "}
                    <span className="font-mono">{details.room.inviteCode}</span> ·{" "}
                    {roomModeLabel(details.room.mode)} · {details.room.focusMinutes} min
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRoomState("running")}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white"
                  >
                    <Play className="h-3.5 w-3.5" /> {tr("Start Cycle", "Iniciar Ciclo")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoomState("paused")}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"
                  >
                    <Pause className="h-3.5 w-3.5" /> {tr("Pause", "Pausar")}
                  </button>
                </div>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <Users className="h-4 w-4 text-[var(--accent)]" />{" "}
                  {tr("Participants", "Participantes")} ({details.participants.length})
                </h3>
                <div className="space-y-2">
                  {details.participants.map((p) => (
                    <div
                      key={p.userId}
                      className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                    >
                      <span>{p.name}</span>
                      <span className="text-xs text-[var(--muted)]">
                        {p.shareActivity
                          ? tr("Activity visible", "Atividade visível")
                          : tr("Private activity", "Atividade privada")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
              {tr(
                "Create or select a focus room to start a shared session.",
                "Crie ou selecione uma sala de foco para iniciar uma sessão compartilhada."
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
