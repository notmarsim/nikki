import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentSession } from "@/modules/auth/session";
import { connectGithubSchema } from "@/modules/developer-hub/schemas";
import {
  connectGithubPat,
  DeveloperHubError,
  disconnectGithub,
  getDeveloperHubOverview,
} from "@/modules/developer-hub/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const overview = await getDeveloperHubOverview(session.user.id, workspace.id);
  return apiOk({ connection: overview.githubConnection });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const rl = checkRateLimit(`github-connect:${session.user.id}`, 10, 60_000);
  if (!rl.allowed) {
    return apiError(429, "RATE_LIMITED", "Too many requests");
  }

  const body: unknown = await request.json();
  const parsed = connectGithubSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Valid GitHub personal access token is required");
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const connection = await connectGithubPat(
      session.user.id,
      workspace.id,
      parsed.data.token
    );
    return apiOk({ connection });
  } catch (error) {
    if (error instanceof DeveloperHubError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to connect GitHub");
  }
}

export async function DELETE() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const result = await disconnectGithub(session.user.id, workspace.id);
  return apiOk(result);
}
