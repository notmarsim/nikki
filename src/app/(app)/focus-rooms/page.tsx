import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { FocusRoomsWorkspace } from "@/features/focus-rooms/components/focus-rooms-workspace";

export default async function FocusRoomsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return <FocusRoomsWorkspace />;
}
