import { getCurrentSession } from "@/modules/auth/session";
import { listInboxItems } from "@/modules/inbox/service";
import { listProjects } from "@/modules/projects/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";
import { InboxWorkspace } from "@/features/inbox/components/inbox-workspace";

export default async function InboxPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const [items, projects] = await Promise.all([
    listInboxItems(session.user.id, workspace.id),
    listProjects(session.user.id, workspace.id),
  ]);

  return <InboxWorkspace initialItems={items} projects={projects} />;
}
