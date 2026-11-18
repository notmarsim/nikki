import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { createAccountSchema, updateAccountSchema } from "@/modules/finances/schemas";
import {
  archiveAccount,
  createAccount,
  FinanceServiceError,
  updateAccount,
} from "@/modules/finances/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid account", parsed.error.flatten().fieldErrors);
  }

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const account = await createAccount(session.user.id, workspace.id, parsed.data);
  return apiOk({ account }, 201);
}

export async function PATCH(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const id =
    typeof body === "object" && body !== null && "id" in body
      ? String((body as { id?: unknown }).id ?? "")
      : "";
  if (!id) return apiError(400, "VALIDATION_ERROR", "Account id required");

  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid account update", parsed.error.flatten().fieldErrors);
  }

  try {
    const account = await updateAccount(session.user.id, id, parsed.data);
    return apiOk({ account });
  } catch (error) {
    if (error instanceof FinanceServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to update account");
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError(400, "VALIDATION_ERROR", "Account id required");

  try {
    const account = await archiveAccount(session.user.id, id);
    return apiOk({ account });
  } catch (error) {
    if (error instanceof FinanceServiceError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to archive account");
  }
}
