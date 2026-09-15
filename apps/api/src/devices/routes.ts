/**
 * GET /api/v1/sites/:siteId/devices
 */
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { requireSiteMember } from "../sites/access.js";
import { listSiteDevices } from "./store.js";

export const registerDeviceRoutes = (app: FastifyInstance, pool: pg.Pool): void => {
  app.get("/api/v1/sites/:siteId/devices", async (request, reply) => {
    const member = await requireSiteMember(pool, request, reply);
    if (!member) {
      return;
    }
    return { devices: await listSiteDevices(pool, member.siteId) };
  });
};
