import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { runGlobalArchiveJob } from "@/modules/archive/service";

function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return apiError(401, "UNAUTHORIZED", "Valid CRON_SECRET required");
  }
  const result = await runGlobalArchiveJob();
  return apiOk({ executedAt: new Date().toISOString(), ...result });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
