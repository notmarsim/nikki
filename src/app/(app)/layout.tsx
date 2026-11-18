import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentSession } from "@/modules/auth/session";
import { getUserWorkspaces } from "@/modules/users/service";

export default async function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const workspaces = await getUserWorkspaces(session.user.id);
  const activeWorkspace = workspaces[0];

  return (
    <AppShell
      user={{ name: session.user.name, email: session.user.email }}
      workspaceName={activeWorkspace?.name ?? "Personal"}
    >
      {children}
    </AppShell>
  );
}
