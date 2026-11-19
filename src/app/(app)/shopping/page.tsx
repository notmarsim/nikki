import { redirect } from "next/navigation";
import { ShoppingWorkspace } from "@/features/shopping/components/shopping-workspace";
import { getCurrentSession } from "@/modules/auth/session";

export default async function ShoppingPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return <ShoppingWorkspace />;
}
