import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { JournalWorkspace } from "@/features/journal/components/journal-workspace";

export default async function JournalPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return <JournalWorkspace />;
}
