import { getCurrentSession } from "@/modules/auth/session";
import { getDashboardData } from "@/modules/dashboard/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const data = await getDashboardData(session.user.id, workspace.id);

  return (
    <DashboardView
      userName={session.user.name}
      timezone={session.user.timezone}
      initialData={data}
    />
  );
}
