/**
 * 로컬 health·run HTTP 서버.
 */
import Fastify, { type FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import type { RuntimeHost } from "./coordinator/host.js";
import { registerHealthRoutes } from "./health/routes.js";
import { registerRunRoutes } from "./http/run-routes.js";

export const createRuntimeApp = (
  db: Database.Database,
  host?: RuntimeHost,
): FastifyInstance => {
  const app = Fastify({ logger: false });
  registerHealthRoutes(app, db);
  if (host) {
    registerRunRoutes(app, host);
  }
  return app;
};
