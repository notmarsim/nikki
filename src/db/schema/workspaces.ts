import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    icon: text("icon").notNull().default("Layers"),
    color: text("color").notNull().default("#3b82f6"),
    spaceType: text("space_type").notNull().default("personal"), // personal|shared
    status: text("status").notNull().default("active"), // active|archived
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("workspaces_owner_id_idx").on(table.ownerId),
    uniqueIndex("workspaces_owner_slug_uidx").on(table.ownerId, table.slug),
  ]
);

export type WorkspaceRecord = typeof workspaces.$inferSelect;
