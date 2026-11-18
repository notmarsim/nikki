import { Suspense } from "react";
import { getCurrentSession } from "@/modules/auth/session";
import { getFocusOverview } from "@/modules/focus/service";
import { getLearningOverview } from "@/modules/learning/service";
import { listProjects } from "@/modules/projects/service";
import { listTasks } from "@/modules/tasks/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";
import { FocusWorkspace } from "@/features/focus/components/focus-workspace";

export default async function FocusPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const [overview, tasks, projects, learning] = await Promise.all([
    getFocusOverview(session.user.id),
    listTasks(session.user.id, workspace.id),
    listProjects(session.user.id, workspace.id),
    getLearningOverview(session.user.id, workspace.id),
  ]);

  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading focus timer...</div>}>
      <FocusWorkspace
        initialOverview={{
          ...overview,
          activeSession: overview.activeSession
            ? {
                ...overview.activeSession,
                mode: overview.activeSession.mode as "pomodoro" | "stopwatch",
                status: overview.activeSession.status as "running" | "paused",
                intervals: overview.activeSession.intervals.map((i) => ({
                  ...i,
                  startedAt: i.startedAt.toISOString(),
                  endedAt: i.endedAt ? i.endedAt.toISOString() : null,
                })),
              }
            : null,
          recentSessions: overview.recentSessions.map((s) => ({
            ...s,
            startedAt: s.startedAt.toISOString(),
          })),
        }}
        tasks={tasks}
        projects={projects}
        courses={learning.courses.map((c) => ({ id: c.id, title: c.title }))}
      />
    </Suspense>
  );
}
