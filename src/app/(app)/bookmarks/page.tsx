import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { listBookmarks } from "@/modules/bookmarks/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";
import { BookmarksWorkspace } from "@/features/bookmarks/components/bookmarks-workspace";

export default async function BookmarksPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const initialData = await listBookmarks({
    userId: session.user.id,
    workspaceId: workspace.id,
  });

  return <BookmarksWorkspace initialData={initialData} />;
}
