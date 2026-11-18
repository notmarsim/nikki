import { Suspense } from "react";
import { getCurrentSession } from "@/modules/auth/session";
import { listNotes } from "@/modules/notes/service";
import { listProjects } from "@/modules/projects/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";
import { NotesWorkspace } from "@/features/notes/components/notes-workspace";

export default async function NotesPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const [notes, projects] = await Promise.all([
    listNotes(session.user.id, workspace.id),
    listProjects(session.user.id, workspace.id),
  ]);

  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading notes...</div>}>
      <NotesWorkspace initialNotes={notes} projects={projects} />
    </Suspense>
  );
}
