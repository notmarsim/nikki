import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { FeedWorkspace } from "@/features/feed/components/feed-workspace";

export default async function FeedPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return <FeedWorkspace />;
}
