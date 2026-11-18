import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { SpacesWorkspace } from "@/features/spaces/components/spaces-workspace";

export default async function SpacesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return <SpacesWorkspace />;
}
