import { and, eq, gte, isNull, lte, ne } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  onboardingStates,
  smartShoppingLists,
  subscriptions,
  tasks,
  trips,
} from "@/db/schema";

export async function getOnboardingState(userId: string) {
  return withUserRls(userId, async (tx) => {
    const [row] = await tx
      .select()
      .from(onboardingStates)
      .where(eq(onboardingStates.userId, userId))
      .limit(1);

    if (row) return row;

    const [created] = await tx
      .insert(onboardingStates)
      .values({ userId })
      .onConflictDoNothing()
      .returning();

    if (created) return created;

    const [fallback] = await tx
      .select()
      .from(onboardingStates)
      .where(eq(onboardingStates.userId, userId))
      .limit(1);
    return fallback!;
  });
}

export async function updateOnboardingState(
  userId: string,
  patch: {
    welcomeCompleted?: boolean;
    tourStatus?: "not_started" | "in_progress" | "completed" | "skipped";
    currentTourId?: string | null;
    currentStepIndex?: number;
    completeTourId?: string;
    dismissTourId?: string;
    dismissSuggestionId?: string;
    resetInitialTour?: boolean;
  }
) {
  const current = await getOnboardingState(userId);
  const completedSet = new Set(current.completedTours);
  const dismissedSet = new Set(current.dismissedTours);
  const dismissedSuggestionsSet = new Set(current.dismissedSuggestions);

  if (patch.completeTourId) completedSet.add(patch.completeTourId);
  if (patch.dismissTourId) dismissedSet.add(patch.dismissTourId);
  if (patch.dismissSuggestionId) dismissedSuggestionsSet.add(patch.dismissSuggestionId);

  return withUserRls(userId, async (tx) => {
    const [updated] = await tx
      .update(onboardingStates)
      .set({
        ...(patch.welcomeCompleted !== undefined ? { welcomeCompleted: patch.welcomeCompleted } : {}),
        ...(patch.tourStatus !== undefined ? { tourStatus: patch.tourStatus } : {}),
        ...(patch.currentTourId !== undefined ? { currentTourId: patch.currentTourId } : {}),
        ...(patch.currentStepIndex !== undefined ? { currentStepIndex: patch.currentStepIndex } : {}),
        ...(patch.resetInitialTour
          ? {
              welcomeCompleted: true,
              tourStatus: "in_progress",
              currentStepIndex: 0,
            }
          : {}),
        completedTours: Array.from(completedSet),
        dismissedTours: Array.from(dismissedSet),
        dismissedSuggestions: Array.from(dismissedSuggestionsSet),
        updatedAt: new Date(),
      })
      .where(eq(onboardingStates.userId, userId))
      .returning();

    return updated!;
  });
}

export interface ContextualSuggestion {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  priority: number;
}

export async function getContextualSuggestions(
  userId: string,
  workspaceId: string,
  dismissedIds: string[]
): Promise<ContextualSuggestion[]> {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const inThreeDaysStr = new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10);
  const inFourteenDaysStr = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);

  return withUserRls(userId, async (tx) => {
    const [openTasks, upcomingSubs, activeLists, upcomingTrips] = await Promise.all([
      tx
        .select({ id: tasks.id, dueAt: tasks.dueAt })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.workspaceId, workspaceId),
            isNull(tasks.archivedAt),
            isNull(tasks.deletedAt),
            ne(tasks.status, "done"),
            ne(tasks.status, "cancelled")
          )
        ),
      tx
        .select({ id: subscriptions.id, name: subscriptions.name, nextBillingDate: subscriptions.nextBillingDate })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.workspaceId, workspaceId),
            eq(subscriptions.status, "active"),
            gte(subscriptions.nextBillingDate, todayStr),
            lte(subscriptions.nextBillingDate, inThreeDaysStr)
          )
        ),
      tx
        .select({ id: smartShoppingLists.id, name: smartShoppingLists.name })
        .from(smartShoppingLists)
        .where(and(eq(smartShoppingLists.workspaceId, workspaceId), eq(smartShoppingLists.status, "active"))),
      tx
        .select({ id: trips.id, name: trips.name, startDate: trips.startDate })
        .from(trips)
        .where(
          and(
            eq(trips.workspaceId, workspaceId),
            gte(trips.startDate, todayStr),
            lte(trips.startDate, inFourteenDaysStr)
          )
        ),
    ]);

    const overdueCount = openTasks.filter((t) => t.dueAt && t.dueAt.getTime() < now.getTime()).length;
    const suggestions: ContextualSuggestion[] = [];

    if (overdueCount >= 2) {
      suggestions.push({
        id: `ctx-recovery-${overdueCount}`,
        title: `Existem ${overdueCount} tarefas atrasadas`,
        description: "Deseja reorganizar seu planejamento sem perder nada?",
        actionLabel: "Abrir Recovery",
        href: "/day-planner?recovery=1",
        priority: 100,
      });
    }

    if (upcomingSubs.length > 0) {
      const sub = upcomingSubs[0]!;
      suggestions.push({
        id: `ctx-sub-${sub.id}-${sub.nextBillingDate}`,
        title: `Assinatura "${sub.name}" renova em breve (${sub.nextBillingDate})`,
        description: "Confira suas próximas cobranças ou pause se não estiver usando.",
        actionLabel: "Ver Assinaturas",
        href: "/subscriptions",
        priority: 85,
      });
    }

    if (openTasks.length > 0) {
      suggestions.push({
        id: `ctx-planner-${todayStr}`,
        title: "Organize seu dia em blocos de tempo",
        description: `Você tem ${openTasks.length} tarefa(s) pendente(s) que podem ser distribuídas hoje.`,
        actionLabel: "Abrir Day Planner",
        href: "/day-planner",
        priority: 70,
      });
    }

    if (upcomingTrips.length > 0) {
      const trip = upcomingTrips[0]!;
      suggestions.push({
        id: `ctx-trip-${trip.id}`,
        title: `Viagem próxima: ${trip.name} (${trip.startDate})`,
        description: "Revise seu roteiro, reservas e checklist de bagagem.",
        actionLabel: "Abrir Viagem",
        href: "/trips",
        priority: 65,
      });
    }

    if (activeLists.length > 0) {
      suggestions.push({
        id: `ctx-shopping-${activeLists[0]!.id}`,
        title: `Lista de compras ativa: ${activeLists[0]!.name}`,
        description: "Acompanhe itens pendentes e registre o valor final ao concluir.",
        actionLabel: "Abrir Compras",
        href: "/shopping",
        priority: 50,
      });
    }

    return suggestions
      .filter((s) => !dismissedIds.includes(s.id))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);
  });
}
