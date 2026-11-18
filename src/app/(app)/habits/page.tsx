import { getCurrentSession } from "@/modules/auth/session";
import { getHabitsOverview } from "@/modules/habits/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";
import { HabitsWorkspace } from "@/features/habits/components/habits-workspace";

export default async function HabitsPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const todayStr = new Date().toISOString().slice(0, 10);
  const data = await getHabitsOverview(session.user.id, workspace.id, todayStr);

  return <HabitsWorkspace initialData={data} />;
}
