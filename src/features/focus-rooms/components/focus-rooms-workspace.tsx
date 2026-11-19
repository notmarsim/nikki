"use client";

import { useCallback, useEffect, useState } from "react";
import { Pause, Play, Plus, Radio, Users } from "lucide-react";

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
      setMsg("Focus room created.");
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
      setMsg("Joined focus room.");
      await loadRooms();
    } else {
      setMsg("Invalid invite code.");
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Radio className="h-6 w-6 text-[var(--accent)]" />
            Focus Rooms
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Shared study and co-working rooms with synchronized Pomodoro timers.
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
            <h2 className="text-sm font-semibold">Create Focus Room</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Room name (e.g. Deep Work Sprint)"
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "synchronized" | "independent")}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <option value="synchronized">Synchronized</option>
                <option value="independent">Independent</option>
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
              <Plus className="h-4 w-4" /> Create Room
            </button>
          </form>

          <form
            onSubmit={handleJoin}
            className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <h2 className="text-sm font-semibold">Join by Invite Code</h2>
            <div className="flex gap-2">
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="ROOM-CODE"
                className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm uppercase"
              />
              <button
                type="submit"
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
              >
                Join
              </button>
            </div>
          </form>

          <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-semibold">Your Rooms ({rooms.length})</h2>
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
                  Code: {r.inviteCode} · {r.status}
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
                    Invite Code: <span className="font-mono">{details.room.inviteCode}</span> ·{" "}
                    {details.room.mode} · {details.room.focusMinutes} min
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRoomState("running")}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white"
                  >
                    <Play className="h-3.5 w-3.5" /> Start Cycle
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoomState("paused")}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"
                  >
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </button>
                </div>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <Users className="h-4 w-4 text-[var(--accent)]" /> Participants (
                  {details.participants.length})
                </h3>
                <div className="space-y-2">
                  {details.participants.map((p) => (
                    <div
                      key={p.userId}
                      className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                    >
                      <span>{p.name}</span>
                      <span className="text-xs text-[var(--muted)]">
                        {p.shareActivity ? "Activity visible" : "Private activity"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
              Create or select a focus room to start a shared session.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
