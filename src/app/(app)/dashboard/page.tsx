import { getCurrentSession } from "@/modules/auth/session";
import { getDashboardData } from "@/modules/dashboard/service";
import { mergeUserPreferences } from "@/modules/settings/registry";
import { getOrCreateDefaultWorkspace, getUserSettings } from "@/modules/users/service";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const [data, settings] = await Promise.all([
    getDashboardData(session.user.id, workspace.id),
    getUserSettings(session.user.id),
  ]);
  const prefs = mergeUserPreferences(settings?.preferences);
  const hiddenWidgets = prefs.showFinancialWidgetsOnDashboard
    ? prefs.hiddenDashboardWidgets
    : Array.from(new Set([...prefs.hiddenDashboardWidgets, "finances"]));

  return (
    <DashboardView
      userName={session.user.name}
      timezone={session.user.timezone}
      initialData={data}
      hiddenWidgets={hiddenWidgets}
    />
  );
}
