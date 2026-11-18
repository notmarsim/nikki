import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { VaultWorkspace } from "@/features/vault/components/vault-workspace";

export default async function VaultPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return <VaultWorkspace />;
}
