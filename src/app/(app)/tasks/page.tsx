import { Suspense } from "react";
import { getCurrentSession } from "@/modules/auth/session";
import { getAllNotesForLinking } from "@/modules/notes/service";
import { listProjects } from "@/modules/projects/service";
import { listTasks } from "@/modules/tasks/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";
import { TasksWorkspace } from "@/features/tasks/components/tasks-workspace";

export default async function TasksPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const [tasks, projects, notes] = await Promise.all([
    listTasks(session.user.id, workspace.id),
    listProjects(session.user.id, workspace.id),
    getAllNotesForLinking(session.user.id, workspace.id),
  ]);

  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading tasks...</div>}>
      <TasksWorkspace initialTasks={tasks} projects={projects} notes={notes} />
    </Suspense>
  );
}
