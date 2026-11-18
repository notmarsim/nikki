import { sql } from "drizzle-orm";
import { db } from "./index";

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs a Drizzle transaction with PostgreSQL session variable `app.current_user_id`
 * set for Row Level Security (RLS) enforcement alongside application-level ownership checks.
 */
export async function withUserRls<T>(
  userId: string,
  fn: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx);
  });
}
