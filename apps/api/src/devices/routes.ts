/**
 * GET·POST /api/v1/sites/:siteId/devices
 */
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { requireCsrf } from "../auth/session.js";
import { requireSiteMember } from "../sites/access.js";
import { actSiteDevice } from "./act.js";
import { createSiteDevice } from "./create.js";
import { integrateSiteDevice } from "./integrate.js";
import { listSiteDevices } from "./store.js";

export const registerDeviceRoutes = (app: FastifyInstance, pool: pg.Pool): void => {
  app.get("/api/v1/sites/:siteId/devices", async (request, reply) => {
    const member = await requireSiteMember(pool, request, reply);
    if (!member) {
      return;
    }
    return { devices: await listSiteDevices(pool, member.siteId) };
  });

  app.post("/api/v1/sites/:siteId/devices", async (request, reply) => {
    const member = await requireSiteMember(pool, request, reply);
    if (!member || !requireCsrf(request, reply)) {
      return;
    }
    const result = await createSiteDevice(pool, member.siteId, request.body);
    return reply.code(result.status).send(result.body);
  });

  app.post("/api/v1/sites/:siteId/devices/:deviceId/actions", async (request, reply) => {
    const member = await requireSiteMember(pool, request, reply);
    if (!member || !requireCsrf(request, reply)) {
      return;
    }
    const deviceId = (request.params as { deviceId: string }).deviceId;
    const result = await actSiteDevice(pool, member.siteId, deviceId, request.body);
    return reply.code(result.status).send(result.body);
  });

  app.post("/api/v1/sites/:siteId/devices/integrations", async (request, reply) => {
    const member = await requireSiteMember(pool, request, reply);
    if (!member || !requireCsrf(request, reply)) {
      return;
    }
    const result = await integrateSiteDevice(pool, member.siteId, request.body);
    return reply.code(result.status).send(result.body);
  });
};
