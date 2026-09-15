/**
 * Fastify 앱 조립.
 */
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import type pg from "pg";
import { registerAuthRoutes } from "./auth/routes.js";
import type { ApiConfig } from "./config.js";
import { registerHealthRoutes } from "./health/routes.js";
import { registerRuntimeGateway } from "./runtime/ws.js";
import { registerFlowRoutes } from "./flows/routes.js";
import { registerMcpRoutes } from "./mcp/routes.js";
import { registerMcpOauthRoutes } from "./oauth/mcp-callback.js";
import { registerPairingRoutes } from "./pairings/routes.js";
import { registerSiteRoutes } from "./sites/routes.js";
import { registerTokenRoutes } from "./tokens/routes.js";
import { registerDataRoutes } from "./data/routes.js";
import { registerDeviceRoutes } from "./devices/routes.js";

export const createApiApp = async (
  config: ApiConfig,
  pool: pg.Pool,
): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  await app.register(websocket);
  registerHealthRoutes(app, pool);
  registerAuthRoutes(app, pool, config);
  registerSiteRoutes(app, pool);
  registerPairingRoutes(app, pool);
  registerFlowRoutes(app, pool);
  registerTokenRoutes(app, pool);
  registerDataRoutes(app, pool);
  registerDeviceRoutes(app, pool);
  registerMcpRoutes(app, pool);
  registerMcpOauthRoutes(app);
  registerRuntimeGateway(app, pool);
  return app;
};
