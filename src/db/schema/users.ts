import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { themeEnum } from "./enums";

export interface DashboardWidgetConfig {
  id: string;
  type: string;
  title: string;
  size: "sm" | "md" | "lg";
  order: number;
}

export interface ShortcutConfig {
  commandPalette: string;
  quickInbox: string;
  toggleSidebar: string;
}

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  timezone: text("timezone").notNull().default("UTC"),
  theme: themeEnum("theme").notNull().default("system"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ]
);

export const userSettings = pgTable("user_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  sidebarCollapsed: boolean("sidebar_collapsed").notNull().default(false),
  defaultWorkspaceId: uuid("default_workspace_id"),
  shortcuts: jsonb("shortcuts")
    .$type<ShortcutConfig>()
    .notNull()
    .default({
      commandPalette: "mod+k",
      quickInbox: "mod+shift+i",
      toggleSidebar: "mod+b",
    }),
  dashboardLayout: jsonb("dashboard_layout")
    .$type<DashboardWidgetConfig[]>()
    .notNull()
    .default([]),
  preferences: jsonb("preferences")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type UserRecord = typeof users.$inferSelect;
export type SessionRecord = typeof sessions.$inferSelect;
export type UserSettingsRecord = typeof userSettings.$inferSelect;
