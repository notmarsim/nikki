import { redirect } from "next/navigation";
import { DayPlannerWorkspace } from "@/features/day-planner/components/day-planner-workspace";
import { getCurrentSession } from "@/modules/auth/session";

export default async function DayPlannerPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return <DayPlannerWorkspace />;
}
