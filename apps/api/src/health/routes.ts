/**
 * 프로세스 health와 DB readiness. runtime online은 여기 넣지 않는다.
 */
import type { HealthStatus, ReadyStatus } from "@howling/contracts";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { migrationsReady } from "../db/migrate.js";

export const registerHealthRoutes = (
  app: FastifyInstance,
  pool: pg.Pool,
): void => {
  app.get("/health", async (): Promise<HealthStatus> => ({
    status: "ok",
    service: "api",
  }));

  app.get("/ready", async (request, reply): Promise<ReadyStatus> => {
    let database = false;
    try {
      await pool.query("SELECT 1");
      database = true;
    } catch {
      database = false;
    }
    const migrations = database ? await migrationsReady(pool) : false;
    const body: ReadyStatus = {
      status: database && migrations ? "ready" : "not_ready",
      service: "api",
      checks: { database, migrations },
    };
    if (body.status !== "ready") {
      return reply.code(503).send(body);
    }
    return body;
  });
};
