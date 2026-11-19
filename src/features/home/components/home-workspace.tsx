"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckSquare, Home, Package, Plus, ShoppingCart, Utensils } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";

interface HomeOverview {
  lists: Array<{ id: string; name: string }>;
  items: Array<{ id: string; listId: string; name: string; quantity: string; unit: string; checked: boolean }>;
  inventory: Array<{ id: string; name: string; quantity: number; minQuantity: number; unit: string }>;
  recipes: Array<{ id: string; name: string; instructions: string }>;
  meals: Array<{ id: string; planDate: string; mealSlot: string; title: string }>;
}

export function HomeWorkspace() {
  const { tr } = useI18n();
  const [data, setData] = useState<HomeOverview>({
    lists: [],
    items: [],
    inventory: [],
    recipes: [],
    meals: [],
  });
  const [tab, setTab] = useState<"shopping" | "pantry" | "meals" | "recipes">("shopping");
  const [listName, setListName] = useState("");
  const [selectedListId, setSelectedListId] = useState("");
  const [itemName, setItemName] = useState("");
  const [pantryName, setPantryName] = useState("");
  const [pantryQty, setPantryQty] = useState("1");
  const [pantryMin, setPantryMin] = useState("1");
  const [mealTitle, setMealTitle] = useState("");
  const [mealDate, setMealDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mealSlot, setMealSlot] = useState("lunch");
  const [recipeName, setRecipeName] = useState("");
  const [recipeInstructions, setRecipeInstructions] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/home");
    if (!res.ok) return;
    const json = (await res.json()) as { data?: HomeOverview };
    if (json.data) {
      setData(json.data);
      if (!selectedListId && json.data.lists[0]) {
        setSelectedListId(json.data.lists[0].id);
      }
    }
  }, [selectedListId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function postAction(payload: Record<string, unknown>) {
    await fetch("/api/home", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await load();
  }

  async function toggleItem(id: string, checked: boolean) {
    await fetch("/api/home", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, checked }),
    });
    await load();
  }

  const lowStock = data.inventory.filter((i) => i.quantity <= i.minQuantity);

  const mealSlotLabel = (slot: string) => {
    switch (slot) {
      case "breakfast":
        return tr("Breakfast", "Café da manhã");
      case "lunch":
        return tr("Lunch", "Almoço");
      case "dinner":
        return tr("Dinner", "Jantar");
      case "snack":
        return tr("Snack", "Lanche");
      default:
        return slot;
    }
  };

  const tabs = [
    { id: "shopping" as const, label: tr("Shopping Lists", "Listas de Compras"), Icon: ShoppingCart },
    { id: "pantry" as const, label: tr("Pantry", "Despensa"), Icon: Package },
    { id: "meals" as const, label: tr("Meal Plan", "Plano de Refeições"), Icon: Utensils },
    { id: "recipes" as const, label: tr("Recipes", "Receitas"), Icon: CheckSquare },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Home className="h-6 w-6 text-[var(--accent)]" />
            {tr("Nikki Home", "Nikki Casa")}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {tr(
              "Shared shopping lists, pantry inventory alerts, recipes, and weekly meal planning.",
              "Listas de compras compartilhadas, alertas de despensa, receitas e planejamento semanal de refeições."
            )}
          </p>
        </div>
        {lowStock.length > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />{" "}
            {tr(`${lowStock.length} low-stock item(s)`, `${lowStock.length} item(ns) com estoque baixo`)}
          </div>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${
              tab === id ? "border-[var(--accent)] bg-[var(--accent)]/15" : "border-[var(--border)]"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "shopping" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!listName.trim()) return;
              await postAction({ action: "list", name: listName.trim() });
              setListName("");
            }}
            className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <h2 className="text-sm font-semibold">{tr("New Shopping List", "Nova Lista de Compras")}</h2>
            <input
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder={tr("e.g. Weekly Groceries", "ex: Compras da Semana")}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              required
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> {tr("Create List", "Criar Lista")}
            </button>
            <div className="space-y-1.5 pt-2">
              {data.lists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedListId(l.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedListId === l.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)]"
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </form>

          <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:col-span-2">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!selectedListId || !itemName.trim()) return;
                await postAction({ action: "item", listId: selectedListId, name: itemName.trim() });
                setItemName("");
              }}
              className="flex gap-2"
            >
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder={
                  selectedListId
                    ? tr("Add item to list...", "Adicionar item à lista...")
                    : tr("Create or select a list first", "Crie ou selecione uma lista primeiro")
                }
                disabled={!selectedListId}
                className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={!selectedListId}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {tr("Add", "Adicionar")}
              </button>
            </form>

            <div className="space-y-2">
              {data.items
                .filter((i) => !selectedListId || i.listId === selectedListId)
                .map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => toggleItem(item.id, e.target.checked)}
                      />
                      <span className={item.checked ? "line-through opacity-60" : ""}>{item.name}</span>
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {item.quantity} {item.unit}
                    </span>
                  </label>
                ))}
            </div>
          </div>
        </div>
      )}

      {tab === "pantry" && (
        <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!pantryName.trim()) return;
              await postAction({
                action: "inventory",
                name: pantryName.trim(),
                quantity: Number(pantryQty) || 0,
                minQuantity: Number(pantryMin) || 0,
              });
              setPantryName("");
            }}
            className="grid grid-cols-1 gap-2 sm:grid-cols-4"
          >
            <input
              value={pantryName}
              onChange={(e) => setPantryName(e.target.value)}
              placeholder={tr("Item (e.g. Rice, Coffee)", "Item (ex: Arroz, Café)")}
              className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm sm:col-span-2"
              required
            />
            <input
              type="number"
              min={0}
              value={pantryQty}
              onChange={(e) => setPantryQty(e.target.value)}
              placeholder={tr("Qty", "Qtd")}
              className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
            >
              {tr("Add to Pantry", "Adicionar à Despensa")}
            </button>
          </form>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.inventory.map((inv) => {
              const isLow = inv.quantity <= inv.minQuantity;
              return (
                <div
                  key={inv.id}
                  className={`rounded-lg border p-3 text-sm ${
                    isLow ? "border-amber-500/60 bg-amber-500/5" : "border-[var(--border)]"
                  }`}
                >
                  <div className="font-medium">{inv.name}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {tr("Stock:", "Estoque:")} {inv.quantity} {inv.unit} ({tr("min", "mín")} {inv.minQuantity})
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "meals" && (
        <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!mealTitle.trim()) return;
              await postAction({
                action: "meal",
                planDate: mealDate,
                mealSlot,
                title: mealTitle.trim(),
              });
              setMealTitle("");
            }}
            className="grid grid-cols-1 gap-2 sm:grid-cols-4"
          >
            <input
              type="date"
              value={mealDate}
              onChange={(e) => setMealDate(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            />
            <select
              value={mealSlot}
              onChange={(e) => setMealSlot(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <option value="breakfast">{tr("Breakfast", "Café da manhã")}</option>
              <option value="lunch">{tr("Lunch", "Almoço")}</option>
              <option value="dinner">{tr("Dinner", "Jantar")}</option>
              <option value="snack">{tr("Snack", "Lanche")}</option>
            </select>
            <input
              value={mealTitle}
              onChange={(e) => setMealTitle(e.target.value)}
              placeholder={tr("Meal title", "Nome da refeição")}
              className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
            >
              {tr("Plan Meal", "Planejar Refeição")}
            </button>
          </form>

          <div className="space-y-2">
            {data.meals.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              >
                <span className="font-medium">{m.title}</span>
                <span className="text-xs text-[var(--muted)]">
                  {m.planDate} · {mealSlotLabel(m.mealSlot)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "recipes" && (
        <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!recipeName.trim()) return;
              await postAction({
                action: "recipe",
                name: recipeName.trim(),
                instructions: recipeInstructions.trim(),
                ingredients: [],
              });
              setRecipeName("");
              setRecipeInstructions("");
            }}
            className="space-y-2"
          >
            <input
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              placeholder={tr("Recipe name", "Nome da receita")}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              required
            />
            <textarea
              rows={3}
              value={recipeInstructions}
              onChange={(e) => setRecipeInstructions(e.target.value)}
              placeholder={tr("Preparation instructions...", "Instruções de preparo...")}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent p-3 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              {tr("Save Recipe", "Salvar Receita")}
            </button>
          </form>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.recipes.map((r) => (
              <div key={r.id} className="rounded-lg border border-[var(--border)] p-3 text-sm">
                <div className="font-semibold">{r.name}</div>
                <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--muted)]">
                  {r.instructions || tr("No instructions provided.", "Nenhuma instrução fornecida.")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
