/**
 * 로컬 health HTTP 서버.
 */
import Fastify, { type FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { registerHealthRoutes } from "./health/routes.js";

export const createRuntimeApp = (db: Database.Database): FastifyInstance => {
  const app = Fastify({ logger: false });
  registerHealthRoutes(app, db);
  return app;
};
