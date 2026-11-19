import { and, desc, eq } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  financeAccounts,
  financeTransactions,
  smartShoppingItems,
  smartShoppingLists,
} from "@/db/schema";

export async function getSmartShoppingOverview(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    const [lists, items, accounts] = await Promise.all([
      tx
        .select()
        .from(smartShoppingLists)
        .where(eq(smartShoppingLists.workspaceId, workspaceId))
        .orderBy(desc(smartShoppingLists.updatedAt)),
      tx
        .select()
        .from(smartShoppingItems)
        .where(eq(smartShoppingItems.userId, userId))
        .orderBy(desc(smartShoppingItems.createdAt)),
      tx
        .select({ id: financeAccounts.id, name: financeAccounts.name })
        .from(financeAccounts)
        .where(
          and(
            eq(financeAccounts.userId, userId),
            eq(financeAccounts.workspaceId, workspaceId),
            eq(financeAccounts.status, "active")
          )
        ),
    ]);

    // Local frequency-based smart item suggestions (zero AI)
    const freq = new Map<string, { name: string; category: string; count: number; avgEst: number }>();
    for (const it of items) {
      const key = it.name.trim().toLowerCase();
      const prev = freq.get(key);
      if (!prev) {
        freq.set(key, {
          name: it.name,
          category: it.category,
          count: 1,
          avgEst: it.estimatedPriceCents,
        });
      } else {
        prev.count++;
        prev.avgEst = Math.round((prev.avgEst + it.estimatedPriceCents) / 2);
      }
    }

    const suggestions = Array.from(freq.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return { lists, items, suggestions, accounts };
  });
}

export async function createSmartShoppingList(
  userId: string,
  workspaceId: string,
  input: { name: string; description?: string | null; category?: string }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(smartShoppingLists)
      .values({
        userId,
        workspaceId,
        name: input.name,
        description: input.description ?? null,
        category: input.category ?? "Groceries",
      })
      .returning();
    return created!;
  });
}

export async function duplicateSmartShoppingList(
  userId: string,
  workspaceId: string,
  listId: string
) {
  return withUserRls(userId, async (tx) => {
    const [orig] = await tx
      .select()
      .from(smartShoppingLists)
      .where(and(eq(smartShoppingLists.id, listId), eq(smartShoppingLists.workspaceId, workspaceId)))
      .limit(1);
    if (!orig) throw new Error("Shopping list not found");

    const origItems = await tx
      .select()
      .from(smartShoppingItems)
      .where(eq(smartShoppingItems.listId, orig.id));

    const [copy] = await tx
      .insert(smartShoppingLists)
      .values({
        userId,
        workspaceId,
        name: `${orig.name} (Copy)`,
        description: orig.description,
        category: orig.category,
        totalEstimatedCents: orig.totalEstimatedCents,
      })
      .returning();

    if (origItems.length > 0) {
      await tx.insert(smartShoppingItems).values(
        origItems.map((it) => ({
          userId,
          listId: copy!.id,
          name: it.name,
          category: it.category,
          quantity: it.quantity,
          unit: it.unit,
          estimatedPriceCents: it.estimatedPriceCents,
          actualPriceCents: 0,
          isPurchased: false,
          notes: it.notes,
        }))
      );
    }
    return copy!;
  });
}

async function recalculateListTotalsTx(
  tx: Parameters<Parameters<typeof withUserRls>[1]>[0],
  listId: string
) {
  const rows = await tx
    .select()
    .from(smartShoppingItems)
    .where(eq(smartShoppingItems.listId, listId));
  const est = rows.reduce((s, r) => s + r.estimatedPriceCents, 0);
  const act = rows.reduce((s, r) => s + (r.isPurchased ? r.actualPriceCents || r.estimatedPriceCents : 0), 0);
  await tx
    .update(smartShoppingLists)
    .set({
      totalEstimatedCents: est,
      totalActualCents: act,
      updatedAt: new Date(),
    })
    .where(eq(smartShoppingLists.id, listId));
}

export async function addSmartShoppingItem(
  userId: string,
  input: {
    listId: string;
    name: string;
    category?: string;
    quantity?: string;
    unit?: string;
    estimatedPriceCents?: number;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [item] = await tx
      .insert(smartShoppingItems)
      .values({
        userId,
        listId: input.listId,
        name: input.name,
        category: input.category ?? "General",
        quantity: input.quantity ?? "1",
        unit: input.unit ?? "un",
        estimatedPriceCents: Math.max(0, input.estimatedPriceCents ?? 0),
      })
      .returning();
    await recalculateListTotalsTx(tx, input.listId);
    return item!;
  });
}

export async function toggleSmartShoppingItem(
  userId: string,
  itemId: string,
  isPurchased: boolean,
  actualPriceCents?: number
) {
  return withUserRls(userId, async (tx) => {
    const [updated] = await tx
      .update(smartShoppingItems)
      .set({
        isPurchased,
        ...(actualPriceCents !== undefined ? { actualPriceCents: Math.max(0, actualPriceCents) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(smartShoppingItems.id, itemId))
      .returning();
    if (updated) await recalculateListTotalsTx(tx, updated.listId);
    return updated ?? null;
  });
}

export async function logShoppingListToFinances(
  userId: string,
  workspaceId: string,
  listId: string,
  accountId: string
) {
  return withUserRls(userId, async (tx) => {
    const [list] = await tx
      .select()
      .from(smartShoppingLists)
      .where(and(eq(smartShoppingLists.id, listId), eq(smartShoppingLists.workspaceId, workspaceId)))
      .limit(1);

    if (!list) throw new Error("Shopping list not found");
    if (list.linkedTransactionId) {
      throw new Error("Purchase already logged to Finances for this list");
    }

    const amount = list.totalActualCents > 0 ? list.totalActualCents : list.totalEstimatedCents;
    if (amount <= 0) {
      throw new Error("List total must be greater than zero to log expense");
    }

    const [createdTx] = await tx
      .insert(financeTransactions)
      .values({
        userId,
        workspaceId,
        accountId,
        type: "expense",
        status: "confirmed",
        amountCents: amount,
        description: `Shopping: ${list.name}`,
        transactionDate: new Date().toISOString().slice(0, 10),
        notes: "Logged from Smart Shopping List",
      })
      .returning();

    await tx
      .update(smartShoppingLists)
      .set({
        linkedTransactionId: createdTx!.id,
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(smartShoppingLists.id, list.id));

    return { transactionId: createdTx!.id, amountCents: amount };
  });
}

export async function deleteSmartShoppingList(userId: string, listId: string) {
  return withUserRls(userId, async (tx) => {
    await tx
      .delete(smartShoppingItems)
      .where(and(eq(smartShoppingItems.listId, listId), eq(smartShoppingItems.userId, userId)));
    await tx
      .delete(smartShoppingLists)
      .where(and(eq(smartShoppingLists.id, listId), eq(smartShoppingLists.userId, userId)));
    return { deleted: true };
  });
}

export async function deleteSmartShoppingItem(userId: string, itemId: string) {
  return withUserRls(userId, async (tx) => {
    await tx
      .delete(smartShoppingItems)
      .where(and(eq(smartShoppingItems.id, itemId), eq(smartShoppingItems.userId, userId)));
    return { deleted: true };
  });
}
