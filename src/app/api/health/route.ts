import { sql } from "drizzle-orm";
import { db } from "@/db";
import { apiError, apiOk } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return apiOk({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Healthcheck failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return apiError(503, "SERVICE_UNAVAILABLE", "Database connection failed");
  }
}
