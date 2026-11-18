import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { getAnalyticsOverview } from "@/modules/analytics/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";
import { AnalyticsWorkspace } from "@/features/analytics/components/analytics-workspace";

export default async function AnalyticsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const initialData = await getAnalyticsOverview({
    userId: session.user.id,
    workspaceId: workspace.id,
    period: "30d",
    includeFinances: true,
  });

  return <AnalyticsWorkspace initialData={initialData} />;
}
