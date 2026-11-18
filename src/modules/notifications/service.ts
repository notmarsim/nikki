import { and, desc, eq, isNull } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import { notifications, notificationSubscriptions } from "@/db/schema";

export async function listNotifications(userId: string) {
  return withUserRls(userId, async (tx) => {
    const [items, unread] = await Promise.all([
      tx
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(30),
      tx
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
    ]);
    return { notifications: items, unreadCount: unread.length };
  });
}

export async function createNotification(params: {
  userId: string;
  workspaceId: string;
  category: string;
  title: string;
  body: string;
  href?: string;
  dedupeKey?: string;
}) {
  return withUserRls(params.userId, async (tx) => {
    const [created] = await tx
      .insert(notifications)
      .values({
        userId: params.userId,
        workspaceId: params.workspaceId,
        category: params.category,
        title: params.title,
        body: params.body,
        href: params.href ?? "/dashboard",
        dedupeKey: params.dedupeKey ?? null,
        deliveredAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();
    return created ?? null;
  });
}

export async function markNotificationRead(userId: string, id?: string) {
  return withUserRls(userId, async (tx) => {
    if (id) {
      await tx
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    } else {
      await tx
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    }
    return { ok: true };
  });
}

export async function listDeviceSubscriptions(userId: string) {
  return withUserRls(userId, async (tx) => {
    return tx
      .select({
        id: notificationSubscriptions.id,
        platform: notificationSubscriptions.platform,
        deviceLabel: notificationSubscriptions.deviceLabel,
        isActive: notificationSubscriptions.isActive,
        lastSeenAt: notificationSubscriptions.lastSeenAt,
        createdAt: notificationSubscriptions.createdAt,
      })
      .from(notificationSubscriptions)
      .where(eq(notificationSubscriptions.userId, userId))
      .orderBy(desc(notificationSubscriptions.lastSeenAt));
  });
}

export async function registerDeviceSubscription(params: {
  userId: string;
  workspaceId: string;
  platform: "web_push" | "capacitor_android" | "in_app";
  deviceLabel: string;
  endpoint?: string | null;
  p256dh?: string | null;
  authSecret?: string | null;
  fcmToken?: string | null;
}) {
  return withUserRls(params.userId, async (tx) => {
    const [created] = await tx
      .insert(notificationSubscriptions)
      .values({
        userId: params.userId,
        workspaceId: params.workspaceId,
        platform: params.platform,
        deviceLabel: params.deviceLabel,
        endpoint: params.endpoint ?? null,
        p256dh: params.p256dh ?? null,
        authSecret: params.authSecret ?? null,
        fcmToken: params.fcmToken ?? null,
      })
      .returning({
        id: notificationSubscriptions.id,
        platform: notificationSubscriptions.platform,
        deviceLabel: notificationSubscriptions.deviceLabel,
        createdAt: notificationSubscriptions.createdAt,
      });
    return created!;
  });
}

export async function removeDeviceSubscription(userId: string, subscriptionId: string) {
  return withUserRls(userId, async (tx) => {
    await tx
      .delete(notificationSubscriptions)
      .where(
        and(
          eq(notificationSubscriptions.id, subscriptionId),
          eq(notificationSubscriptions.userId, userId)
        )
      );
    return { deleted: true };
  });
}
