/**
 * 테스트 OIDC Fastify 앱.
 */
import formbody from "@fastify/formbody";
import Fastify, { type FastifyInstance } from "fastify";
import type { OidcConfig } from "./config.js";
import { createOidcKeys } from "./keys.js";
import { registerOidcRoutes } from "./routes.js";
import { createOidcStore } from "./store.js";

export const createOidcApp = async (
  config: OidcConfig,
): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });
  const keys = await createOidcKeys();
  await app.register(formbody);
  registerOidcRoutes(app, config, keys, createOidcStore());
  return app;
};
