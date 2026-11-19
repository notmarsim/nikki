import { redirect } from "next/navigation";
import { RoutinesWorkspace } from "@/features/routines/components/routines-workspace";
import { getCurrentSession } from "@/modules/auth/session";

export default async function RoutinesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return <RoutinesWorkspace />;
}
