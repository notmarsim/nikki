import { apiError, apiOk } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentSession } from "@/modules/auth/session";
import {
  DeveloperHubError,
  listGithubRepositories,
} from "@/modules/developer-hub/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const rl = checkRateLimit(`github-repos:${session.user.id}`, 30, 60_000);
  if (!rl.allowed) {
    return apiError(429, "RATE_LIMITED", "Too many requests");
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    const repositories = await listGithubRepositories(session.user.id, workspace.id);
    return apiOk({ repositories });
  } catch (error) {
    if (error instanceof DeveloperHubError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(502, "GITHUB_ERROR", "Failed to fetch repositories");
  }
}
