import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { getDeveloperHubOverview } from "@/modules/developer-hub/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";
import { DeveloperHubWorkspace } from "@/features/developer-hub/components/developer-hub-workspace";

export default async function DeveloperHubPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const { tab } = await searchParams;
  const allowed = [
    "overview",
    "snippets",
    "commands",
    "cheatsheets",
    "documentation",
    "github",
  ] as const;
  const initialTab = allowed.includes(tab as (typeof allowed)[number])
    ? (tab as (typeof allowed)[number])
    : "overview";

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const initialOverview = await getDeveloperHubOverview(
    session.user.id,
    workspace.id
  );

  return (
    <DeveloperHubWorkspace
      initialOverview={initialOverview}
      initialTab={initialTab}
    />
  );
}
