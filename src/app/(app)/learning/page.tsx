import { getCurrentSession } from "@/modules/auth/session";
import { getLearningOverview } from "@/modules/learning/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";
import { LearningWorkspace } from "@/features/learning/components/learning-workspace";

export default async function LearningPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const overview = await getLearningOverview(session.user.id, workspace.id);

  return <LearningWorkspace initialOverview={overview} />;
}
