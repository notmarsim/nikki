import { and, eq, gte, isNull, lte, ne } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import { notifications, routines, subscriptions, tasks } from "@/db/schema";

export interface NotificationBundleItem {
  id: string;
  kind: "tasks" | "subscriptions" | "routines";
  title: string;
  body: string;
  href: string;
  priority: "normal" | "high";
}

export async function buildSmartNotificationBundles(
  userId: string,
  workspaceId: string
): Promise<NotificationBundleItem[]> {
  const now = new Date();
  const tomorrowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const todayStr = now.toISOString().slice(0, 10);
  const weekAheadStr = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);

  return withUserRls(userId, async (tx) => {
    const [dueTasks, upcomingSubs, activeRoutines] = await Promise.all([
      tx
        .select({ id: tasks.id, title: tasks.title, priority: tasks.priority })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.workspaceId, workspaceId),
            isNull(tasks.archivedAt),
            isNull(tasks.deletedAt),
            ne(tasks.status, "done"),
            ne(tasks.status, "cancelled"),
            gte(tasks.dueAt, now),
            lte(tasks.dueAt, tomorrowEnd)
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
            lte(subscriptions.nextBillingDate, weekAheadStr)
          )
        ),
      tx
        .select({ id: routines.id, title: routines.title, scheduledTime: routines.scheduledTime })
        .from(routines)
        .where(
          and(
            eq(routines.userId, userId),
            eq(routines.workspaceId, workspaceId),
            eq(routines.isPaused, false),
            eq(routines.isTemplate, false)
          )
        ),
    ]);

    const bundles: NotificationBundleItem[] = [];

    if (dueTasks.length > 0) {
      const hasUrgent = dueTasks.some((t) => t.priority === "urgent" || t.priority === "high");
      bundles.push({
        id: `bundle-tasks-${todayStr}`,
        kind: "tasks",
        title: `Você tem ${dueTasks.length} tarefa(s) importante(s) nas próximas 48h`,
        body: dueTasks.slice(0, 3).map((t) => t.title).join(" · "),
        href: "/tasks",
        priority: hasUrgent ? "high" : "normal",
      });
    }

    if (upcomingSubs.length > 0) {
      bundles.push({
        id: `bundle-subs-${todayStr}`,
        kind: "subscriptions",
        title: `Existem ${upcomingSubs.length} cobrança(s) prevista(s) para esta semana`,
        body: upcomingSubs.slice(0, 3).map((s) => `${s.name} (${s.nextBillingDate})`).join(" · "),
        href: "/subscriptions",
        priority: "normal",
      });
    }

    if (activeRoutines.length > 0) {
      const nextR = activeRoutines[0]!;
      bundles.push({
        id: `bundle-routine-${todayStr}`,
        kind: "routines",
        title: `Sua próxima rotina "${nextR.title}" está programada para ${nextR.scheduledTime ?? "08:00"}`,
        body: `${activeRoutines.length} rotina(s) ativa(s) configurada(s).`,
        href: "/routines",
        priority: "normal",
      });
    }

    // Persist deduplicated in-app bundle notifications
    for (const b of bundles) {
      await tx
        .insert(notifications)
        .values({
          userId,
          workspaceId,
          title: b.title,
          body: b.body,
          category: b.kind === "subscriptions" ? "finances" : b.kind === "routines" ? "habits" : "tasks",
          href: b.href,
          dedupeKey: b.id,
        })
        .onConflictDoNothing();
    }

    return bundles;
  });
}
