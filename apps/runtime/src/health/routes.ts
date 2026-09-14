/**
 * 로컬 health/ready. API 연결 여부와 무관하다.
 */
import type { HealthStatus, ReadyStatus } from "@howling/contracts";
import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { migrationsReady } from "../db/migrate.js";

export const registerHealthRoutes = (
  app: FastifyInstance,
  db: Database.Database,
): void => {
  app.get("/health", async (): Promise<HealthStatus> => ({
    status: "ok",
    service: "runtime",
  }));

  app.get("/ready", async (request, reply): Promise<ReadyStatus> => {
    let database = false;
    try {
      db.prepare("SELECT 1").get();
      database = true;
    } catch {
      database = false;
    }
    const migrations = database ? migrationsReady(db) : false;
    const body: ReadyStatus = {
      status: database && migrations ? "ready" : "not_ready",
      service: "runtime",
      checks: { database, migrations },
    };
    if (body.status !== "ready") {
      return reply.code(503).send(body);
    }
    return body;
  });
};
