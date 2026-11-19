import { redirect } from "next/navigation";
import { TripsWorkspace } from "@/features/trips/components/trips-workspace";
import { getCurrentSession } from "@/modules/auth/session";

export default async function TripsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return <TripsWorkspace />;
}
