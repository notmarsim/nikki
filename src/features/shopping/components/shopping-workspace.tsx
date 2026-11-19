"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Copy, Plus, ShoppingBag, Sparkles, Wallet } from "lucide-react";
import { formatCents, parseMoneyToCents } from "@/modules/finances/money";

interface ShoppingList {
  id: string;
  name: string;
  category: string;
  status: string;
  totalEstimatedCents: number;
  totalActualCents: number;
  linkedTransactionId: string | null;
}

interface ShoppingItem {
  id: string;
  listId: string;
  name: string;
  category: string;
  quantity: string;
  unit: string;
  estimatedPriceCents: number;
  actualPriceCents: number;
  isPurchased: boolean;
}

interface Suggestion {
  name: string;
  category: string;
  count: number;
  avgEst: number;
}

export function ShoppingWorkspace() {
  const { t, tr } = useI18n();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [newListName, setNewListName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemEst, setNewItemEst] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/shopping");
    if (!res.ok) return;
    const json = (await res.json()) as {
      data?: {
        lists: ShoppingList[];
        items: ShoppingItem[];
        suggestions: Suggestion[];
        accounts: Array<{ id: string; name: string }>;
      };
    };
    const d = json.data;
    if (!d) return;
    setLists(d.lists);
    setItems(d.items);
    setSuggestions(d.suggestions);
    setAccounts(d.accounts);
    if (!selectedListId && d.lists[0]) setSelectedListId(d.lists[0].id);
    if (!selectedAccountId && d.accounts[0]) setSelectedAccountId(d.accounts[0].id);
  }, [selectedListId, selectedAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function postAction(payload: Record<string, unknown>) {
    const res = await fetch("/api/shopping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { error?: { message?: string } };
    if (!res.ok) {
      setFeedback(json.error?.message ?? "Operation failed");
    } else {
      setFeedback(null);
    }
    await load();
  }

  const activeList = lists.find((l) => l.id === selectedListId) ?? null;
  const listItems = items.filter((i) => i.listId === selectedListId);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ShoppingBag className="h-6 w-6 text-[var(--accent)]" />
            {t("shopping.title")}
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("shopping.subtitle")}
          </p>
        </div>
        {feedback && <span className="text-xs text-amber-500">{feedback}</span>}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newListName.trim()) return;
              await postAction({ action: "create_list", name: newListName.trim() });
              setNewListName("");
            }}
            className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <h2 className="text-sm font-semibold">{tr("New List", "Nova Lista")}</h2>
            <input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder={tr("e.g. Monthly Groceries", "Ex: Mercado do Mês")}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              required
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> {tr("Create List", "Criar Lista")}
            </button>
          </form>

          <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-semibold">{tr("Your Lists", "Suas Listas")} ({lists.length})</h2>
            {lists.map((l) => (
              <div
                key={l.id}
                className={`flex items-center justify-between rounded-lg border p-2.5 text-sm ${
                  selectedListId === l.id
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedListId(l.id)}
                  className="flex-1 text-left"
                >
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {tr("Est:", "Est:")} {formatCents(l.totalEstimatedCents, "BRL")} · {tr("Actual:", "Real:")}{" "}
                    {formatCents(l.totalActualCents, "BRL")}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => void postAction({ action: "duplicate_list", listId: l.id })}
                  className="rounded p-1 text-xs"
                  title={tr("Duplicate list", "Duplicar lista")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {activeList ? (
            <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                <div>
                  <h2 className="text-lg font-semibold">{activeList.name}</h2>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {tr("Estimated:", "Estimado:")} {formatCents(activeList.totalEstimatedCents, "BRL")} · {tr("Purchased:", "Comprado:")}{" "}
                    {formatCents(activeList.totalActualCents, "BRL")}
                  </div>
                </div>
                {!activeList.linkedTransactionId && accounts.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(tr("Record this shopping total as an expense in Finances?", "Registrar o total desta compra como despesa em Finanças?"))) return;
                        void postAction({
                          action: "log_finances",
                          listId: activeList.id,
                          accountId: selectedAccountId,
                        });
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white"
                    >
                      <Wallet className="h-3.5 w-3.5" /> {tr("Log to Finances", "Registrar em Finanças")}
                    </button>
                  </div>
                )}
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newItemName.trim()) return;
                  const estCents = newItemEst.trim() ? Math.abs(parseMoneyToCents(newItemEst)) : 0;
                  await postAction({
                    action: "add_item",
                    listId: activeList.id,
                    name: newItemName.trim(),
                    estimatedPriceCents: estCents,
                  });
                  setNewItemName("");
                  setNewItemEst("");
                }}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={tr("Add item...", "Adicionar item...")}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                  required
                />
                <input
                  value={newItemEst}
                  onChange={(e) => setNewItemEst(e.target.value)}
                  placeholder={tr("Est. price (e.g. 15.00)", "Preço est. (ex: 15,00)")}
                  className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm sm:w-40"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                >
                  {tr("Add", "Adicionar")}
                </button>
              </form>

              {suggestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="inline-flex items-center gap-1 text-[var(--muted-foreground)]">
                    <Sparkles className="h-3.5 w-3.5" /> {tr("Frequent suggestions:", "Sugestões frequentes:")}
                  </span>
                  {suggestions.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() =>
                        void postAction({
                          action: "add_item",
                          listId: activeList.id,
                          name: s.name,
                          category: s.category,
                          estimatedPriceCents: s.avgEst,
                        })
                      }
                      className="rounded-full border border-[var(--border)] px-2.5 py-0.5 hover:border-[var(--accent)]"
                    >
                      + {s.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {listItems.map((it) => (
                  <label
                    key={it.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={it.isPurchased}
                        onChange={async (e) => {
                          await fetch("/api/shopping", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              itemId: it.id,
                              isPurchased: e.target.checked,
                            }),
                          });
                          await load();
                        }}
                      />
                      <span className={it.isPurchased ? "line-through opacity-60" : ""}>{it.name}</span>
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {formatCents(it.estimatedPriceCents, "BRL")}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted-foreground)]">
              {tr("Create or select a shopping list.", "Crie ou selecione uma lista de compras.")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
