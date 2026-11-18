import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  addMealPlan,
  addShoppingItem,
  createInventoryItem,
  createRecipe,
  createShoppingList,
  generateShoppingFromRecipe,
  getHomeOverview,
  toggleShoppingItem,
} from "@/modules/home/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list"), name: z.string().trim().min(1).max(100) }),
  z.object({
    action: z.literal("item"),
    listId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    quantity: z.string().max(20).optional(),
    unit: z.string().max(20).optional(),
  }),
  z.object({
    action: z.literal("inventory"),
    name: z.string().trim().min(1).max(120),
    quantity: z.number().int().min(0),
    minQuantity: z.number().int().min(0).optional(),
    unit: z.string().max(20).optional(),
    expiresAt: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("recipe"),
    name: z.string().trim().min(1).max(120),
    instructions: z.string().max(5000).default(""),
    ingredients: z
      .array(
        z.object({
          name: z.string().trim().min(1),
          quantity: z.string().default("1"),
          unit: z.string().default("un"),
        })
      )
      .default([]),
  }),
  z.object({
    action: z.literal("meal"),
    planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mealSlot: z.string().default("lunch"),
    title: z.string().trim().min(1).max(120),
    recipeId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    action: z.literal("recipe_to_list"),
    listId: z.string().uuid(),
    recipeId: z.string().uuid(),
  }),
]);

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await getHomeOverview(session.user.id, workspace.id);
  return apiOk(data);
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid home payload");
  }

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const d = parsed.data;
  if (d.action === "list") {
    return apiOk({ list: await createShoppingList(session.user.id, workspace.id, d.name) }, 201);
  }
  if (d.action === "item") {
    return apiOk({ item: await addShoppingItem(session.user.id, d) }, 201);
  }
  if (d.action === "inventory") {
    return apiOk({ item: await createInventoryItem(session.user.id, workspace.id, d) }, 201);
  }
  if (d.action === "recipe") {
    return apiOk({ recipe: await createRecipe(session.user.id, workspace.id, d) }, 201);
  }
  if (d.action === "meal") {
    return apiOk({ meal: await addMealPlan(session.user.id, workspace.id, d) }, 201);
  }
  return apiOk(await generateShoppingFromRecipe(session.user.id, d.listId, d.recipeId));
}

export async function PATCH(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body = (await request.json()) as { itemId?: string; isPurchased?: boolean };
  if (!body.itemId || typeof body.isPurchased !== "boolean") {
    return apiError(400, "VALIDATION_ERROR", "itemId and isPurchased required");
  }
  const item = await toggleShoppingItem(session.user.id, body.itemId, body.isPurchased);
  return apiOk({ item });
}
