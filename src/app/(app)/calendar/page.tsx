import { getCurrentSession } from "@/modules/auth/session";
import { listTasks } from "@/modules/tasks/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";
import { CalendarWorkspace } from "@/features/calendar/components/calendar-workspace";

export default async function CalendarPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const tasks = await listTasks(session.user.id, workspace.id);

  return <CalendarWorkspace tasks={tasks} timezone={session.user.timezone || "UTC"} />;
}
