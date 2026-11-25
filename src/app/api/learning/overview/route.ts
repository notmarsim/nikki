import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import { getLearningKnowledgeOverview } from "@/modules/learning/integration-service";
import { getLearningOverview } from "@/modules/learning/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const [overview, knowledgeOverview] = await Promise.all([
    getLearningOverview(session.user.id, workspace.id),
    getLearningKnowledgeOverview(session.user.id, workspace.id),
  ]);
  return apiOk({ ...overview, knowledgeOverview });
}
