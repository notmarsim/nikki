import { Suspense } from "react";
import { getCurrentSession } from "@/modules/auth/session";
import { listProjects } from "@/modules/projects/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";
import { ProjectsWorkspace } from "@/features/projects/components/projects-workspace";

export default async function ProjectsPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const projects = await listProjects(session.user.id, workspace.id);

  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading projects...</div>}>
      <ProjectsWorkspace initialProjects={projects} />
    </Suspense>
  );
}
