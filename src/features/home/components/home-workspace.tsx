"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckSquare, Home, Package, Plus, ShoppingCart, Utensils } from "lucide-react";

interface HomeOverview {
  lists: Array<{ id: string; name: string }>;
  items: Array<{ id: string; listId: string; name: string; quantity: string; unit: string; checked: boolean }>;
  inventory: Array<{ id: string; name: string; quantity: number; minQuantity: number; unit: string }>;
  recipes: Array<{ id: string; name: string; instructions: string }>;
  meals: Array<{ id: string; planDate: string; mealSlot: string; title: string }>;
}

export function HomeWorkspace() {
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Home className="h-6 w-6 text-[var(--accent)]" />
            Nikki Home
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Shared shopping lists, pantry inventory alerts, recipes, and weekly meal planning.
          </p>
        </div>
        {lowStock.length > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> {lowStock.length} low-stock item(s)
          </div>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["shopping", "Shopping Lists", ShoppingCart],
            ["pantry", "Pantry", Package],
            ["meals", "Meal Plan", Utensils],
            ["recipes", "Recipes", CheckSquare],
          ] as const
        ).map(([id, label, Icon]) => (
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
            <h2 className="text-sm font-semibold">New Shopping List</h2>
            <input
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="e.g. Weekly Groceries"
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              required
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Create List
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
                placeholder={selectedListId ? "Add item to list..." : "Create or select a list first"}
                disabled={!selectedListId}
                className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={!selectedListId}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Add
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
              placeholder="Item (e.g. Rice, Coffee)"
              className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm sm:col-span-2"
              required
            />
            <input
              type="number"
              min={0}
              value={pantryQty}
              onChange={(e) => setPantryQty(e.target.value)}
              placeholder="Qty"
              className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
            >
              Add to Pantry
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
                    Stock: {inv.quantity} {inv.unit} (min {inv.minQuantity})
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
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
            <input
              value={mealTitle}
              onChange={(e) => setMealTitle(e.target.value)}
              placeholder="Meal title"
              className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
            >
              Plan Meal
            </button>
          </form>

          <div className="space-y-2">
            {data.meals.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              >
                <span className="font-medium">{m.title}</span>
                <span className="text-xs capitalize text-[var(--muted)]">
                  {m.planDate} · {m.mealSlot}
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
              placeholder="Recipe name"
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              required
            />
            <textarea
              rows={3}
              value={recipeInstructions}
              onChange={(e) => setRecipeInstructions(e.target.value)}
              placeholder="Preparation instructions..."
              className="w-full rounded-lg border border-[var(--border)] bg-transparent p-3 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Save Recipe
            </button>
          </form>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.recipes.map((r) => (
              <div key={r.id} className="rounded-lg border border-[var(--border)] p-3 text-sm">
                <div className="font-semibold">{r.name}</div>
                <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--muted)]">
                  {r.instructions || "No instructions provided."}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
