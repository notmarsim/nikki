import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { getFinanceOverview } from "@/modules/finances/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";
import { FinancesWorkspace } from "@/features/finances/components/finances-workspace";

export default async function FinancesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const initialData = await getFinanceOverview({
    userId: session.user.id,
    workspaceId: workspace.id,
  });

  return <FinancesWorkspace initialData={initialData} />;
}
