import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  addSmartShoppingItem,
  createSmartShoppingList,
  deleteSmartShoppingItem,
  deleteSmartShoppingList,
  duplicateSmartShoppingList,
  getSmartShoppingOverview,
  logShoppingListToFinances,
  toggleSmartShoppingItem,
} from "@/modules/shopping/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_list"),
    name: z.string().trim().min(1).max(120),
    description: z.string().max(300).nullable().optional(),
    category: z.string().max(40).optional(),
  }),
  z.object({ action: z.literal("duplicate_list"), listId: z.string().uuid() }),
  z.object({
    action: z.literal("add_item"),
    listId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    category: z.string().max(40).optional(),
    quantity: z.string().max(20).optional(),
    unit: z.string().max(20).optional(),
    estimatedPriceCents: z.number().int().min(0).optional(),
  }),
  z.object({
    action: z.literal("log_finances"),
    listId: z.string().uuid(),
    accountId: z.string().uuid(),
  }),
]);

const patchSchema = z.object({
  itemId: z.string().uuid(),
  isPurchased: z.boolean(),
  actualPriceCents: z.number().int().min(0).optional(),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await getSmartShoppingOverview(session.user.id, workspace.id);
  return apiOk(data);
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Invalid shopping payload");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const d = parsed.data;

  try {
    if (d.action === "create_list") {
      const list = await createSmartShoppingList(session.user.id, workspace.id, d);
      return apiOk({ list }, 201);
    }
    if (d.action === "duplicate_list") {
      const list = await duplicateSmartShoppingList(session.user.id, workspace.id, d.listId);
      return apiOk({ list }, 201);
    }
    if (d.action === "add_item") {
      const item = await addSmartShoppingItem(session.user.id, d);
      return apiOk({ item }, 201);
    }
    const tx = await logShoppingListToFinances(session.user.id, workspace.id, d.listId, d.accountId);
    return apiOk(tx, 201);
  } catch (err) {
    return apiError(400, "SHOPPING_ERROR", err instanceof Error ? err.message : "Operation failed");
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Invalid item update");

  const item = await toggleSmartShoppingItem(
    session.user.id,
    parsed.data.itemId,
    parsed.data.isPurchased,
    parsed.data.actualPriceCents
  );
  return apiOk({ item });
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { searchParams } = new URL(request.url);
  const listId = searchParams.get("listId");
  const itemId = searchParams.get("itemId");

  if (itemId) {
    return apiOk(await deleteSmartShoppingItem(session.user.id, itemId));
  }
  if (listId) {
    return apiOk(await deleteSmartShoppingList(session.user.id, listId));
  }
  return apiError(400, "VALIDATION_ERROR", "listId or itemId required");
}
