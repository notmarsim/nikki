import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { getEnv } from "@/lib/env";

const globalForDb = globalThis as unknown as {
  postgresClient?: postgres.Sql;
};

function getClient(): postgres.Sql {
  if (!globalForDb.postgresClient) {
    const env = getEnv();
    const isSupabase =
      env.DATABASE_URL.includes("supabase.co") ||
      env.DATABASE_URL.includes("supabase.com") ||
      env.DATABASE_URL.includes("sslmode=require");

    globalForDb.postgresClient = postgres(env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      ...(isSupabase ? { ssl: "require", prepare: false } : {}),
    });
  }
  return globalForDb.postgresClient;
}

export const db = drizzle(getClient(), { schema });
export type Database = typeof db;
