import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { SearchWorkspace } from "@/features/search/components/search-workspace";

export default async function SearchPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  return <SearchWorkspace />;
}
