import { redirect } from "next/navigation";
import { ArchiveWorkspace } from "@/features/archive/components/archive-workspace";
import { getCurrentSession } from "@/modules/auth/session";

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const params = await searchParams;
  const tab =
    params.tab === "projects" || params.tab === "trash" ? params.tab : "tasks";
  return <ArchiveWorkspace initialTab={tab} />;
}
