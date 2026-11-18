import { cookies } from "next/headers";
import { apiOk } from "@/lib/api-response";
import {
  clearSessionCookie,
  deleteSessionByToken,
  SESSION_COOKIE_NAME,
} from "@/modules/auth/session";

export async function POST() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    await deleteSessionByToken(rawToken);
  }
  await clearSessionCookie();

  return apiOk({ loggedOut: true });
}
