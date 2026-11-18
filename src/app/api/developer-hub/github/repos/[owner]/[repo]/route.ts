import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentSession } from "@/modules/auth/session";
import {
  DeveloperHubError,
  getGithubRepositoryDetails,
} from "@/modules/developer-hub/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ owner: string; repo: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const rl = checkRateLimit(`github-detail:${session.user.id}`, 30, 60_000);
  if (!rl.allowed) {
    return apiError(429, "RATE_LIMITED", "Too many requests");
  }

  const { owner, repo } = await context.params;
  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const details = await getGithubRepositoryDetails(
      session.user.id,
      workspace.id,
      owner,
      repo
    );
    return apiOk(details);
  } catch (error) {
    if (error instanceof DeveloperHubError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(502, "GITHUB_ERROR", "Failed to load repository details");
  }
}
