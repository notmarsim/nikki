import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { getGlobalGraph } from "@/modules/graph/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";
import { KnowledgeGraphWorkspace } from "@/features/knowledge-graph/components/knowledge-graph-workspace";

export default async function KnowledgeGraphPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const initialGraph = await getGlobalGraph({
    userId: session.user.id,
    workspaceId: workspace.id,
    limit: 300,
  });

  return <KnowledgeGraphWorkspace initialGraph={initialGraph} />;
}
