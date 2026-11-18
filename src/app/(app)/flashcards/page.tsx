import { Suspense } from "react";
import { getCurrentSession } from "@/modules/auth/session";
import { getFlashcardsOverview } from "@/modules/flashcards/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";
import { FlashcardsWorkspace } from "@/features/flashcards/components/flashcards-workspace";

export default async function FlashcardsPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const overview = await getFlashcardsOverview(session.user.id, workspace.id);

  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading flashcards...</div>}>
      <FlashcardsWorkspace initialOverview={overview} />
    </Suspense>
  );
}
