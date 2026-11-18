import { and, asc, desc, eq } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  homeInventoryItems,
  homeMealPlans,
  homeRecipes,
  homeShoppingItems,
  homeShoppingLists,
} from "@/db/schema";

export async function getHomeOverview(userId: string, workspaceId: string) {
  return withUserRls(userId, async (tx) => {
    const [lists, items, inventory, recipes, mealPlans] = await Promise.all([
      tx
        .select()
        .from(homeShoppingLists)
        .where(eq(homeShoppingLists.workspaceId, workspaceId))
        .orderBy(desc(homeShoppingLists.createdAt)),
      tx
        .select()
        .from(homeShoppingItems)
        .orderBy(asc(homeShoppingItems.isPurchased), desc(homeShoppingItems.createdAt)),
      tx
        .select()
        .from(homeInventoryItems)
        .where(eq(homeInventoryItems.workspaceId, workspaceId))
        .orderBy(asc(homeInventoryItems.name)),
      tx
        .select()
        .from(homeRecipes)
        .where(eq(homeRecipes.workspaceId, workspaceId))
        .orderBy(desc(homeRecipes.createdAt)),
      tx
        .select()
        .from(homeMealPlans)
        .where(eq(homeMealPlans.workspaceId, workspaceId))
        .orderBy(asc(homeMealPlans.planDate)),
    ]);

    const listIds = new Set(lists.map((l) => l.id));
    const filteredItems = items.filter((i) => listIds.has(i.listId));
    const lowStockAlerts = inventory.filter((i) => i.quantity <= i.minQuantity);

    return {
      lists,
      items: filteredItems,
      inventory,
      lowStockAlerts,
      recipes,
      mealPlans,
    };
  });
}

export async function createShoppingList(
  userId: string,
  workspaceId: string,
  name: string
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(homeShoppingLists)
      .values({ userId, workspaceId, name })
      .returning();
    return created!;
  });
}

export async function addShoppingItem(
  userId: string,
  input: { listId: string; name: string; quantity?: string; unit?: string }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(homeShoppingItems)
      .values({
        userId,
        listId: input.listId,
        name: input.name,
        quantity: input.quantity ?? "1",
        unit: input.unit ?? "un",
      })
      .returning();
    return created!;
  });
}

export async function toggleShoppingItem(
  userId: string,
  itemId: string,
  isPurchased: boolean
) {
  return withUserRls(userId, async (tx) => {
    const [updated] = await tx
      .update(homeShoppingItems)
      .set({ isPurchased })
      .where(eq(homeShoppingItems.id, itemId))
      .returning();
    return updated;
  });
}

export async function createInventoryItem(
  userId: string,
  workspaceId: string,
  input: {
    name: string;
    quantity: number;
    minQuantity?: number;
    unit?: string;
    expiresAt?: string | null;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(homeInventoryItems)
      .values({
        userId,
        workspaceId,
        name: input.name,
        quantity: input.quantity,
        minQuantity: input.minQuantity ?? 1,
        unit: input.unit ?? "un",
        expiresAt: input.expiresAt ?? null,
      })
      .returning();
    return created!;
  });
}

export async function createRecipe(
  userId: string,
  workspaceId: string,
  input: {
    name: string;
    instructions: string;
    ingredients: Array<{ name: string; quantity: string; unit: string }>;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(homeRecipes)
      .values({
        userId,
        workspaceId,
        name: input.name,
        instructions: input.instructions,
        ingredients: input.ingredients,
      })
      .returning();
    return created!;
  });
}

export async function addMealPlan(
  userId: string,
  workspaceId: string,
  input: { planDate: string; mealSlot: string; title: string; recipeId?: string | null }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(homeMealPlans)
      .values({
        userId,
        workspaceId,
        planDate: input.planDate,
        mealSlot: input.mealSlot,
        title: input.title,
        recipeId: input.recipeId ?? null,
      })
      .returning();
    return created!;
  });
}

export async function generateShoppingFromRecipe(
  userId: string,
  listId: string,
  recipeId: string
) {
  return withUserRls(userId, async (tx) => {
    const [recipe] = await tx
      .select()
      .from(homeRecipes)
      .where(and(eq(homeRecipes.id, recipeId), eq(homeRecipes.userId, userId)))
      .limit(1);
    if (!recipe || recipe.ingredients.length === 0) return { added: 0 };

    await tx.insert(homeShoppingItems).values(
      recipe.ingredients.map((ing) => ({
        userId,
        listId,
        name: ing.name,
        quantity: ing.quantity || "1",
        unit: ing.unit || "un",
      }))
    );
    return { added: recipe.ingredients.length };
  });
}
