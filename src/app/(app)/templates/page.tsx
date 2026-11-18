import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { TemplatesWorkspace } from "@/features/templates/components/templates-workspace";

export default async function TemplatesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return <TemplatesWorkspace />;
}
