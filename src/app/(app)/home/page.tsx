import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { HomeWorkspace } from "@/features/home/components/home-workspace";

export default async function HomeModulePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return <HomeWorkspace />;
}
