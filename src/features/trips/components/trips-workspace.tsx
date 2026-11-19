"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Calendar, CheckSquare, MapPin, Plane, Plus, Trash2 } from "lucide-react";
import { formatCents, parseMoneyToCents } from "@/modules/finances/money";

interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  budgetCents: number;
  status: string;
}

interface ItineraryItem {
  id: string;
  tripId: string;
  dayNumber: number;
  itemDate: string;
  startTime: string;
  title: string;
  location: string | null;
  estimatedCostCents: number;
  calendarEventId: string | null;
}

interface ChecklistItem {
  id: string;
  tripId: string;
  kind: string;
  title: string;
  isChecked: boolean;
}

export function TripsWorkspace() {
  const { t, tr } = useI18n();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [budget, setBudget] = useState("");
  const [actTitle, setActTitle] = useState("");
  const [actTime, setActTime] = useState("10:00");
  const [syncCalendar, setSyncCalendar] = useState(true);
  const [packTitle, setPackTitle] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/trips");
    if (!res.ok) return;
    const json = (await res.json()) as {
      data?: { trips: Trip[]; itinerary: ItineraryItem[]; checklist: ChecklistItem[] };
    };
    const d = json.data;
    if (!d) return;
    setTrips(d.trips);
    setItinerary(d.itinerary);
    setChecklist(d.checklist);
    if (!selectedTripId && d.trips[0]) setSelectedTripId(d.trips[0].id);
  }, [selectedTripId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function postAction(payload: Record<string, unknown>) {
    await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await load();
  }

  const activeTrip = trips.find((t) => t.id === selectedTripId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Plane className="h-6 w-6 text-[var(--accent)]" />
          {t("trips.title")}
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("trips.subtitle")}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim() || !destination.trim()) return;
              const budgetCents = budget.trim() ? Math.abs(parseMoneyToCents(budget)) : 0;
              await postAction({
                action: "create_trip",
                name: name.trim(),
                destination: destination.trim(),
                startDate,
                endDate,
                budgetCents,
              });
              setName("");
              setDestination("");
              setBudget("");
            }}
            className="space-y-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <h2 className="text-sm font-semibold">{tr("New Trip", "Nova Viagem")}</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr("Trip name", "Nome da viagem")}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              required
            />
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder={tr("Destination", "Destino")}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-xs"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-xs"
              />
            </div>
            <input
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder={tr("Budget (e.g. 3000.00)", "Orçamento (ex: 3000,00)")}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> {tr("Create Trip", "Criar Viagem")}
            </button>
          </form>

          <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-semibold">{tr("Trips", "Viagens")} ({trips.length})</h2>
            {trips.map((t) => (
              <div
                key={t.id}
                className={`flex items-center justify-between rounded-lg border p-2.5 text-sm ${
                  selectedTripId === t.id
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedTripId(t.id)}
                  className="flex-1 text-left"
                >
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {t.destination} · {t.startDate} → {t.endDate}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch(`/api/trips?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
                    await load();
                  }}
                  className="rounded p-1 text-xs text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {activeTrip ? (
            <div className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="border-b border-[var(--border)] pb-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[var(--accent)]" /> {activeTrip.name} —{" "}
                  {activeTrip.destination}
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {activeTrip.startDate} {tr("to", "até")} {activeTrip.endDate} · {tr("Budget:", "Orçamento:")}{" "}
                  {formatCents(activeTrip.budgetCents, "BRL")}
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Calendar className="h-4 w-4 text-[var(--accent)]" /> {tr("Itinerary", "Itinerário")}
                </h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!actTitle.trim()) return;
                    await postAction({
                      action: "add_itinerary",
                      tripId: activeTrip.id,
                      dayNumber: 1,
                      itemDate: activeTrip.startDate,
                      startTime: actTime,
                      title: actTitle.trim(),
                      syncToCalendar: syncCalendar,
                    });
                    setActTitle("");
                  }}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    value={actTitle}
                    onChange={(e) => setActTitle(e.target.value)}
                    placeholder={tr("Activity (e.g. Check-in, Tour)", "Atividade (ex: Check-in, Passeio)")}
                    className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm"
                    required
                  />
                  <input
                    type="time"
                    value={actTime}
                    onChange={(e) => setActTime(e.target.value)}
                    className="rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-sm"
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={syncCalendar}
                      onChange={(e) => setSyncCalendar(e.target.checked)}
                    />
                    Calendar
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white"
                  >
                    {tr("Add", "Adicionar")}
                  </button>
                </form>

                <div className="space-y-1.5">
                  {itinerary
                    .filter((i) => i.tripId === activeTrip.id)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
                      >
                        <span>
                          <strong>{item.startTime}</strong> · {item.title}
                        </span>
                        {item.calendarEventId && (
                          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px]">
                            {tr("In Calendar", "No Calendar")}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              <div className="space-y-3 border-t border-[var(--border)] pt-4">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <CheckSquare className="h-4 w-4 text-[var(--accent)]" /> {tr("Packing & Preparation Checklist", "Checklist de Bagagem & Preparação")}
                </h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!packTitle.trim()) return;
                    await postAction({
                      action: "add_checklist",
                      tripId: activeTrip.id,
                      kind: "packing",
                      title: packTitle.trim(),
                    });
                    setPackTitle("");
                  }}
                  className="flex gap-2"
                >
                  <input
                    value={packTitle}
                    onChange={(e) => setPackTitle(e.target.value)}
                    placeholder={tr("Packing or prep item...", "Item da bagagem ou preparo...")}
                    className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium"
                  >
                    {tr("Add", "Adicionar")}
                  </button>
                </form>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {checklist
                    .filter((c) => c.tripId === activeTrip.id)
                    .map((c) => (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-2 rounded border border-[var(--border)] px-2.5 py-1.5 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={c.isChecked}
                          onChange={(e) =>
                            void postAction({
                              action: "toggle_checklist",
                              id: c.id,
                              isChecked: e.target.checked,
                            })
                          }
                        />
                        <span className={c.isChecked ? "line-through opacity-60" : ""}>{c.title}</span>
                      </label>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted-foreground)]">
              {tr("Create or select a trip on the side.", "Crie ou selecione uma viagem ao lado.")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
