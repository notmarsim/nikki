import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const notificationSubscriptions = pgTable(
  "notification_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(), // web_push|capacitor_android|in_app
    deviceLabel: text("device_label").notNull().default("Device"),
    endpoint: text("endpoint"),
    p256dh: text("p256dh"),
    authSecret: text("auth_secret"),
    fcmToken: text("fcm_token"),
    isActive: boolean("is_active").notNull().default(true),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notification_subs_user_idx").on(table.userId, table.isActive),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    category: text("category").notNull().default("system"), // tasks|calendar|habits|learning|flashcards|finances|system
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href").notNull().default("/dashboard"),
    dedupeKey: text("dedupe_key"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
    uniqueIndex("notifications_user_dedupe_uidx").on(table.userId, table.dedupeKey),
  ]
);

export type NotificationSubscriptionRecord = typeof notificationSubscriptions.$inferSelect;
export type NotificationRecord = typeof notifications.$inferSelect;
