import { redirect } from "next/navigation";
import { SubscriptionsWorkspace } from "@/features/subscriptions/components/subscriptions-workspace";
import { getCurrentSession } from "@/modules/auth/session";

export default async function SubscriptionsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return <SubscriptionsWorkspace />;
}
