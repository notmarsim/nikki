import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentSession } from "@/modules/auth/session";
import { mergeUserPreferences } from "@/modules/settings/registry";
import { getUserSettings, getUserWorkspaces } from "@/modules/users/service";

export default async function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const [workspaces, settings] = await Promise.all([
    getUserWorkspaces(session.user.id),
    getUserSettings(session.user.id),
  ]);
  const activeWorkspace = workspaces[0];
  const initialPreferences = mergeUserPreferences(settings?.preferences);

  return (
    <AppShell
      user={{ name: session.user.name, email: session.user.email }}
      workspaceName={activeWorkspace?.name ?? "Personal"}
      initialPreferences={initialPreferences}
    >
      {children}
    </AppShell>
  );
}
