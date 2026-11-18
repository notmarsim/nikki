import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { GoalsWorkspace } from "@/features/goals/components/goals-workspace";

export default async function GoalsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return <GoalsWorkspace />;
}
