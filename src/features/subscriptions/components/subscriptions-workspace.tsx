"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Check, CreditCard, Pause, Pencil, Play, Plus, Trash2, X, XCircle } from "lucide-react";
import { formatCents, parseMoneyToCents } from "@/modules/finances/money";

interface SubscriptionItem {
  id: string;
  name: string;
  category: string;
  amountCents: number;
  monthlyEquivalentCents: number;
  billingCycle: string;
  nextBillingDate: string;
  trialEndsAt: string | null;
  status: string;
  paymentLabel: string | null;
}

export function SubscriptionsWorkspace() {
  const { t, tr } = useI18n();
  const [items, setItems] = useState<SubscriptionItem[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [annualTotal, setAnnualTotal] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [billingCycle, setBillingCycle] = useState<"weekly" | "monthly" | "quarterly" | "yearly">("monthly");
  const [nextBillingDate, setNextBillingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentLabel, setPaymentLabel] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editBillingCycle, setEditBillingCycle] = useState<"weekly" | "monthly" | "quarterly" | "yearly">("monthly");
  const [editNextBillingDate, setEditNextBillingDate] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/subscriptions");
    if (!res.ok) return;
    const json = (await res.json()) as {
      data?: {
        subscriptions: SubscriptionItem[];
        monthlyTotalCents: number;
        annualTotalCents: number;
        upcomingCount: number;
      };
    };
    setItems(json.data?.subscriptions ?? []);
    setMonthlyTotal(json.data?.monthlyTotalCents ?? 0);
    setAnnualTotal(json.data?.annualTotalCents ?? 0);
    setUpcomingCount(json.data?.upcomingCount ?? 0);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !amount.trim()) return;
    const amountCents = Math.abs(parseMoneyToCents(amount));
    if (amountCents <= 0) return;

    await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        category: category.trim(),
        amountCents,
        billingCycle,
        nextBillingDate,
        paymentLabel: paymentLabel.trim() || null,
      }),
    });
    setName("");
    setCategory("");
    setAmount("");
    setPaymentLabel("");
    await load();
  }

  function startEdit(sub: SubscriptionItem) {
    setEditingId(sub.id);
    setEditName(sub.name);
    setEditCategory(sub.category ?? "");
    setEditAmount((sub.amountCents / 100).toFixed(2).replace(".", ","));
    setEditBillingCycle(
      (sub.billingCycle as "weekly" | "monthly" | "quarterly" | "yearly") || "monthly"
    );
    setEditNextBillingDate(sub.nextBillingDate);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !editName.trim() || !editAmount.trim()) return;
    const amountCents = Math.abs(parseMoneyToCents(editAmount));
    if (amountCents <= 0) return;

    await fetch("/api/subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId,
        name: editName.trim(),
        category: editCategory.trim(),
        amountCents,
        billingCycle: editBillingCycle,
        nextBillingDate: editNextBillingDate,
      }),
    });
    setEditingId(null);
    await load();
  }

  async function setStatus(id: string, status: "active" | "paused" | "cancelled") {
    await fetch("/api/subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <CreditCard className="h-6 w-6 text-[var(--accent)]" />
          {t("subs.title")}
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("subs.subtitle")}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs text-[var(--muted-foreground)]">{tr("Equivalent Monthly Cost", "Custo Mensal Equivalente")}</div>
          <div className="mt-1 text-2xl font-bold">{formatCents(monthlyTotal, "BRL")}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs text-[var(--muted-foreground)]">{tr("Estimated Annual Cost", "Custo Anual Estimado")}</div>
          <div className="mt-1 text-2xl font-bold">{formatCents(annualTotal, "BRL")}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs text-[var(--muted-foreground)]">{tr("Charges in the next 7 days", "Cobranças nos próximos 7 dias")}</div>
          <div className="mt-1 text-2xl font-bold">{upcomingCount}</div>
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-3 lg:grid-cols-6"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={tr("Service (e.g. Spotify)", "Serviço (ex: Spotify)")}
          className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          required
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder={tr("Category", "Categoria")}
          className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={tr("Amount (e.g. 39.90)", "Valor (ex: 39,90)")}
          className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          required
        />
        <select
          value={billingCycle}
          onChange={(e) =>
            setBillingCycle(e.target.value as "weekly" | "monthly" | "quarterly" | "yearly")
          }
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          <option value="monthly">{tr("Monthly", "Mensal")}</option>
          <option value="yearly">{tr("Yearly", "Anual")}</option>
          <option value="quarterly">{tr("Quarterly", "Trimestral")}</option>
          <option value="weekly">{tr("Weekly", "Semanal")}</option>
        </select>
        <input
          type="date"
          value={nextBillingDate}
          onChange={(e) => setNextBillingDate(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> {tr("Add", "Adicionar")}
        </button>
      </form>

      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted-foreground)]">
            {tr("No subscriptions added yet.", "Nenhuma assinatura cadastrada ainda.")}
          </div>
        ) : (
          items.map((sub) =>
            editingId === sub.id ? (
              <form
                key={sub.id}
                onSubmit={saveEdit}
                className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--accent)] bg-[var(--surface)] p-4 text-sm sm:grid-cols-3 lg:grid-cols-6"
              >
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={tr("Service", "Serviço")}
                  className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm"
                  required
                />
                <input
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  placeholder={tr("Category", "Categoria")}
                  className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm"
                />
                <input
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder={tr("Amount", "Valor")}
                  className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm"
                  required
                />
                <select
                  value={editBillingCycle}
                  onChange={(e) =>
                    setEditBillingCycle(
                      e.target.value as "weekly" | "monthly" | "quarterly" | "yearly"
                    )
                  }
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
                >
                  <option value="monthly">{tr("Monthly", "Mensal")}</option>
                  <option value="yearly">{tr("Yearly", "Anual")}</option>
                  <option value="quarterly">{tr("Quarterly", "Trimestral")}</option>
                  <option value="weekly">{tr("Weekly", "Semanal")}</option>
                </select>
                <input
                  type="date"
                  value={editNextBillingDate}
                  onChange={(e) => setEditNextBillingDate(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm"
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="submit"
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white"
                  >
                    <Check className="h-3.5 w-3.5" /> {tr("Save", "Salvar")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg border border-[var(--border)] p-1.5 text-xs"
                    title={tr("Cancel", "Cancelar")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            ) : (
            <div
              key={sub.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => startEdit(sub)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    startEdit(sub);
                  }
                }}
                className="cursor-pointer flex-1 min-w-0"
                title={tr("Click to edit", "Clique para editar")}
              >
                <div className="flex items-center gap-2 font-medium">
                  <span>{sub.name}</span>
                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] capitalize">
                    {sub.status}
                  </span>
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {sub.category ? `${sub.category} · ` : ""}{formatCents(sub.amountCents, "BRL")} ({sub.billingCycle}) · {tr("Next:", "Próx.")}{" "}
                  {sub.nextBillingDate}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => startEdit(sub)}
                  className="rounded border border-[var(--border)] p-1.5 text-xs"
                  title={tr("Edit", "Editar")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {sub.status !== "active" ? (
                  <button
                    type="button"
                    onClick={() => void setStatus(sub.id, "active")}
                    className="rounded border border-[var(--border)] p-1.5 text-xs"
                    title={tr("Reactivate", "Reativar")}
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void setStatus(sub.id, "paused")}
                    className="rounded border border-[var(--border)] p-1.5 text-xs"
                    title={tr("Pause", "Pausar")}
                  >
                    <Pause className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void setStatus(sub.id, "cancelled")}
                  className="rounded border border-[var(--border)] p-1.5 text-xs text-amber-500"
                  title={tr("Cancel", "Cancelar")}
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch(`/api/subscriptions?id=${encodeURIComponent(sub.id)}`, {
                      method: "DELETE",
                    });
                    await load();
                  }}
                  className="rounded border border-[var(--border)] p-1.5 text-xs text-red-500"
                  title={tr("Delete", "Excluir")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            )
          )
        )}
      </div>
    </div>
  );
}
