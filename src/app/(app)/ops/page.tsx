import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { OpsWorkspace } from "@/features/ops/components/ops-workspace";

export default async function OpsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!session.user.isAdmin) redirect("/dashboard");
  return <OpsWorkspace />;
}
